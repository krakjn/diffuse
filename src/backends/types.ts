export type BackendId = "kde" | "gnome" | "hyprland";

export type WaylandDesktop = BackendId | "unknown";

export interface DetectResult {
  session: "wayland" | "x11" | "unknown";
  desktop: WaylandDesktop;
  backendId: BackendId | null;
  supported: boolean;
  displayName: string;
}

export interface AdjustResult {
  before: number;
  after: number;
  resourceClass?: string;
  caption?: string;
}

export interface OpacityBackend {
  readonly id: BackendId;
  isAvailable(): Promise<boolean>;
  adjustOpacity(step: number, min: number, max: number): Promise<AdjustResult>;
}
