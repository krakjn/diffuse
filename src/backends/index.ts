import type { ExtensionContext } from "vscode";
import { createUnsupportedBackend } from "./unsupported";
import { KdeBackend } from "./kde/kde";
import { BackendRegistry } from "./registry";

export function createBackendRegistry(
  context: ExtensionContext
): BackendRegistry {
  const registry = new BackendRegistry();
  registry.register(new KdeBackend(context));
  registry.register(
    createUnsupportedBackend(
      "gnome",
      "GNOME Wayland is not supported yet. Mutter has no external opacity API."
    )
  );
  registry.register(
    createUnsupportedBackend(
      "hyprland",
      "Hyprland support is coming in a future release."
    )
  );
  return registry;
}
