import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { runtimeDir } from "../../runtime-paths";
import { EDITOR_CLASSES } from "../../targets";
import {
  commandExists,
  execCommand,
  firstAvailableCommand,
  tryExec,
} from "../../util/exec";

export const KWIN_EFFECT_ID = "diffuse_opacity";
const CONFIG_GROUP = `Effect-${KWIN_EFFECT_ID}`;

const CLASSES_MARKER =
  /\/\/ --- diffuse params \(injected\) ---[\s\S]*?\/\/ --- end diffuse params ---/;

const MISSING_HINTS: Record<string, string> = {
  kpackagetool6: "kpackagetool6 not found (Plasma: kpackage / kf6-kpackage)",
  kwriteconfig: "kwriteconfig6 not found (Plasma: kf6-kconfig)",
  qdbus: "qdbus not found (qt6-tools, or qdbus from kde-cli-tools)",
};

interface KdeTools {
  qdbus: string;
  kwrite: string;
  reconfigure: () => Promise<void>;
}

let tools: KdeTools | undefined;
let installedForPath: string | undefined;
let installLock: Promise<void> | undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function effectSourceDir(extensionPath: string): string {
  return path.join(
    runtimeDir(extensionPath, "kwin"),
    "effects",
    "diffuse-opacity"
  );
}

function installedEffectPath(): string {
  return path.join(
    os.homedir(),
    ".local",
    "share",
    "kwin",
    "effects",
    KWIN_EFFECT_ID
  );
}

function injectEditorClasses(source: string): string {
  if (!CLASSES_MARKER.test(source)) {
    return source;
  }

  const block = `// --- diffuse params (injected) ---
const EDITOR_CLASSES = ${JSON.stringify(EDITOR_CLASSES)};
// --- end diffuse params ---`;

  return source.replace(CLASSES_MARKER, block);
}

function resetToolCache(): void {
  tools = undefined;
}

/** Drop cached binaries so Show Environment re-probes after a package install. */
export function resetKdeCaches(): void {
  resetToolCache();
  installedForPath = undefined;
}

async function resolveReconfigure(qdbus: string): Promise<() => Promise<void>> {
  if (await commandExists("dbus-send")) {
    return async () => {
      const result = await tryExec("dbus-send", [
        "--session",
        "--type=method_call",
        "--dest=org.kde.KWin",
        "/Effects",
        "org.kde.kwin.Effects.reconfigureEffect",
        `string:${KWIN_EFFECT_ID}`,
      ]);
      if (!result.ok) {
        throw new Error(result.stderr || "dbus-send reconfigureEffect failed");
      }
    };
  }

  if (await commandExists("gdbus")) {
    return async () => {
      const result = await tryExec("gdbus", [
        "call",
        "--session",
        "--dest",
        "org.kde.KWin",
        "--object-path",
        "/Effects",
        "--method",
        "org.kde.kwin.Effects.reconfigureEffect",
        KWIN_EFFECT_ID,
      ]);
      if (!result.ok) {
        throw new Error(result.stderr || "gdbus reconfigureEffect failed");
      }
    };
  }

  return async () => {
    await execCommand(qdbus, [
      "org.kde.KWin",
      "/Effects",
      "org.kde.kwin.Effects.reconfigureEffect",
      KWIN_EFFECT_ID,
    ]);
  };
}

async function resolveTools(): Promise<KdeTools> {
  if (tools) {
    return tools;
  }

  if (!(await commandExists("kpackagetool6"))) {
    throw new Error(MISSING_HINTS.kpackagetool6);
  }

  const kwrite = await firstAvailableCommand([
    "kwriteconfig6",
    "kwriteconfig5",
  ]);
  if (!kwrite) {
    throw new Error(MISSING_HINTS.kwriteconfig);
  }

  const qdbus = await firstAvailableCommand(["qdbus6", "qdbus", "qdbus-qt6"]);
  if (!qdbus) {
    throw new Error(MISSING_HINTS.qdbus);
  }

  tools = {
    qdbus,
    kwrite,
    reconfigure: await resolveReconfigure(qdbus),
  };
  return tools;
}

