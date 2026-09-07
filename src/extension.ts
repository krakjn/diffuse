import * as vscode from "vscode";
import { GnomeBackend } from "./backends/gnome";
import { HyprlandBackend } from "./backends/hyprland";
import { KdeBackend } from "./backends/kde/kde";
import { BackendRegistry } from "./backends/registry";
import { KWIN_SCRIPT_VERSION } from "./backends/types";
import { detectEnvironment } from "./detect";
import {
  adjustOpacity,
  getDetectionSummary,
  getOpacityConfig,
  getStoredOpacity,
} from "./opacity";

let statusBarItem: vscode.StatusBarItem | undefined;
let outputChannel: vscode.OutputChannel | undefined;
let registry: BackendRegistry | undefined;
let detected = detectEnvironment();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel("Diffuse");
  registry = new BackendRegistry();
  registry.register(new KdeBackend(context));
  registry.register(new GnomeBackend());
  registry.register(new HyprlandBackend());

  detected = detectEnvironment();
  outputChannel.appendLine(getDetectionSummary(detected));
  outputChannel.appendLine(`KWin script version ${KWIN_SCRIPT_VERSION}`);
  outputChannel.appendLine(`stored opacity ${getStoredOpacity(context)}`);

  updateStatusBar(context);

  context.subscriptions.push(
    outputChannel,
    vscode.commands.registerCommand("diffuse.decreaseOpacity", () =>
      runAdjust(context, "decrease")
    ),
    vscode.commands.registerCommand("diffuse.increaseOpacity", () =>
      runAdjust(context, "increase")
    ),
    vscode.commands.registerCommand("diffuse.showEnvironment", () => {
      outputChannel?.show(true);
      outputChannel?.appendLine(getDetectionSummary(detectEnvironment()));
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("diffuse")) {
        updateStatusBar(context);
      }
    })
  );
}

export function deactivate(): void {
  statusBarItem?.dispose();
}

async function runAdjust(
  context: vscode.ExtensionContext,
  direction: "increase" | "decrease"
): Promise<void> {
  if (!registry || !outputChannel) {
    return;
  }

  detected = detectEnvironment();

  try {
    const after = await adjustOpacity(
      context,
      registry,
      detected,
      direction,
      outputChannel
    );
    if (after !== null) {
      updateStatusBar(context, after);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel.appendLine(`error: ${message}`);
    vscode.window.showWarningMessage(`Diffuse: ${message}`);
  }
}

function updateStatusBar(
  context: vscode.ExtensionContext,
  opacity?: number
): void {
  const { showStatusBar } = getOpacityConfig();
  if (!showStatusBar) {
    statusBarItem?.hide();
    return;
  }

  if (!statusBarItem) {
    statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    context.subscriptions.push(statusBarItem);
  }

  const currentOpacity = opacity ?? getStoredOpacity(context);
  const pct = Math.round(currentOpacity * 100);
  const support = detected.supported ? "" : " (unsupported)";
  statusBarItem.text = `$(eye) Diffuse: ${detected.displayName}${support} ${pct}%`;
  statusBarItem.tooltip = `Diffuse opacity ${pct}% — KWin script v${KWIN_SCRIPT_VERSION}`;
  statusBarItem.command = "diffuse.showEnvironment";
  statusBarItem.show();
}
