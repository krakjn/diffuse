export type Platform = "linux" | "windows" | "macos";

export type Session = "wayland" | "x11" | "native" | "unknown";

export type BackendId =
  | "kde"
  | "hyprland"
  | "sway"
  | "x11"
  | "gnome"
  | "windows"
  | "macos";

export interface DetectResult {
  platform: Platform;
  session: Session;
  desktop: string;
  candidates: BackendId[];
}

/** Why a backend can or cannot drive this session. */
export interface Availability {
  ok: boolean;
  reason?: string;
}

export interface ApplyResult {
  value: number;
  target?: string;
}

export interface OpacityBackend {
  readonly id: BackendId;
  readonly displayName: string;
  isAvailable(): Promise<Availability>;
  /** Set absolute opacity. The caller has already clamped `value`. */
  apply(value: number): Promise<ApplyResult>;
  /** Read back the live value, when the compositor exposes one. */
  read?(): Promise<number | null>;
}

export function available(): Availability {
  return { ok: true };
}

export function unavailable(reason: string): Availability {
  return { ok: false, reason };
}
