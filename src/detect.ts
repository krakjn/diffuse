import type { DetectResult, WaylandDesktop } from "./backends/types";

function envTokens(): string[] {
  const raw = [
    process.env.XDG_CURRENT_DESKTOP,
    process.env.XDG_SESSION_DESKTOP,
    process.env.DESKTOP_SESSION,
  ]
    .filter(Boolean)
    .join(":");

  return raw.toLowerCase().split(":");
}

function tokensInclude(...needles: string[]): boolean {
  const tokens = envTokens();
  return needles.some((needle) =>
    tokens.some((token) => token.includes(needle))
  );
}

function detectDesktop(): WaylandDesktop {
  if (process.env.HYPRLAND_INSTANCE_SIGNATURE) {
    return "hyprland";
  }
  if (tokensInclude("kde", "plasma")) {
    return "kde";
  }
  if (tokensInclude("gnome", "ubuntu")) {
    return "gnome";
  }
  return "unknown";
}

const DISPLAY_NAMES: Record<WaylandDesktop, string> = {
  kde: "KDE Plasma",
  gnome: "GNOME",
  hyprland: "Hyprland",
  unknown: "Unknown",
};

export function detectEnvironment(): DetectResult {
  const sessionType = (process.env.XDG_SESSION_TYPE ?? "unknown").toLowerCase();
  const session =
    sessionType === "wayland"
      ? "wayland"
      : sessionType === "x11"
        ? "x11"
        : "unknown";

  const desktop = detectDesktop();
  const displayName = DISPLAY_NAMES[desktop];

  let backendId: DetectResult["backendId"] = null;
  let supported = false;

  if (session === "wayland") {
    if (desktop === "kde") {
      backendId = "kde";
      supported = true;
    } else if (desktop === "gnome") {
      backendId = "gnome";
    } else if (desktop === "hyprland") {
      backendId = "hyprland";
    }
  }

  return { session, desktop, backendId, supported, displayName };
}

export function resolveBackendId(configured: string, detected: DetectResult): string | null {
  if (configured !== "auto") {
    return configured;
  }
  return detected.backendId;
}
