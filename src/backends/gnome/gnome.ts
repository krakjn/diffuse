import { EDITOR_CLASSES } from "../../targets";
import { commandExists, tryExec } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import { isGnomeExtensionInstalled } from "./install";

const DESTINATION = "org.gnome.Shell";
const OBJECT_PATH = "/org/gnome/Shell/Extensions/Diffuse";
const INTERFACE = "org.gnome.Shell.Extensions.Diffuse";

const INSTALL_HINT =
  "GNOME Wayland needs the companion Shell extension. Run 'Diffuse: Install GNOME Shell Extension', enable it, then log out and back in.";

interface SetOpacityReply {
  ok: boolean;
  message?: string;
  value?: number;
  target?: string;
}

/** gdbus prints replies as a tuple, e.g. `('{"ok":true}',)` or `(0.85,)`. */
function unwrapTuple(stdout: string): string | null {
  const match = stdout.trim().match(/^\((.*),?\s*\)$/s);
  if (!match) {
    return null;
  }
  return match[1].replace(/,\s*$/, "").trim();
}

function unwrapString(stdout: string): string | null {
  const inner = unwrapTuple(stdout);
  if (!inner) {
    return null;
  }
  const quoted = inner.match(/^'(.*)'$/s);
  return quoted ? quoted[1] : inner;
}

/**
 * GNOME Wayland backend.
 *
 * Only reachable when the companion Shell extension is installed and enabled;
 * most GNOME users are served by the x11 backend through XWayland instead.
 */
export class GnomeBackend implements OpacityBackend {
  readonly id = "gnome" as const;
  readonly displayName = "GNOME Shell";

  async isAvailable(): Promise<Availability> {
    if (!(await commandExists("gdbus"))) {
      return unavailable("gdbus not found (install glib2 tools)");
    }

    const reply = await this.call("GetOpacity", [EDITOR_CLASSES.join(",")]);
    if (!reply.ok) {
      const installed = await isGnomeExtensionInstalled();
      return unavailable(
        installed
          ? "The Diffuse GNOME Shell extension is installed but not enabled; enable it and restart your session"
          : INSTALL_HINT
      );
    }

    const value = Number.parseFloat(unwrapTuple(reply.stdout) ?? "");
    if (value < 0) {
      return unavailable("The GNOME Shell extension reports no editor window");
    }

    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const reply = await this.call("SetOpacity", [
      EDITOR_CLASSES.join(","),
      value.toFixed(3),
    ]);

    if (!reply.ok) {
      throw new Error(reply.stderr || INSTALL_HINT);
    }

    const payload = unwrapString(reply.stdout);
    if (!payload) {
      throw new Error("Unexpected reply from the GNOME Shell extension");
    }

    let parsed: SetOpacityReply;
    try {
      parsed = JSON.parse(payload) as SetOpacityReply;
    } catch {
      throw new Error("Unexpected reply from the GNOME Shell extension");
    }

    if (!parsed.ok) {
      throw new Error(parsed.message ?? "GNOME Shell rejected the opacity call");
    }

    return { value, target: parsed.target };
  }

  async read(): Promise<number | null> {
    const reply = await this.call("GetOpacity", [EDITOR_CLASSES.join(",")]);
    if (!reply.ok) {
      return null;
    }
    const value = Number.parseFloat(unwrapTuple(reply.stdout) ?? "");
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  private call(method: string, args: string[]) {
    return tryExec("gdbus", [
      "call",
      "--session",
      "--dest",
      DESTINATION,
      "--object-path",
      OBJECT_PATH,
      "--method",
      `${INTERFACE}.${method}`,
      ...args,
    ]);
  }
}
