import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import {
  isPatched,
  MACOS_INSTALL_HINT,
  readConfig,
  writeConfig,
} from "./patcher";

/**
 * macOS backend.
 *
 * There is no public API for changing another process's window alpha, so this
 * backend only works after the user opts in to patching this editor's Electron
 * `out/main.js`. Opacity changes then write `~/.diffuse-config.json`, which the
 * injected main-process code polls and applies via `BrowserWindow.setOpacity()`.
 */
export class MacosBackend implements OpacityBackend {
  readonly id = "macos" as const;
  readonly displayName = "macOS (editor patch)";

  constructor(private readonly appRoot: string) {}

  async isAvailable(): Promise<Availability> {
    if (process.platform !== "darwin") {
      return unavailable("Not a macOS session");
    }
    if (!isPatched(this.appRoot)) {
      return unavailable(MACOS_INSTALL_HINT);
    }
    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    if (!isPatched(this.appRoot)) {
      throw new Error(MACOS_INSTALL_HINT);
    }
    writeConfig(value);
    return { value, target: "BrowserWindow.setOpacity" };
  }

  async read(): Promise<number | null> {
    return readConfig();
  }
}
