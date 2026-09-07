import type { DetectResult } from "./backends/types";

export function unsupportedMessage(detected: DetectResult): string {
  switch (detected.desktop) {
    case "gnome":
      return "GNOME Wayland is not supported yet. Mutter has no external opacity API.";
    case "hyprland":
      return "Hyprland support is coming in a future release.";
    case "kde":
      return "KDE Plasma detected but the opacity backend is unavailable.";
    default:
      return "Diffuse supports KDE Plasma Wayland only in this release.";
  }
}

export function statusBarTooltip(
  detected: DetectResult,
  opacityPct?: number
): string {
  if (!detected.supported) {
    return unsupportedMessage(detected);
  }
  return `Window opacity ${opacityPct ?? 100}% on ${detected.displayName}`;
}
