import * as path from "path";
import { runtimeDir } from "../../runtime-paths";
import { firstAvailableCommand } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import { PowerShellSession } from "./powershell-session";

/**
 * GlassIt-VSC's Windows path: one PowerShell process, C# loaded once, each
 * keypress is `[Diffuse.SetOpacity]::Apply(pid, alpha)` against this editor.
 */
export class WindowsBackend implements OpacityBackend {
  readonly id = "windows" as const;
  readonly displayName = "Windows";

  private shell?: string;
  private session?: PowerShellSession;
  private ready = false;

  constructor(private readonly extensionPath: string) {}

  async isAvailable(): Promise<Availability> {
    if (process.platform !== "win32") {
      return unavailable("Not a Windows session");
    }

    try {
      await this.ensureSession();
      return available();
    } catch (error) {
      return unavailable(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  async apply(value: number): Promise<ApplyResult> {
    const session = await this.ensureSession();
    const alpha = Math.max(1, Math.min(255, Math.round(value * 255)));
    const reply = await session.invoke(
      `[Diffuse.SetOpacity]::Apply(${process.pid}, ${alpha})`
    );

    if (reply.includes("no-process") || reply.includes("no-window")) {
      throw new Error("No editor window found");
    }
    if (reply.toLowerCase().includes("error") || !reply.includes("ok")) {
      throw new Error(reply || "Failed to set window opacity");
    }

    return { value, target: String(process.pid) };
  }

  dispose(): void {
    this.session?.dispose();
    this.session = undefined;
    this.ready = false;
  }

  private async ensureSession(): Promise<PowerShellSession> {
    if (this.session && this.ready) {
      return this.session;
    }

    const shell = await this.resolveShell();
    if (!shell) {
      throw new Error("PowerShell not found on PATH");
    }

    const session = this.session ?? new PowerShellSession();
    this.session = session;
    await session.start(shell);

    const csPath = path.join(runtimeDir(this.extensionPath, "win"), "SetOpacity.cs");
    const escaped = csPath.replace(/'/g, "''");
    const load = await session.invoke(`Add-Type -Path '${escaped}'`);
    if (/error/i.test(load)) {
      throw new Error(load || "Add-Type failed to load SetOpacity.cs");
    }

    this.ready = true;
    return session;
  }

  private async resolveShell(): Promise<string | null> {
    if (!this.shell) {
      this.shell =
        (await firstAvailableCommand(["powershell", "pwsh"])) ?? undefined;
    }
    return this.shell ?? null;
  }
}
