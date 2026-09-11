import { matchesEditorClass } from "../../targets";
import { commandExists, tryExec } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";

const MIN_MAJOR = 0;
const MIN_MINOR = 55;

const OPACITY_PROPS = [
  "opacity_override",
  "opacity",
  "opacity_inactive_override",
  "opacity_inactive",
  "opacity_fullscreen_override",
  "opacity_fullscreen",
] as const;

interface HyprlandWindow {
  address?: string;
  class?: string;
  initialClass?: string;
}

interface HyprlandVersion {
  tag?: string;
  version?: string;
}

interface HyprlandOption {
  float?: number;
}

function luaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function setPropCall(prop: string, value: string, window: string): string {
  return `hl.dispatch(hl.dsp.window.set_prop({ prop = "${luaString(prop)}", value = "${luaString(value)}", window = "${luaString(window)}" }))`;
}

/** Parse `v0.55.0` / `0.55.0-12-gabcdef` from `hyprctl version -j`. */
export function parseHyprlandVersion(
  raw: string
): { major: number; minor: number } | null {
  const match = raw.match(/v?(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export function isHyprlandSupported(version: {
  major: number;
  minor: number;
}): boolean {
  return (
    version.major > MIN_MAJOR ||
    (version.major === MIN_MAJOR && version.minor >= MIN_MINOR)
  );
}

function windowSelector(address: string): string {
  return address.startsWith("address:")
    ? address
    : `address:${address.startsWith("0x") ? address : `0x${address}`}`;
}

function windowClass(win: HyprlandWindow): string | undefined {
  return win.class || win.initialClass || undefined;
}

export class HyprlandBackend implements OpacityBackend {
  readonly id = "hyprland" as const;
  readonly displayName = "Hyprland";

  private configDefault?: number;

  async isAvailable(): Promise<Availability> {
    if (!process.env.HYPRLAND_INSTANCE_SIGNATURE) {
      return unavailable("Not a Hyprland session (HYPRLAND_INSTANCE_SIGNATURE is unset)");
    }
    if (!(await commandExists("hyprctl"))) {
      return unavailable("hyprctl not found");
    }

    const version = await this.readVersion();
    if (!version) {
      return unavailable("Could not read Hyprland version");
    }
    if (!isHyprlandSupported(version)) {
      return unavailable("Hyprland 0.55+ with Lua dispatchers required");
    }

    const target = await this.focusedEditor();
    if (!target) {
      return unavailable("The focused Hyprland window is not an editor window");
    }

    return available();
  }

  async ensureReady(): Promise<void> {
    this.configDefault = (await this.readDecorationDefault()) ?? undefined;
  }

  async apply(value: number): Promise<ApplyResult> {
    const target = await this.focusedEditor();
    if (!target) {
      throw new Error("The focused Hyprland window is not an editor window");
    }

    const opacity = value.toFixed(3);
    const script = OPACITY_PROPS.map((prop) =>
      setPropCall(
        prop,
        prop.endsWith("_override") ? "1" : opacity,
        target.selector
      )
    ).join("; ");

    const result = await tryExec("hyprctl", ["eval", script]);
    if (!result.ok || !result.stdout.trim().toLowerCase().includes("ok")) {
      throw new Error(result.stderr || result.stdout || "hyprctl eval set_prop failed");
    }

    return { value, target: target.name };
  }

  async read(): Promise<number | null> {
    const target = await this.focusedEditor();
    if (target) {
      const live = await this.readWindowOpacity(target.selector);
      if (live !== null) {
        return live;
      }
    }
    return this.readDecorationDefault();
  }

  resetTarget(): number | undefined {
    return this.configDefault;
  }

  private async readVersion(): Promise<{ major: number; minor: number } | null> {
    const result = await tryExec("hyprctl", ["-j", "version"]);
    if (!result.ok) {
      return null;
    }

    try {
      const parsed = JSON.parse(result.stdout) as HyprlandVersion;
      return parseHyprlandVersion(parsed.tag ?? parsed.version ?? "");
    } catch {
      return parseHyprlandVersion(result.stdout);
    }
  }

  private async readDecorationDefault(): Promise<number | null> {
    const result = await tryExec("hyprctl", [
      "-j",
      "getoption",
      "decoration.active_opacity",
    ]);
    if (!result.ok) {
      return this.configDefault ?? null;
    }

    try {
      const parsed = JSON.parse(result.stdout) as HyprlandOption;
      if (typeof parsed.float === "number" && Number.isFinite(parsed.float)) {
        this.configDefault = parsed.float;
        return parsed.float;
      }
    } catch {
      // fall through
    }
    return this.configDefault ?? null;
  }

  private async readWindowOpacity(selector: string): Promise<number | null> {
    const result = await tryExec("hyprctl", ["-j", "getprop", selector, "opacity"]);
    if (!result.ok) {
      return null;
    }

    try {
      const parsed = JSON.parse(result.stdout) as unknown;
      if (typeof parsed === "number" && Number.isFinite(parsed)) {
        return parsed;
      }
      if (parsed && typeof parsed === "object" && "float" in parsed) {
        const value = (parsed as HyprlandOption).float;
        return typeof value === "number" && Number.isFinite(value) ? value : null;
      }
    } catch {
      const value = Number(result.stdout.trim());
      return Number.isFinite(value) ? value : null;
    }
    return null;
  }

  private async focusedEditor(): Promise<{
    selector: string;
    name: string;
  } | null> {
    const result = await tryExec("hyprctl", ["-j", "activewindow"]);
    if (!result.ok) {
      return null;
    }

    let win: HyprlandWindow;
    try {
      win = JSON.parse(result.stdout) as HyprlandWindow;
    } catch {
      return null;
    }

    const name = windowClass(win);
    if (!win.address || !matchesEditorClass(name)) {
      return null;
    }

    return { selector: windowSelector(win.address), name: name as string };
  }
}
