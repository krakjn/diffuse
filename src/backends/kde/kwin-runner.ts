import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { runtimeDir } from "../../runtime-paths";
import { commandExists, execCommand, firstAvailableCommand } from "../../util/exec";
import { KWIN_SCRIPT_VERSION } from "./kwin-version";

const PARAMS_MARKER =
  /\/\/ --- diffuse params \(injected\) ---[\s\S]*?\/\/ --- end diffuse params ---/;

export type KwinScriptName = "set-opacity.js" | "list-windows.js";

export interface KwinParams {
  value: number;
  classes: string[];
}

export async function resolveQdbus(): Promise<string | null> {
  return firstAvailableCommand(["qdbus6", "qdbus", "qdbus-qt6"]);
}

function injectParams(source: string, params: KwinParams): string {
  if (!PARAMS_MARKER.test(source)) {
    return source;
  }

  const block = `// --- diffuse params (injected) ---
const DIFFUSE = ${JSON.stringify(params)};
// --- end diffuse params ---`;

  return source.replace(PARAMS_MARKER, block);
}

/** Strip the journal prefix and return the payload of each DIFFUSE line. */
function parseDiffuseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("DIFFUSE:"))
    .map((line) => line.slice(line.indexOf("DIFFUSE:") + "DIFFUSE:".length));
}

/**
 * Load a KWin script ephemerally over D-Bus and collect its output.
 *
 * KWin scripts have no return channel, so `print()` goes to the journal and we
 * read it back out.
 */
export async function runKwinScript(
  extensionPath: string,
  scriptName: KwinScriptName,
  params: KwinParams
): Promise<string[]> {
  const qdbus = await resolveQdbus();
  if (!qdbus) {
    throw new Error("qdbus not found (install qt6-tools or kde-cli-tools)");
  }

  const sourcePath = path.join(runtimeDir(extensionPath, "kwin"), scriptName);
  const source = await fs.readFile(sourcePath, "utf8");
  const materialized = injectParams(source, params);

  const tmpPath = path.join(
    os.tmpdir(),
    `diffuse-kwin-${KWIN_SCRIPT_VERSION}-${process.pid}-${Date.now()}.js`
  );

  await fs.writeFile(tmpPath, materialized, "utf8");

  try {
    const loadReply = await execCommand(qdbus, [
      "org.kde.KWin",
      "/Scripting",
      "org.kde.kwin.Scripting.loadScript",
      tmpPath,
    ]);

    const num = loadReply.trim().replace(/^.*\/Script/, "") || loadReply.trim();

    await execCommand(qdbus, [
      "org.kde.KWin",
      `/Scripting/Script${num}`,
      "org.kde.kwin.Script.run",
    ]);

    await execCommand(qdbus, [
      "org.kde.KWin",
      `/Scripting/Script${num}`,
      "org.kde.kwin.Script.stop",
    ]);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const journal = await execCommand("journalctl", [
      "_COMM=kwin_wayland",
      "+",
      "_COMM=kwin_x11",
      "-o",
      "cat",
      "--since",
      "2 seconds ago",
    ]);

    return parseDiffuseLines(journal);
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

export async function kwinScriptingReachable(): Promise<string | null> {
  const qdbus = await resolveQdbus();
  if (!qdbus) {
    return "qdbus not found (install qt6-tools or kde-cli-tools)";
  }
  if (!(await commandExists("journalctl"))) {
    return "journalctl not found; Diffuse reads KWin script output from the journal";
  }
  try {
    await execCommand(qdbus, ["org.kde.KWin", "/Scripting"]);
    return null;
  } catch {
    return "KWin scripting is not reachable on the session bus";
  }
}
