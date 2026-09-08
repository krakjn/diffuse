import { EDITOR_CLASSES, matchesEditorClass } from "../../targets";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import { kwinScriptingReachable, runKwinScript } from "./kwin-runner";

interface KwinWindow {
  resourceClass?: string;
  caption?: string;
  opacity?: number;
  active?: boolean;
  before?: number;
  after?: number;
}

function parseWindows(lines: string[]): KwinWindow[] {
  const windows: KwinWindow[] = [];
  for (const line of lines) {
    if (line.startsWith("ERROR:")) {
      throw new Error(line.slice("ERROR:".length).trim());
    }
    try {
      windows.push(JSON.parse(line) as KwinWindow);
    } catch {
      continue;
    }
  }
  return windows;
}

export class KdeBackend implements OpacityBackend {
  readonly id = "kde" as const;
  readonly displayName = "KWin";

  constructor(private readonly extensionPath: string) {}

  async isAvailable(): Promise<Availability> {
    if ((process.env.XDG_SESSION_TYPE ?? "").toLowerCase() !== "wayland") {
      return unavailable("KWin backend needs a Wayland session");
    }
    const problem = await kwinScriptingReachable();
    return problem ? unavailable(problem) : available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const lines = await runKwinScript(this.extensionPath, "set-opacity.js", {
      value,
      classes: EDITOR_CLASSES,
    });

    const results = parseWindows(lines).filter(
      (entry) => typeof entry.after === "number"
    );
    const last = results[results.length - 1];
    if (!last) {
      throw new Error("KWin script produced no output");
    }

    return { value: last.after as number, target: last.resourceClass };
  }

  async read(): Promise<number | null> {
    const lines = await runKwinScript(this.extensionPath, "list-windows.js", {
      value: 1,
      classes: EDITOR_CLASSES,
    });

    const editors = parseWindows(lines).filter((entry) =>
      matchesEditorClass(entry.resourceClass)
    );
    const target = editors.find((entry) => entry.active) ?? editors[0];
    return typeof target?.opacity === "number" ? target.opacity : null;
  }
}
