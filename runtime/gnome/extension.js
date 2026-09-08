// Companion GNOME Shell extension for Diffuse.
//
// Mutter exposes no external opacity API and Shell.Eval has been locked since
// GNOME 41, so native-Wayland Electron windows can only be dimmed from inside
// the Shell process. This extension is that inside.

import Gio from "gi://Gio";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const OBJECT_PATH = "/org/gnome/Shell/Extensions/Diffuse";

const INTERFACE = `
<node>
  <interface name="org.gnome.Shell.Extensions.Diffuse">
    <method name="SetOpacity">
      <arg type="s" direction="in" name="classes"/>
      <arg type="d" direction="in" name="value"/>
      <arg type="s" direction="out" name="result"/>
    </method>
    <method name="GetOpacity">
      <arg type="s" direction="in" name="classes"/>
      <arg type="d" direction="out" name="value"/>
    </method>
  </interface>
</node>`;

function parseClasses(classes) {
  return String(classes ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export default class DiffuseExtension extends Extension {
  enable() {
    this._dbus = Gio.DBusExportedObject.wrapJSObject(INTERFACE, this);
    this._dbus.export(Gio.DBus.session, OBJECT_PATH);
  }

  disable() {
    this._dbus?.unexport();
    this._dbus = null;
  }

  /** Focused editor window actor, falling back to any editor window. */
  _findActor(classes) {
    const wanted = parseClasses(classes);
    let fallback = null;

    for (const actor of global.get_window_actors()) {
      const win = actor.meta_window;
      if (!win) {
        continue;
      }

      const wmClass = (win.get_wm_class() ?? "").toLowerCase();
      if (!wanted.includes(wmClass)) {
        continue;
      }

      if (win.has_focus()) {
        return actor;
      }
      if (!fallback) {
        fallback = actor;
      }
    }

    return fallback;
  }

  SetOpacity(classes, value) {
    const actor = this._findActor(classes);
    if (!actor) {
      return JSON.stringify({ ok: false, message: "no editor window found" });
    }

    const clamped = Math.max(0, Math.min(1, value));
    actor.opacity = Math.round(clamped * 255);

    return JSON.stringify({
      ok: true,
      value: clamped,
      target: actor.meta_window.get_wm_class(),
    });
  }

  GetOpacity(classes) {
    const actor = this._findActor(classes);
    return actor ? actor.opacity / 255 : -1;
  }
}
