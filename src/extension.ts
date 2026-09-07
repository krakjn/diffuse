import * as vscode from "vscode";
import { createBackendRegistry } from "./backends/index";
import type { BackendRegistry } from "./backends/registry";
import type { DetectResult } from "./backends/types";
import { detectEnvironment } from "./detect";
import { statusBarTooltip } from "./messages";
import {
  adjustOpacity,
  getDetectionSummary,
  getOpacityConfig,
  getStoredOpacity,
} from "./opacity";

class DiffuseContext {
  readonly output = vscode.window.createOutputChannel("Diffuse");
  readonly registry: BackendRegistry;
  detected: DetectResult;
  private statusBarItem?: vscode.StatusBarItem;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.registry = createBackendRegistry(context);
    this.detected = detectEnvironment();
  }

  activate(): void {
    this.output.appendLine(getDetectionSummary(this.detected));
    this.output.appendLine(`stored opacity ${getStoredOpacity(this.context)}`);
    this.updateStatusBar();

    this.context.subscriptions.push(
      this.output,
      vscode.commands.registerCommand("diffuse.decreaseOpacity", () =>
        this.runAdjust("decrease")
      ),
      vscode.commands.registerCommand("diffuse.increaseOpacity", () =>
        this.runAdjust("increase")
      ),
      vscode.commands.registerCommand("diffuse.showEnvironment", () => {
        this.detected = detectEnvironment();
        this.output.show(true);
        this.output.appendLine(getDetectionSummary(this.detected));
      }),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("diffuse")) {
          this.updateStatusBar();
        }
      })
    );
  }

  private async runAdjust(direction: "increase" | "decrease"): Promise<void> {
    this.detected = detectEnvironment();

    try {
      const after = await adjustOpacity(
        this.context,
        this.registry,
        this.detected,
        direction,
        this.output
      );
      if (after !== null) {
        this.updateStatusBar(after);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`error: ${message}`);
      vscode.window.showWarningMessage(`Diffuse: ${message}`);
    }
  }

  updateStatusBar(opacity?: number): void {
    const { showStatusBar } = getOpacityConfig();
    if (!showStatusBar) {
      this.statusBarItem?.hide();
      return;
    }

    if (!this.statusBarItem) {
      this.statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
      );
      this.statusBarItem.command = "diffuse.showEnvironment";
      this.context.subscriptions.push(this.statusBarItem);
    }

    const currentOpacity = opacity ?? getStoredOpacity(this.context);
    const pct = Math.round(currentOpacity * 100);

    if (this.detected.supported) {
      this.statusBarItem.text = `$(eye) Diffuse: ${this.detected.displayName} ${pct}%`;
      this.statusBarItem.tooltip = statusBarTooltip(this.detected, pct);
    } else {
      this.statusBarItem.text = `$(eye) Diffuse: ${this.detected.displayName} (unsupported)`;
      this.statusBarItem.tooltip = statusBarTooltip(this.detected);
    }

    this.statusBarItem.show();
  }
}

let diffuse: DiffuseContext | undefined;

export function activate(context: vscode.ExtensionContext): void {
  diffuse = new DiffuseContext(context);
  diffuse.activate();
}

export function deactivate(): void {
  diffuse = undefined;
}
