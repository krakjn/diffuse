import { anyProcessRunning, commandExists, tryExec } from "../../util/exec";
import { matchesEditorClass } from "../../targets";

const OPACITY_PROPERTY = "_NET_WM_WINDOW_OPACITY";
const OPAQUE = 0xffffffff;

/**
 * Compositors that honour _NET_WM_WINDOW_OPACITY. Without one the property is
 * set successfully and then silently ignored, which looks like a Diffuse bug.
 */
const COMPOSITORS = [
  "picom",
  "compton",
  "xcompmgr",
  "kwin_x11",
  "kwin_wayland",
  "mutter",
  "gnome-shell",
  "xfwm4",
  "compiz",
  "marco",
  "muffin",
  "cinnamon",
  "deepin-wm",
  "budgie-wm",
];

export function toCardinal(value: number): number {
  return Math.round(value * OPAQUE);
}

export function fromCardinal(cardinal: number): number {
  return cardinal / OPAQUE;
}

/** Active window id as an X11 hex string, or null. */
export async function findActiveWindow(): Promise<string | null> {
  if (await commandExists("xdotool")) {
    const result = await tryExec("xdotool", ["getactivewindow"]);
    const decimal = Number.parseInt(result.stdout.trim(), 10);
    if (result.ok && Number.isFinite(decimal) && decimal > 0) {
      return `0x${decimal.toString(16)}`;
    }
  }

  const root = await tryExec("xprop", ["-root", "-notype", "_NET_ACTIVE_WINDOW"]);
  if (!root.ok) {
    return null;
  }
  const match = root.stdout.match(/0x[0-9a-fA-F]+/);
  return match ? match[0] : null;
}

export async function readWmClass(windowId: string): Promise<string[]> {
  const result = await tryExec("xprop", ["-id", windowId, "-notype", "WM_CLASS"]);
  if (!result.ok) {
    return [];
  }
  const matches = result.stdout.match(/"([^"]*)"/g) ?? [];
  return matches.map((entry) => entry.replace(/"/g, "").toLowerCase());
}

export async function isEditorWindow(windowId: string): Promise<boolean> {
  const classes = await readWmClass(windowId);
  return classes.some((entry) => matchesEditorClass(entry));
}

export async function setWindowOpacity(
  windowId: string,
  value: number
): Promise<void> {
  const result = await tryExec("xprop", [
    "-id",
    windowId,
    "-f",
    OPACITY_PROPERTY,
    "32c",
    "-set",
    OPACITY_PROPERTY,
    String(toCardinal(value)),
  ]);

  if (!result.ok) {
    throw new Error(result.stderr || `xprop failed to set ${OPACITY_PROPERTY}`);
  }
}

export async function readWindowOpacity(
  windowId: string
): Promise<number | null> {
  const result = await tryExec("xprop", [
    "-id",
    windowId,
    "-notype",
    OPACITY_PROPERTY,
  ]);
  if (!result.ok) {
    return null;
  }
  const match = result.stdout.match(/=\s*(\d+)/);
  if (!match) {
    return null;
  }
  return fromCardinal(Number.parseInt(match[1], 10));
}

/** A human-readable problem, or null when compositing looks fine. */
export async function compositorProblem(): Promise<string | null> {
  // Under XWayland the Wayland compositor is always compositing.
  if (process.env.WAYLAND_DISPLAY) {
    return null;
  }

  const running = await anyProcessRunning(COMPOSITORS);
  if (running === null || running) {
    return null;
  }

  return "No compositing manager detected. X11 opacity needs one (picom, xcompmgr, or your desktop's built-in compositor).";
}
