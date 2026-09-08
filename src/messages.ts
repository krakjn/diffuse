import type { DetectResult } from "./backends/types";

export const MACOS_SETUP_DOC =
  "https://github.com/krakjn/diffuse#macos-opt-in";

/** Shown when no candidate backend reported itself available. */
export function noBackendMessage(detected: DetectResult): string {
  if (detected.candidates.length === 0) {
    return `No opacity backend for ${detected.desktop}. Diffuse needs a Wayland compositor with an opacity API, an X11 session, Windows, or macOS with yabai.`;
  }
  return `No usable opacity backend for ${detected.desktop}.`;
}

export function statusBarTooltip(
  detected: DetectResult,
  backendName: string | null,
  opacityPct?: number
): string {
  if (!backendName) {
    return noBackendMessage(detected);
  }
  return `Window opacity ${opacityPct ?? 100}% via ${backendName} on ${detected.desktop}`;
}
