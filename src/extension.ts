import * as vscode from "vscode";
import { createBackendRegistry } from "./backends/index";
import {
  gnomeExtensionDir,
  installGnomeExtension,
} from "./backends/gnome/install";
import {
  installPatch,
  isPatched,
  removeConfig,
  uninstallPatch,
  writeConfig,
} from "./backends/macos/patcher";
import { restartEditor } from "./backends/macos/restart";
import { describeError, OpacityService } from "./opacity";

const MACOS_ENABLED_KEY = "diffuse.macosEnabled";
const MACOS_PROMPT_SHOWN_KEY = "diffuse.macosPromptShown";

class DiffuseContext {
  private readonly output = vscode.window.createOutputChannel("Diffuse");
  private readonly service: OpacityService;
  private readonly appRoot: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.appRoot = vscode.env.appRoot;
    const registry = createBackendRegistry(context.extensionPath, this.appRoot);
    this.service = new OpacityService(
      context,
      registry,
      this.output,
      (message) => vscode.window.showWarningMessage(`Diffuse: ${message}`)
    );
  }

  activate(): void {
    if (process.platform === "darwin") {
      this.repairMacosPatchIfNeeded();
    }

    void this.service.initialize().then(() => {
      if (process.platform === "darwin" && isPatched(this.appRoot)) {
        try {
          writeConfig(this.service.opacity);
        } catch (error) {
          this.output.appendLine(
            `failed to write macOS opacity config: ${describeError(error)}`
          );
        }
      }
    });

    this.context.subscriptions.push(
      this.output,
      vscode.commands.registerCommand("diffuse.decreaseOpacity", () =>
        this.service.adjust("decrease")
      ),
      vscode.commands.registerCommand("diffuse.increaseOpacity", () =>
        this.service.adjust("increase")
      ),
      vscode.commands.registerCommand("diffuse.resetOpacity", () =>
        this.service.reset()
      ),
      vscode.commands.registerCommand("diffuse.showEnvironment", () => {
        this.output.show(true);
        void this.service.refresh();
      }),
      vscode.commands.registerCommand("diffuse.installGnomeExtension", () =>
        this.installGnomeShellExtension()
      ),
      vscode.commands.registerCommand("diffuse.enableMacosTransparency", () =>
        this.enableMacosTransparency()
      ),
      vscode.commands.registerCommand("diffuse.disableMacosTransparency", () =>
        this.disableMacosTransparency()
      ),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("diffuse")) {
          void this.service.refresh();
        }
      })
    );

    if (process.platform === "darwin") {
      this.maybePromptMacosEnable();
    }
  }

  private log(message: string): void {
    this.output.appendLine(message);
  }

  private repairMacosPatchIfNeeded(): void {
    const userEnabled = this.context.globalState.get(MACOS_ENABLED_KEY, false);
    const patched = isPatched(this.appRoot);
    this.log(`macOS patch: ${patched ? "installed" : "not installed"}, opted in: ${userEnabled}`);

    if (!userEnabled || patched) {
      return;
    }

    this.log("macOS patch missing (editor likely updated). Re-applying...");
    const result = installPatch(this.appRoot);
    this.log(`macOS re-patch: ${result.message}`);

    if (!result.success) {
      vscode.window.showErrorMessage(
        `Diffuse: Failed to re-apply the macOS patch after an update — ${result.message}`
      );
      return;
    }

    try {
      writeConfig(this.service.opacity);
    } catch (error) {
      this.log(`failed to write macOS opacity config: ${describeError(error)}`);
    }

    const autoRestart = vscode.workspace
      .getConfiguration("diffuse")
      .get<boolean>("macosAutoRestartAfterUpdate", false);

    if (autoRestart) {
      this.log("Auto-restarting after editor update...");
      void restartEditor(this.appRoot, (line) => this.log(line));
      return;
    }

    void vscode.window
      .showInformationMessage(
        "Diffuse: The editor was updated. The macOS transparency patch was re-applied. Restart to restore the effect.",
        "Restart Now",
        "Later"
      )
      .then((choice) => {
        if (choice === "Restart Now") {
          void restartEditor(this.appRoot, (line) => this.log(line));
        }
      });
  }

  private maybePromptMacosEnable(): void {
    const userEnabled = this.context.globalState.get(MACOS_ENABLED_KEY, false);
    const promptShown = this.context.globalState.get(MACOS_PROMPT_SHOWN_KEY, false);
    if (isPatched(this.appRoot) || userEnabled || promptShown) {
      return;
    }

    void this.context.globalState.update(MACOS_PROMPT_SHOWN_KEY, true);
    void vscode.window
      .showInformationMessage(
        "Diffuse can make this window transparent on macOS by patching the editor's Electron files. That may trigger a modified-installation warning and needs a restart.",
        "Enable Now"
      )
      .then((choice) => {
        if (choice === "Enable Now") {
          void vscode.commands.executeCommand("diffuse.enableMacosTransparency");
        }
      });
  }

  private async enableMacosTransparency(): Promise<void> {
    if (process.platform !== "darwin") {
      vscode.window.showWarningMessage("Diffuse: the editor patch is only needed on macOS.");
      return;
    }

    if (isPatched(this.appRoot)) {
      await this.context.globalState.update(MACOS_ENABLED_KEY, true);
      try {
        writeConfig(this.service.opacity);
      } catch (error) {
        this.log(`failed to write macOS opacity config: ${describeError(error)}`);
      }
      await this.service.refresh();
      vscode.window.showInformationMessage("Diffuse: macOS transparency is already enabled.");
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      "Diffuse will modify this editor's out/main.js so Electron can set window opacity. macOS may then report a modified or corrupt installation. A restart is required.",
      { modal: true },
      "Enable Transparency"
    );
    if (confirmed !== "Enable Transparency") {
      return;
    }

    const result = installPatch(this.appRoot);
    this.log(`macOS install: ${result.message}`);
    if (!result.success) {
      vscode.window.showErrorMessage(`Diffuse: ${result.message}`);
      return;
    }

    await this.context.globalState.update(MACOS_ENABLED_KEY, true);
    try {
      writeConfig(this.service.opacity);
    } catch (error) {
      this.log(`failed to write macOS opacity config: ${describeError(error)}`);
    }
    await this.service.refresh();

    const choice = await vscode.window.showInformationMessage(
      "Diffuse: macOS patch installed. Restart the editor for transparency to take effect.",
      "Restart Now",
      "Later"
    );
    if (choice === "Restart Now") {
      await restartEditor(this.appRoot, (line) => this.log(line));
    }
  }

  private async disableMacosTransparency(): Promise<void> {
    if (process.platform !== "darwin") {
      vscode.window.showWarningMessage("Diffuse: the editor patch is only used on macOS.");
      return;
    }

    const result = uninstallPatch(this.appRoot);
    this.log(`macOS uninstall: ${result.message}`);
    if (!result.success) {
      vscode.window.showErrorMessage(`Diffuse: ${result.message}`);
      return;
    }

    removeConfig();
    await this.context.globalState.update(MACOS_ENABLED_KEY, false);
    await this.service.refresh();

    const choice = await vscode.window.showInformationMessage(
      "Diffuse: macOS patch removed. Restart the editor to restore a fully opaque window.",
      "Restart Now",
      "Later"
    );
    if (choice === "Restart Now") {
      await restartEditor(this.appRoot, (line) => this.log(line));
    }
  }

  private async installGnomeShellExtension(): Promise<void> {
    try {
      const destination = await installGnomeExtension(
        this.context.extensionPath
      );
      this.output.appendLine(`installed GNOME Shell extension to ${destination}`);

      const choice = await vscode.window.showInformationMessage(
        "Diffuse: GNOME Shell extension installed. Enable it, then log out and back in for GNOME to load it.",
        "Show Output"
      );
      if (choice === "Show Output") {
        this.output.show(true);
      }
    } catch (error) {
      const message = describeError(error);
      this.output.appendLine(`GNOME install failed: ${message}`);
      vscode.window.showErrorMessage(
        `Diffuse: could not install the GNOME Shell extension into ${gnomeExtensionDir()} — ${message}`
      );
    }
  }

  dispose(): void {
    this.service.dispose();
  }
}

let diffuse: DiffuseContext | undefined;

export function activate(context: vscode.ExtensionContext): void {
  diffuse = new DiffuseContext(context);
  diffuse.activate();
}

export function deactivate(): void {
  diffuse?.dispose();
  diffuse = undefined;
}
