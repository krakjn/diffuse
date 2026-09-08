import { MACOS_SETUP_DOC } from "../../messages";
import { matchesEditorExecutable } from "../../targets";
import { commandExists, tryExec } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";

interface YabaiWindow {
  id?: number;
  app?: string;
  title?: string;
  opacity?: number;
  "has-focus"?: boolean;
}

const SETUP_HINT = `See ${MACOS_SETUP_DOC} for the opt-in setup.`;

/**
 * macOS has no public API for another application's window alpha, so Diffuse
 * delegates to yabai when the user has chosen to set it up. Diffuse never
 * installs, loads, or configures yabai, and never touches SIP.
 */
export class MacosBackend implements OpacityBackend {
  readonly id = "macos" as const;
  readonly displayName = "yabai";

  async isAvailable(): Promise<Availability> {
    if (process.platform !== "darwin") {
      return unavailable("Not a macOS session");
    }
    if (!(await commandExists("yabai"))) {
      return unavailable(
        `macOS window opacity requires yabai, which is not installed. ${SETUP_HINT}`
      );
    }

    const probe = await tryExec("yabai", ["-m", "query", "--windows"]);
    if (!probe.ok) {
      return unavailable(
        `yabai is installed but not responding: ${probe.stderr || "unknown error"}. ${SETUP_HINT}`
      );
    }

    if (!(await this.findWindow())) {
      return unavailable("yabai reports no editor window");
    }

    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const window = await this.findWindow();
    if (!window || typeof window.id !== "number") {
      throw new Error("yabai reports no editor window");
    }

    const result = await tryExec("yabai", [
      "-m",
      "window",
      String(window.id),
      "--opacity",
      value.toFixed(3),
    ]);

    if (!result.ok) {
      const detail = result.stderr || "yabai rejected the opacity command";
      throw new Error(
        `${detail}. Window opacity needs the yabai scripting addition with SIP partially disabled. ${SETUP_HINT}`
      );
    }

    return { value, target: window.app };
  }

  async read(): Promise<number | null> {
    const window = await this.findWindow();
    return typeof window?.opacity === "number" ? window.opacity : null;
  }

  private async findWindow(): Promise<YabaiWindow | null> {
    const focused = await this.query(["-m", "query", "--windows", "--window"]);
    const focusedWindow = Array.isArray(focused) ? focused[0] : focused;
    if (focusedWindow && matchesEditorExecutable(focusedWindow.app)) {
      return focusedWindow;
    }

    const all = await this.query(["-m", "query", "--windows"]);
    if (!Array.isArray(all)) {
      return null;
    }

    return (
      all.find(
        (window) =>
          matchesEditorExecutable(window.app) && window["has-focus"] === true
      ) ??
      all.find((window) => matchesEditorExecutable(window.app)) ??
      null
    );
  }

  private async query(
    args: string[]
  ): Promise<YabaiWindow | YabaiWindow[] | null> {
    const result = await tryExec("yabai", args);
    if (!result.ok) {
      return null;
    }
    try {
      return JSON.parse(result.stdout) as YabaiWindow | YabaiWindow[];
    } catch {
      return null;
    }
  }
}
