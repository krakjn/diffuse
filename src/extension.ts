import * as vscode from "vscode";
import { createBackendRegistry } from "./backends/index";
import {
  gnomeExtensionDir,
  installGnomeExtension,
} from "./backends/gnome/install";
import { describeError, OpacityService } from "./opacity";

class DiffuseContext {
  private readonly output = vscode.window.createOutputChannel("Diffuse");
  private readonly service: OpacityService;

  constructor(private readonly context: vscode.ExtensionContext) {
    const registry = createBackendRegistry(context.extensionPath);
    this.service = new OpacityService(
      context,
      registry,
      this.output,
      (message) => vscode.window.showWarningMessage(`Diffuse: ${message}`)
    );
  }

  activate(): void {
    void this.service.initialize();

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
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("diffuse")) {
          void this.service.refresh();
        }
      })
    );
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
