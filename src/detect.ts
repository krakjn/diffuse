import type { BackendId, DetectResult, WaylandDesktop } from "./backends/types";

interface DesktopSpec {
  id: WaylandDesktop;
  displayName: string;
  detect: () => boolean;
  supported: boolean;
}

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

const DESKTOPS: DesktopSpec[] = [
  {
    id: "hyprland",
    displayName: "Hyprland",
    detect: () => !!process.env.HYPRLAND_INSTANCE_SIGNATURE,
    supported: false,
  },
  {
    id: "kde",
    displayName: "KDE Plasma",
    detect: () => tokensInclude("kde", "plasma"),
    supported: true,
  },
  {
    id: "gnome",
    displayName: "GNOME",
    detect: () => tokensInclude("gnome", "ubuntu"),
    supported: false,
  },
];

function detectDesktop(): DesktopSpec {
  for (const desktop of DESKTOPS) {
    if (desktop.detect()) {
      return desktop;
    }
  }
  return {
    id: "unknown",
    displayName: "Unknown",
    detect: () => false,
    supported: false,
  };
}

export function detectEnvironment(): DetectResult {
  const sessionType = (process.env.XDG_SESSION_TYPE ?? "unknown").toLowerCase();
  const session =
    sessionType === "wayland"
      ? "wayland"
      : sessionType === "x11"
        ? "x11"
        : "unknown";

  const desktop = detectDesktop();
  let backendId: BackendId | null = null;
  let supported = false;

  if (session === "wayland" && desktop.id !== "unknown") {
    backendId = desktop.id as BackendId;
    supported = desktop.supported;
  }

  return {
    session,
    desktop: desktop.id,
    backendId,
    supported,
    displayName: desktop.displayName,
  };
}

export function resolveBackendId(
  configured: string,
  detected: DetectResult
): string | null {
  if (configured !== "auto") {
    return configured;
  }
  return detected.backendId;
}
