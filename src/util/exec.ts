import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_BUFFER = 4 * 1024 * 1024;

export interface ExecResult {
  ok: boolean;
  stdout: string;
  stderr: string;
}

function asText(value: string | Buffer | undefined): string {
  if (!value) {
    return "";
  }
  return typeof value === "string" ? value : value.toString("utf8");
}

/** Run a command, throwing on non-zero exit. */
export async function execCommand(
  command: string,
  args: string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
  });
  return asText(stdout);
}

/** Run a command, folding failure into the result so probes stay branch-free. */
export async function tryExec(
  command: string,
  args: string[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
    });
    return { ok: true, stdout: asText(stdout), stderr: asText(stderr) };
  } catch (error) {
    const failure = error as {
      stdout?: string | Buffer;
      stderr?: string | Buffer;
      message?: string;
    };
    const stderr = asText(failure.stderr).trim() || failure.message || "";
    return { ok: false, stdout: asText(failure.stdout), stderr: stderr.trim() };
  }
}

export async function commandExists(command: string): Promise<boolean> {
  if (process.platform === "win32") {
    const result = await tryExec("where", [command]);
    return result.ok;
  }
  const result = await tryExec("sh", [
    "-c",
    'command -v -- "$1" > /dev/null 2>&1',
    "sh",
    command,
  ]);
  return result.ok;
}

/** First command on PATH from `candidates`, or null. */
export async function firstAvailableCommand(
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await commandExists(candidate)) {
      return candidate;
    }
  }
  return null;
}

/** True when any of the given process names is running. */
export async function anyProcessRunning(
  names: string[]
): Promise<boolean | null> {
  if (!(await commandExists("pgrep"))) {
    return null;
  }
  for (const name of names) {
    const result = await tryExec("pgrep", ["-x", name]);
    if (result.ok && result.stdout.trim()) {
      return true;
    }
  }
  return false;
}
