import { GnomeBackend } from "./gnome/gnome";
import { HyprlandBackend } from "./hyprland/hyprland";
import { KdeBackend } from "./kde/kde";
import { MacosBackend } from "./macos/macos";
import { BackendRegistry } from "./registry";
import { SwayBackend } from "./sway/sway";
import { WindowsBackend } from "./windows/windows";
import { X11Backend } from "./x11/x11";

/** Single registration point. Adding a platform means one line here. */
export function createBackendRegistry(extensionPath: string): BackendRegistry {
  const registry = new BackendRegistry();

  registry.register(new KdeBackend(extensionPath));
  registry.register(new HyprlandBackend());
  registry.register(new SwayBackend());
  registry.register(new X11Backend());
  registry.register(new GnomeBackend());
  registry.register(new WindowsBackend(extensionPath));
  registry.register(new MacosBackend());

  return registry;
}
