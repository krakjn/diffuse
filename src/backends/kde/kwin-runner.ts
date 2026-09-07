import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { AdjustResult } from "../types";
import { KWIN_SCRIPT_VERSION } from "../types";

const execFileAsync = promisify(execFile);

const STEP_PLACEHOLDER = "step: -0.05";

export interface KwinRunnerOptions {
  extensionPath: string;
  scriptName?: "adjust-opacity.js" | "list-windows.js";
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("sh", ["-c", `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

export async function resolveQdbus(): Promise<string | null> {
  for (const candidate of ["qdbus6", "qdbus", "qdbus-qt6"]) {
    if (await commandExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

function parseDiffuseOutput(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^js: DIFFUSE:/, "").replace(/^DIFFUSE:/, ""));
}

export async function runKwinScript(
  options: KwinRunnerOptions,
  params: { step: number; min: number; max: number }
): Promise<AdjustResult> {
  const qdbus = await resolveQdbus();
  if (!qdbus) {
    throw new Error("qdbus not found (install qt6-tools or kde-cli-tools)");
  }

  const scriptName = options.scriptName ?? "adjust-opacity.js";
  const sourcePath = path.join(options.extensionPath, "kwin", scriptName);
  const source = await fs.readFile(sourcePath, "utf8");

  const tmpPath = path.join(
    os.tmpdir(),
    `diffuse-kwin-${KWIN_SCRIPT_VERSION}-${process.pid}-${Date.now()}.js`
  );

  const materialized = source
    .replace(STEP_PLACEHOLDER, `step: ${params.step}`)
    .replace("min: 0.25", `min: ${params.min}`)
    .replace("max: 1.0", `max: ${params.max}`);

  await fs.writeFile(tmpPath, materialized, "utf8");

  try {
    const { stdout: loadReply } = await execFileAsync(qdbus, [
      "org.kde.KWin",
      "/Scripting",
      "org.kde.kwin.Scripting.loadScript",
      tmpPath,
    ]);

    const num = loadReply.trim().replace(/^.*\/Script/, "") || loadReply.trim();

    await execFileAsync(qdbus, [
      "org.kde.KWin",
      `/Scripting/Script${num}`,
      "org.kde.kwin.Script.run",
    ]);

    await execFileAsync(qdbus, [
      "org.kde.KWin",
      `/Scripting/Script${num}`,
      "org.kde.kwin.Script.stop",
    ]);

    await new Promise((resolve) => setTimeout(resolve, 200));

    const { stdout: journal } = await execFileAsync("journalctl", [
      "_COMM=kwin_wayland",
      "-o",
      "cat",
      "--since",
      "2 seconds ago",
    ]);

    const lines = parseDiffuseOutput(journal);
    const line = lines.at(-1);
    if (!line) {
      throw new Error("KWin script produced no output");
    }
    if (line.startsWith("ERROR:")) {
      throw new Error(line.replace(/^ERROR:/, ""));
    }

    const parsed = JSON.parse(line) as AdjustResult;
    return parsed;
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

export async function isKwinAvailable(): Promise<boolean> {
  if ((process.env.XDG_SESSION_TYPE ?? "").toLowerCase() !== "wayland") {
    return false;
  }
  const qdbus = await resolveQdbus();
  if (!qdbus) {
    return false;
  }
  try {
    await execFileAsync(qdbus, ["org.kde.KWin", "/Scripting"]);
    return true;
  } catch {
    return false;
  }
}
