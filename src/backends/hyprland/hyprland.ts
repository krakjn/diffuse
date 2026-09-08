import { matchesEditorClass } from "../../targets";
import { commandExists, tryExec } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import { accepted, DIALECTS, type HyprDialect } from "./dialect";

interface HyprWindow {
  address?: string;
  class?: string;
  title?: string;
}

export class HyprlandBackend implements OpacityBackend {
  readonly id = "hyprland" as const;
  readonly displayName = "Hyprland";

  private dialect?: HyprDialect;

  async isAvailable(): Promise<Availability> {
    if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) {
      return unavailable("Not a Hyprland session");
    }
    if (!(await commandExists("hyprctl"))) {
      return unavailable("hyprctl not found");
    }

    const window = await this.activeWindow();
    if (!window) {
      return unavailable("hyprctl could not report the active window");
    }
    if (!matchesEditorClass(window.class)) {
      return unavailable(
        `Focused window is not an editor (class: ${window.class ?? "unknown"})`
      );
    }

    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const window = await this.activeWindow();
    if (!window || !matchesEditorClass(window.class)) {
      throw new Error(
        `Focused window is not an editor (class: ${window?.class ?? "unknown"})`
      );
    }

    const dialect = await this.resolveDialect(value);
    if (!dialect) {
      throw new Error(
        "hyprctl rejected every known opacity syntax; check `hyprctl dispatch setprop active opacity 0.9`"
      );
    }

    return { value, target: window.class };
  }

  async read(): Promise<number | null> {
    const dialect = this.dialect ?? DIALECTS[0];
    const args = dialect.readArgs();
    if (!args) {
      return null;
    }
    const result = await tryExec("hyprctl", args);
    if (!result.ok) {
      return null;
    }
    const parsed = Number.parseFloat(result.stdout.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Run the cached dialect, or probe each one until hyprctl accepts. */
  private async resolveDialect(value: number): Promise<HyprDialect | null> {
    const ordered = this.dialect
      ? [this.dialect, ...DIALECTS.filter((entry) => entry !== this.dialect)]
      : DIALECTS;

    for (const dialect of ordered) {
      if (await this.runDialect(dialect, value)) {
        this.dialect = dialect;
        return dialect;
      }
    }

    this.dialect = undefined;
    return null;
  }

  private async runDialect(
    dialect: HyprDialect,
    value: number
  ): Promise<boolean> {
    for (const args of dialect.setArgs(value)) {
      const result = await tryExec("hyprctl", args);
      if (!accepted(result)) {
        return false;
      }
    }
    return true;
  }

  private async activeWindow(): Promise<HyprWindow | null> {
    const result = await tryExec("hyprctl", ["activewindow", "-j"]);
    if (!result.ok) {
      return null;
    }
    try {
      const parsed = JSON.parse(result.stdout) as HyprWindow;
      return parsed.address ? parsed : null;
    } catch {
      return null;
    }
  }
}
