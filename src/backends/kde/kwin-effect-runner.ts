import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { runtimeDir } from "../../runtime-paths";
import { EDITOR_CLASSES } from "../../targets";
import {
  commandExists,
  execCommand,
  firstAvailableCommand,
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

async function resolveQdbus(): Promise<string | null> {
  return firstAvailableCommand(["qdbus6", "qdbus", "qdbus-qt6"]);
}

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

async function resolveKwriteconfig(): Promise<string | null> {
  return firstAvailableCommand(["kwriteconfig6", "kwriteconfig5"]);
}

async function resolveKreadconfig(): Promise<string | null> {
  return firstAvailableCommand(["kreadconfig6", "kreadconfig5"]);
}

export async function missingEffectTools(): Promise<string | null> {
  if (!(await commandExists("kpackagetool6"))) {
    return MISSING_HINTS.kpackagetool6;
  }
  if (!(await resolveKwriteconfig())) {
    return MISSING_HINTS.kwriteconfig;
  }
  if (!(await resolveQdbus())) {
    return MISSING_HINTS.qdbus;
  }
  return null;
}

async function resolveTools(): Promise<{ qdbus: string; kwrite: string }> {
  const missing = await missingEffectTools();
  if (missing) {
    throw new Error(missing);
  }

  const qdbus = await resolveQdbus();
  const kwrite = await resolveKwriteconfig();
  if (!qdbus || !kwrite) {
    throw new Error(missing ?? MISSING_HINTS.qdbus);
  }
  return { qdbus, kwrite };
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

async function loadEffectIfNeeded(
  qdbus: string,
  kwrite: string
): Promise<void> {
  if (await isEffectLoaded(qdbus)) {
    return;
  }

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

let installedForPath: string | undefined;
let installLock: Promise<void> | undefined;

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
      await loadEffectIfNeeded(qdbus, kwrite);
      installedForPath = extensionPath;
    })().finally(() => {
      installLock = undefined;
    });
  }

  await installLock;
}

/** Update live opacity. The resident effect stays loaded and re-paints. */
export async function setEffectTarget(target: number): Promise<void> {
  const { qdbus, kwrite } = await resolveTools();
  await execCommand(kwrite, [
    "--file",
    "kwinrc",
    "--group",
    CONFIG_GROUP,
    "--key",
    "target",
    String(target),
  ]);
  await execCommand(qdbus, [
    "org.kde.KWin",
    "/Effects",
    "org.kde.kwin.Effects.reconfigureEffect",
    KWIN_EFFECT_ID,
  ]);
}

export async function readEffectTarget(): Promise<number | null> {
  const kread = await resolveKreadconfig();
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

  const missing = await missingEffectTools();
  if (missing) {
    return missing;
  }

  const qdbus = await resolveQdbus();
  if (!qdbus) {
    return MISSING_HINTS.qdbus;
  }

  try {
    await execCommand(qdbus, ["org.kde.KWin", "/Effects"]);
    return null;
  } catch {
    return "KWin Effects D-Bus interface is not reachable";
  }
}
