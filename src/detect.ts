import type {
  BackendId,
  DetectResult,
  Platform,
  Session,
} from "./backends/types";

interface LinuxDesktopSpec {
  displayName: string;
  detect: () => boolean;
  /** Ordered candidates when this desktop runs on Wayland. */
  wayland: BackendId[];
  /** Why Diffuse should stay out of the way on this compositor. */
  skipReason?: string;
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

/**
 * Wayland compositors with a native opacity API, each falling back to `x11`
 * because Electron frequently runs through XWayland.
 */
const LINUX_DESKTOPS: LinuxDesktopSpec[] = [
  {
    displayName: "Hyprland",
    detect: () => !!process.env.HYPRLAND_INSTANCE_SIGNATURE,
    wayland: [],
    skipReason:
      "Hyprland already manages window opacity; Diffuse does not override it.",
  },
  {
    displayName: "Sway",
    detect: () => !!process.env.SWAYSOCK || tokensInclude("sway"),
    wayland: ["sway", "x11"],
  },
  {
    displayName: "KDE Plasma",
    detect: () => tokensInclude("kde", "plasma"),
    wayland: ["kde", "x11"],
  },
  {
    // Mutter honours _NET_WM_WINDOW_OPACITY for XWayland clients, so xprop
    // covers most GNOME users without the companion Shell extension.
    displayName: "GNOME",
    detect: () => tokensInclude("gnome", "ubuntu"),
    wayland: ["x11", "gnome"],
  },
];

function detectLinuxDesktop(): LinuxDesktopSpec | null {
  return LINUX_DESKTOPS.find((desktop) => desktop.detect()) ?? null;
}

function detectLinuxSession(): Session {
  const sessionType = (process.env.XDG_SESSION_TYPE ?? "").toLowerCase();
  if (sessionType === "wayland") {
    return "wayland";
  }
  if (sessionType === "x11") {
    return "x11";
  }
  if (process.env.WAYLAND_DISPLAY) {
    return "wayland";
  }
  if (process.env.DISPLAY) {
    return "x11";
  }
  return "unknown";
}

function detectPlatform(): Platform {
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "macos";
    default:
      return "linux";
  }
}

function describeLinux(desktop: LinuxDesktopSpec | null, session: Session) {
  const name = desktop?.displayName ?? "Unknown desktop";
  switch (session) {
    case "wayland":
      return `${name} (Wayland)`;
    case "x11":
      return `${name} (X11)`;
    default:
      return name;
  }
}

export function detectEnvironment(): DetectResult {
  const platform = detectPlatform();

  if (platform === "windows") {
    return {
      platform,
      session: "native",
      desktop: "Windows",
      candidates: ["windows"],
    };
  }

  if (platform === "macos") {
    return {
      platform,
      session: "native",
      desktop: "macOS",
      candidates: ["macos"],
    };
  }

  const session = detectLinuxSession();
  const desktop = detectLinuxDesktop();

  let candidates: BackendId[];
  if (session === "wayland") {
    candidates = desktop?.wayland ?? ["x11"];
  } else if (session === "x11") {
    candidates = ["x11"];
  } else {
    candidates = [];
  }

  return {
    platform,
    session,
    desktop: describeLinux(desktop, session),
    candidates,
    skipReason:
      session === "wayland" && candidates.length === 0
        ? desktop?.skipReason
        : undefined,
  };
}

/**
 * Ordered backends to probe. An explicit `diffuse.backend` wins over detection
 * so users can override a bad guess.
 */
export function resolveCandidates(
  configured: string,
  detected: DetectResult
): BackendId[] {
  if (configured !== "auto") {
    return [configured as BackendId];
  }
  return detected.candidates;
}

export function getDetectionSummary(detected: DetectResult): string {
  const candidates = detected.candidates.join(" > ") || "none";
  return `platform=${detected.platform} session=${detected.session} desktop=${detected.desktop} candidates=${candidates}`;
}
