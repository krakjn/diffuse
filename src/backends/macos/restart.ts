import { spawn } from "child_process";
import { window as vscodeWindow, commands } from "vscode";
import { resolveAppBundlePath } from "./patcher";

/**
 * Quit and reopen the running editor so a freshly written main.js is loaded.
 * Adapted from Glassy's restart path: wait for VSCODE_PID to die, then `open` the bundle.
 */
export async function restartEditor(
  appRoot: string,
  log: (message: string) => void
): Promise<boolean> {
  const appPath = resolveAppBundlePath(appRoot);
  const rawPid = process.env.VSCODE_PID;
  const pid = rawPid && /^\d+$/.test(rawPid) ? rawPid : undefined;

  if (!appPath) {
    await vscodeWindow.showWarningMessage(
      "Diffuse could not determine this app bundle. Quit and reopen the editor manually."
    );
    return false;
  }

  if (rawPid && !pid) {
    log("Ignoring invalid VSCODE_PID during restart.");
  }

  const escapedAppPath = appPath.replace(/'/g, "'\\''");
  const openCmd = `open '${escapedAppPath}'`;
  const script = pid
    ? `exec >/tmp/diffuse_restart.log 2>&1; echo "Waiting for pid ${pid}..."; i=0; while [ $i -lt 30 ]; do if ! kill -0 ${pid} 2>/dev/null; then echo "Process ${pid} died. Sleeping 2 sec."; sleep 2; echo "Running: ${openCmd}"; ${openCmd}; echo "Exit code: $?"; exit 0; fi; sleep 0.5; i=$((i+1)); done; echo "Timeout!"; osascript -e 'display notification "Please reopen the editor manually to finish applying Diffuse." with title "Diffuse"'`
    : `exec >/tmp/diffuse_restart.log 2>&1; echo "No pid. Sleeping 3s."; sleep 3; echo "Running: ${openCmd}"; ${openCmd}`;

  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.VSCODE_PID;
  delete env.VSCODE_IPC_HOOK;
  delete env.VSCODE_IPC_HOOK_EXTHOST;
  delete env.VSCODE_IPC_HOOK_CLI;

  try {
    const child = spawn("sh", ["-c", script], {
      detached: true,
      stdio: "ignore",
      env,
    });
    child.unref();
    await commands.executeCommand("workbench.action.quit");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Failed to schedule restart: ${message}`);
    await vscodeWindow.showErrorMessage(
      "Diffuse: Failed to restart automatically. Quit and reopen the editor manually."
    );
    return false;
  }
}
