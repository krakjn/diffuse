import type { DetectResult } from "./backends/types";

export function unsupportedMessage(detected: DetectResult): string {
  switch (detected.desktop) {
    case "gnome":
      return "Diffuse does not support GNOME Wayland yet. Mutter has no external opacity API.";
    case "hyprland":
      return "Hyprland support is coming in a future release.";
    case "kde":
      return "KDE Plasma detected but the KWin backend is unavailable.";
    default:
      return "Diffuse supports KDE Plasma Wayland only in this release.";
  }
}
