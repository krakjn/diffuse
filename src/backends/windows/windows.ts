import * as path from "path";
import { runtimeDir } from "../../runtime-paths";
import { EDITOR_EXECUTABLES } from "../../targets";
import { firstAvailableCommand, tryExec } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";

interface ScriptResult {
  ok: boolean;
  message?: string;
  process?: string;
  alpha?: number | null;
  value?: number;
}

/** PowerShell can print warnings before the payload; the JSON is the last line. */
function parseResult(stdout: string): ScriptResult | null {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines.reverse()) {
    try {
      return JSON.parse(line) as ScriptResult;
    } catch {
      continue;
    }
  }
  return null;
}

export class WindowsBackend implements OpacityBackend {
  readonly id = "windows" as const;
  readonly displayName = "Windows";

  private shell?: string;

  constructor(private readonly extensionPath: string) {}

  async isAvailable(): Promise<Availability> {
    if (process.platform !== "win32") {
      return unavailable("Not a Windows session");
    }

    const shell = await this.resolveShell();
    if (!shell) {
      return unavailable("PowerShell not found on PATH");
    }

    const result = await this.runScript(["-Probe"]);
    if (!result.ok) {
      return unavailable(result.message ?? "PowerShell probe failed");
    }

    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const result = await this.runScript(["-Value", value.toFixed(3)]);
    if (!result.ok) {
      throw new Error(result.message ?? "Failed to set window opacity");
    }
    return { value, target: result.process };
  }

  async read(): Promise<number | null> {
    const result = await this.runScript(["-Probe"]);
    if (!result.ok || typeof result.alpha !== "number") {
      return null;
    }
    return result.alpha / 255;
  }

  private async resolveShell(): Promise<string | null> {
    if (!this.shell) {
      this.shell =
        (await firstAvailableCommand(["powershell", "pwsh"])) ?? undefined;
    }
    return this.shell ?? null;
  }

  private async runScript(extraArgs: string[]): Promise<ScriptResult> {
    const shell = await this.resolveShell();
    if (!shell) {
      return { ok: false, message: "PowerShell not found on PATH" };
    }

    const scriptPath = path.join(
      runtimeDir(this.extensionPath, "win"),
      "set-opacity.ps1"
    );
    const result = await tryExec(shell, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-Processes",
      EDITOR_EXECUTABLES.join(","),
      ...extraArgs,
    ]);

    const parsed = parseResult(result.stdout);
    if (parsed) {
      return parsed;
    }

    return {
      ok: false,
      message: result.stderr || "PowerShell produced no output",
    };
  }
}
