import type { OpacityBackend } from "./types";

export class GnomeBackend implements OpacityBackend {
  readonly id = "gnome" as const;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async adjustOpacity(): Promise<never> {
    throw new Error(
      "GNOME Wayland is not supported yet. Mutter has no external opacity API."
    );
  }
}
