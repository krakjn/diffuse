import * as path from "path";

export type RuntimePlatform = "kwin" | "win" | "gnome";

/** Directory of foreign-runtime scripts shipped in the VSIX under `runtime/`. */
export function runtimeDir(
  extensionPath: string,
  platform: RuntimePlatform
): string {
  return path.join(extensionPath, "runtime", platform);
}
