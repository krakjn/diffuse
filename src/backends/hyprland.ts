import type { OpacityBackend } from "./types";

export class HyprlandBackend implements OpacityBackend {
  readonly id = "hyprland" as const;

  async isAvailable(): Promise<boolean> {
    return false;
  }

  async adjustOpacity(): Promise<never> {
    throw new Error("Hyprland support is coming in a future release.");
  }
}
