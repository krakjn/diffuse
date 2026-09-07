import type { ExtensionContext } from "vscode";
import type { AdjustResult, OpacityBackend } from "../types";
import { isKwinAvailable, runKwinScript } from "./kwin-runner";

export class KdeBackend implements OpacityBackend {
  readonly id = "kde" as const;

  constructor(private readonly context: ExtensionContext) {}

  async isAvailable(): Promise<boolean> {
    return isKwinAvailable();
  }

  async adjustOpacity(
    step: number,
    min: number,
    max: number
  ): Promise<AdjustResult> {
    return runKwinScript(
      { extensionPath: this.context.extensionPath },
      { step, min, max }
    );
  }
}
