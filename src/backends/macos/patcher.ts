import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  BACKUP_SUFFIX,
  buildMainProcessInjection,
  isContentPatched,
  PATCH_TAG_START,
  prependPatch,
  stripAllPatches,
} from "./patch-content";

export const MACOS_INSTALL_HINT =
  "macOS needs the editor patch. Run 'Diffuse: Enable macOS Transparency', confirm, then restart.";

export interface PatchResult {
  success: boolean;
  message: string;
  mainJsPath?: string;
}

const KNOWN_APP_PATHS = [
  "Visual Studio Code.app",
  "Visual Studio Code - Insiders.app",
  "Cursor.app",
  "VSCodium.app",
  "Code - OSS.app",
  "Antigravity.app",
  "Windsurf.app",
];

function home(): string {
  return os.homedir();
}

function appResourceDir(bundle: string): string {
  return path.join(bundle, "Contents", "Resources", "app");
}

function hasMainJs(appDir: string): boolean {
  return fs.existsSync(mainJsIn(appDir));
}

function mainJsIn(appDir: string): string {
  return path.join(appDir, "out", "main.js");
}

/**
 * Locate the running editor's `Resources/app` directory.
 *
 * `appRoot` from `vscode.env.appRoot` is preferred. The extension host's
 * `process.execPath` is a Helper binary inside the bundle, so slicing at the
 * first `/Contents/` still yields the .app we are actually running.
 */
export function resolveAppDir(appRoot?: string): string {
  if (appRoot && hasMainJs(appRoot)) {
    return appRoot;
  }

  const execPath = process.execPath;
  const contentsIdx = execPath.indexOf("/Contents/");
  if (contentsIdx !== -1) {
    const fromExec = appResourceDir(execPath.substring(0, contentsIdx));
    if (hasMainJs(fromExec)) {
      return fromExec;
    }
  }

  const roots = ["/Applications", path.join(home(), "Applications")];
  for (const root of roots) {
    for (const app of KNOWN_APP_PATHS) {
      const candidate = appResourceDir(path.join(root, app));
      if (hasMainJs(candidate)) {
        return candidate;
      }
    }
  }

  throw new Error(
    "Could not find this editor's out/main.js. Diffuse looks next to the running app and in /Applications and ~/Applications."
  );
}

export function resolveMainJsPath(appRoot?: string): string {
  return mainJsIn(resolveAppDir(appRoot));
}

/** Bundle path for `open`, e.g. `/Applications/Cursor.app`. */
export function resolveAppBundlePath(appRoot?: string): string | undefined {
  try {
    const appDir = resolveAppDir(appRoot);
    const bundle = path.resolve(appDir, "../../..");
    if (bundle.endsWith(".app")) {
      return bundle;
    }
  } catch {
    // fall through to execPath
  }

  const execPath = process.execPath;
  const contentsIdx = execPath.indexOf("/Contents/");
  if (contentsIdx !== -1) {
    return execPath.substring(0, contentsIdx);
  }
  return undefined;
}

export function getConfigPath(): string {
  return path.join(home(), ".diffuse-config.json");
}

function isPermissionError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  return code === "EACCES" || code === "EPERM";
}

function permissionDeniedMessage(mainPath: string): string {
  return [
    "Permission denied writing the editor's main.js.",
    "Move the app to ~/Applications, or grant write access to your user:",
    `sudo chown "$(whoami)" "${mainPath}" && chmod u+w "${mainPath}"`,
  ].join(" ");
}

function wrapError(error: unknown, mainPath: string): PatchResult {
  if (isPermissionError(error)) {
    return { success: false, message: permissionDeniedMessage(mainPath) };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, message };
}

export function isPatched(appRoot?: string): boolean {
  try {
    const content = fs.readFileSync(resolveMainJsPath(appRoot), "utf8");
    return isContentPatched(content);
  } catch {
    return false;
  }
}

function writeAtomic(filePath: string, data: string): void {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, data, "utf8");
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "EXDEV") {
      fs.copyFileSync(tmpPath, filePath);
      fs.unlinkSync(tmpPath);
      return;
    }
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore cleanup failure
    }
    throw error;
  }
}

export function installPatchAt(mainPath: string, configPath: string): PatchResult {
  try {
    const backupPath = mainPath + BACKUP_SUFFIX;
    let content = fs.readFileSync(mainPath, "utf8");
    let restoredFromBackup = false;

    while (content.includes(PATCH_TAG_START)) {
      const stripped = stripAllPatches(content);
      if (stripped.content === content) {
        if (!restoredFromBackup && fs.existsSync(backupPath)) {
          content = fs.readFileSync(backupPath, "utf8");
          restoredFromBackup = true;
          continue;
        }
        return {
          success: false,
          message:
            "Found a partial or malformed Diffuse patch in the editor. Restore the original out/main.js and try again.",
          mainJsPath: mainPath,
        };
      }
      content = stripped.content;
    }

    writeAtomic(backupPath, content);
    const injection = buildMainProcessInjection(configPath);
    writeAtomic(mainPath, prependPatch(content, injection));

    return {
      success: true,
      message: "Patch installed.",
      mainJsPath: mainPath,
    };
  } catch (error) {
    return wrapError(error, mainPath);
  }
}

export function installPatch(appRoot?: string): PatchResult {
  try {
    return installPatchAt(resolveMainJsPath(appRoot), getConfigPath());
  } catch (error) {
    return wrapError(error, "");
  }
}

export function uninstallPatchAt(mainPath: string): PatchResult {
  try {
    const backupPath = mainPath + BACKUP_SUFFIX;
    let content = fs.readFileSync(mainPath, "utf8");

    const stripped = stripAllPatches(content);
    if (content.includes(PATCH_TAG_START) && stripped.content === content) {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, mainPath);
        fs.unlinkSync(backupPath);
        return {
          success: true,
          message: "Patch removed (restored from backup).",
          mainJsPath: mainPath,
        };
      }
      return {
        success: false,
        message:
          "Found a partial or malformed Diffuse patch in the editor. Restore the original out/main.js and try again.",
        mainJsPath: mainPath,
      };
    }

    if (stripped.removed > 0) {
      writeAtomic(mainPath, stripped.content);
      try {
        fs.unlinkSync(backupPath);
      } catch {
        // backup may already be gone
      }
      return { success: true, message: "Patch removed.", mainJsPath: mainPath };
    }

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      return {
        success: true,
        message: "No patch found. Removed a stale Diffuse backup.",
        mainJsPath: mainPath,
      };
    }

    return { success: true, message: "No patch found.", mainJsPath: mainPath };
  } catch (error) {
    return wrapError(error, mainPath);
  }
}

export function uninstallPatch(appRoot?: string): PatchResult {
  try {
    return uninstallPatchAt(resolveMainJsPath(appRoot));
  } catch (error) {
    return wrapError(error, "");
  }
}

export function writeConfig(opacity: number): void {
  writeAtomic(getConfigPath(), JSON.stringify({ opacity }));
}

export function readConfig(): number | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(getConfigPath(), "utf8")) as {
      opacity?: unknown;
    };
    return typeof parsed.opacity === "number" &&
      Number.isFinite(parsed.opacity) &&
      parsed.opacity >= 0 &&
      parsed.opacity <= 1
      ? parsed.opacity
      : null;
  } catch {
    return null;
  }
}

export function removeConfig(): void {
  try {
    fs.unlinkSync(getConfigPath());
  } catch {
    // already gone
  }
  try {
    fs.unlinkSync(`${getConfigPath()}.tmp`);
  } catch {
    // already gone
  }
}