export async function missingEffectTools(): Promise<string | null> {
  try {
    await resolveTools();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function isEffectLoaded(qdbus: string): Promise<boolean> {
  const reply = await execCommand(qdbus, [
    "org.kde.KWin",
    "/Effects",
    "org.kde.kwin.Effects.isEffectLoaded",
    KWIN_EFFECT_ID,
  ]);
  return reply.trim() === "true";
}

async function stageEffectPackage(
  extensionPath: string,
  stageDir: string
): Promise<void> {
  const sourceDir = effectSourceDir(extensionPath);
  const mainSource = await fs.readFile(
    path.join(sourceDir, "contents", "code", "main.js"),
    "utf8"
  );

  await fs.rm(stageDir, { recursive: true, force: true });
  await fs.cp(sourceDir, stageDir, { recursive: true });
  await fs.writeFile(
    path.join(stageDir, "contents", "code", "main.js"),
    injectEditorClasses(mainSource),
    "utf8"
  );
}

async function installOrUpgradePackage(extensionPath: string): Promise<void> {
  const stageDir = path.join(
    os.tmpdir(),
    `diffuse-effect-${process.pid}-${Date.now()}`
  );

  try {
    await stageEffectPackage(extensionPath, stageDir);

    let installed = false;
    try {
      await fs.access(installedEffectPath());
      installed = true;
    } catch {
      installed = false;
    }

    if (installed) {
      await execCommand("kpackagetool6", ["-t", "KWin/Effect", "-u", stageDir]);
    } else {
      await execCommand("kpackagetool6", ["-t", "KWin/Effect", "-i", stageDir]);
    }
  } finally {
    await fs.rm(stageDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function loadEffect(qdbus: string, kwrite: string): Promise<void> {
  await execCommand(kwrite, [
    "--file",
    "kwinrc",
    "--group",
    "Plugins",
    "--key",
    `${KWIN_EFFECT_ID}Enabled`,
    "true",
  ]);
  await execCommand(qdbus, ["org.kde.KWin", "/KWin", "reconfigure"]);
  await sleep(300);
  await execCommand(qdbus, [
    "org.kde.KWin",
    "/Effects",
    "org.kde.kwin.Effects.loadEffect",
    KWIN_EFFECT_ID,
  ]);

  if (!(await isEffectLoaded(qdbus))) {
    throw new Error(
      "Failed to load Diffuse KWin effect (check journalctl _COMM=kwin_wayland)"
    );
  }
}

/** Unload a live effect so kpackagetool upgrades are picked up without restarting KWin. */
async function reloadEffect(qdbus: string, kwrite: string): Promise<void> {
  if (await isEffectLoaded(qdbus)) {
    await execCommand(qdbus, [
      "org.kde.KWin",
      "/Effects",
      "org.kde.kwin.Effects.unloadEffect",
      KWIN_EFFECT_ID,
    ]);
  }
  await loadEffect(qdbus, kwrite);
}

/** Install or upgrade the effect once per extension path. Never unload on apply. */
export async function ensureEffectInstalled(
  extensionPath: string
): Promise<void> {
  if (installedForPath === extensionPath) {
    return;
  }

  if (!installLock) {
    installLock = (async () => {
      const { qdbus, kwrite } = await resolveTools();
      await installOrUpgradePackage(extensionPath);
      await reloadEffect(qdbus, kwrite);
      installedForPath = extensionPath;
    })().finally(() => {
      installLock = undefined;
    });
  }

  await installLock;
}

/** Update live opacity. The resident effect stays loaded and re-paints. */
export async function setEffectTarget(target: number): Promise<void> {
  const { kwrite, reconfigure } = await resolveTools();
  await execCommand(kwrite, [
    "--file",
    "kwinrc",
    "--group",
    CONFIG_GROUP,
    "--key",
    "target",
    String(target),
  ]);
  await reconfigure();
}

export async function readEffectTarget(): Promise<number | null> {
  const kread = await firstAvailableCommand([
    "kreadconfig6",
    "kreadconfig5",
  ]);
  if (!kread) {
    return null;
  }

  const raw = await execCommand(kread, [
    "--file",
    "kwinrc",
    "--group",
    CONFIG_GROUP,
    "--key",
    "target",
  ]);
  const value = Number(raw.trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function isKwinEffectReachable(): Promise<string | null> {
  if ((process.env.XDG_SESSION_TYPE ?? "").toLowerCase() !== "wayland") {
    return "KWin effect backend needs a Wayland session";
  }

  resetToolCache();

  try {
    const { qdbus } = await resolveTools();
    await execCommand(qdbus, ["org.kde.KWin", "/Effects"]);
    return null;
  } catch (error) {
    resetToolCache();
    return error instanceof Error
      ? error.message
      : "KWin Effects D-Bus interface is not reachable";
  }
}

async function deleteKwinrcKey(
  kwrite: string,
  group: string,
  key: string
): Promise<void> {
  await tryExec(kwrite, [
    "--file",
    "kwinrc",
    "--group",
    group,
    "--key",
    key,
    "--delete",
  ]);
}

/**
 * Remove Diffuse from kwinrc and unload the effect. Used by vscode:uninstall.
 * Missing tools are ignored so uninstall still succeeds off KDE.
 */
export async function uninstallKdeEffect(): Promise<void> {
  const kwrite = await firstAvailableCommand([
    "kwriteconfig6",
    "kwriteconfig5",
  ]);
  const qdbus = await firstAvailableCommand(["qdbus6", "qdbus", "qdbus-qt6"]);

  if (qdbus) {
    try {
      if (await isEffectLoaded(qdbus)) {
        await execCommand(qdbus, [
          "org.kde.KWin",
          "/Effects",
          "org.kde.kwin.Effects.unloadEffect",
          KWIN_EFFECT_ID,
        ]);
      }
    } catch {
      // KWin may already be gone.
    }
  }

  if (kwrite) {
    await deleteKwinrcKey(kwrite, "Plugins", `${KWIN_EFFECT_ID}Enabled`);
    await deleteKwinrcKey(kwrite, CONFIG_GROUP, "target");
  }

  if (await commandExists("kpackagetool6")) {
    await tryExec("kpackagetool6", ["-t", "KWin/Effect", "-r", KWIN_EFFECT_ID]);
  }

  if (qdbus) {
    await tryExec(qdbus, ["org.kde.KWin", "/KWin", "reconfigure"]);
  }

  resetKdeCaches();
}
