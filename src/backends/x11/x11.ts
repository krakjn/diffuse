import { commandExists } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import {
  compositorProblem,
  findActiveWindow,
  isEditorWindow,
  readWindowOpacity,
  readWmClass,
  setWindowOpacity,
} from "./xprop";

/**
 * Generic X11 backend.
 *
 * Covers every X11 desktop and, through XWayland, most Electron windows on
 * Wayland compositors that have no opacity API of their own.
 */
export class X11Backend implements OpacityBackend {
  readonly id = "x11" as const;
  readonly displayName = "X11";

  async isAvailable(): Promise<Availability> {
    if (!process.env.DISPLAY) {
      return unavailable("No X display (DISPLAY is unset)");
    }
    if (!(await commandExists("xprop"))) {
      return unavailable("xprop not found (install x11-utils or xorg-xprop)");
    }

    const compositing = await compositorProblem();
    if (compositing) {
      return unavailable(compositing);
    }

    const windowId = await findActiveWindow();
    if (!windowId) {
      return unavailable("Could not read the active X11 window");
    }
    if (!(await isEditorWindow(windowId))) {
      return unavailable("The focused X11 window is not an editor window");
    }

    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const windowId = await this.requireEditorWindow();
    await setWindowOpacity(windowId, value);
    return { value, target: windowId };
  }

  async read(): Promise<number | null> {
    const windowId = await findActiveWindow();
    if (!windowId || !(await isEditorWindow(windowId))) {
      return null;
    }
    return readWindowOpacity(windowId);
  }

  private async requireEditorWindow(): Promise<string> {
    const windowId = await findActiveWindow();
    if (!windowId) {
      throw new Error("Could not read the active X11 window");
    }
    if (!(await isEditorWindow(windowId))) {
      const classes = await readWmClass(windowId);
      const seen = classes.join(", ") || "unknown";
      throw new Error(`Focused window is not an editor (WM_CLASS: ${seen})`);
    }
    return windowId;
  }
}
