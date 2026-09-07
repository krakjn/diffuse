import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("sh", ["-c", `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

export async function execCommand(
  command: string,
  args: string[]
): Promise<string> {
  const { stdout } = await execFileAsync(command, args);
  return stdout;
}
