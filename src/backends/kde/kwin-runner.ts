import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import type { AdjustResult } from "../types";
import { KWIN_SCRIPT_VERSION } from "./kwin-version";
import { commandExists, execCommand } from "../../util/exec";

const PARAMS_MARKER =
  /\/\/ --- diffuse params \(injected\) ---[\s\S]*?\/\/ --- end diffuse params ---/;

export interface KwinRunnerOptions {
  extensionPath: string;
  scriptName?: "adjust-opacity.js" | "list-windows.js";
}

export interface KwinParams {
  step: number;
  min: number;
  max: number;
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

function parseAdjustOutput(raw: string): AdjustResult | null {
  for (const line of parseDiffuseOutput(raw).reverse()) {
    if (line.startsWith("ERROR:")) {
      throw new Error(line.replace(/^ERROR:/, ""));
    }
    try {
      const parsed = JSON.parse(line) as AdjustResult;
      if (
        typeof parsed.before === "number" &&
        typeof parsed.after === "number"
      ) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function injectParams(source: string, params: KwinParams): string {
  const block = `// --- diffuse params (injected) ---
const DIFFUSE = { step: ${params.step}, min: ${params.min}, max: ${params.max} };
// --- end diffuse params ---`;

  if (!PARAMS_MARKER.test(source)) {
    throw new Error("KWin script missing diffuse params marker block");
  }

  return source.replace(PARAMS_MARKER, block);
}

export async function runKwinScript(
  options: KwinRunnerOptions,
  params: KwinParams
): Promise<AdjustResult> {
  const qdbus = await resolveQdbus();
  if (!qdbus) {
    throw new Error("qdbus not found (install qt6-tools or kde-cli-tools)");
  }

  const scriptName = options.scriptName ?? "adjust-opacity.js";
  const sourcePath = path.join(options.extensionPath, "kwin", scriptName);
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
      "-o",
      "cat",
      "--since",
      "2 seconds ago",
    ]);

    const result = parseAdjustOutput(journal);
    if (!result) {
      throw new Error("KWin script produced no adjust output");
    }

    return result;
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
    await execCommand(qdbus, ["org.kde.KWin", "/Scripting"]);
    return true;
  } catch {
    return false;
  }
}
