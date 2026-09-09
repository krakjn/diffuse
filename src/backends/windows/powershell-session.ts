import { type ChildProcessWithoutNullStreams, spawn } from "child_process";

const END = "__DIFFUSE_END__";

/**
 * One PowerShell process for the extension lifetime.
 * GlassIt-VSC does the same: Add-Type once, then each keypress is a method call.
 */
export class PowerShellSession {
  private proc?: ChildProcessWithoutNullStreams;
  private chain: Promise<unknown> = Promise.resolve();

  async start(shell: string): Promise<void> {
    if (this.proc && !this.proc.killed) {
      return;
    }

    const proc = spawn(
      shell,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "-",
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
    );

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    this.proc = proc;

    await this.invoke("[Console]::OutputEncoding = [Text.Encoding]::UTF8");
  }

  async invoke(command: string): Promise<string> {
    const run = this.chain.then(() => this.send(command));
    this.chain = run.catch(() => undefined);
    return run;
  }

  dispose(): void {
    const proc = this.proc;
    this.proc = undefined;
    if (!proc || proc.killed) {
      return;
    }
    proc.stdin.end();
    proc.kill();
  }

  private send(command: string): Promise<string> {
    const proc = this.proc;
    if (!proc || proc.killed) {
      return Promise.reject(new Error("PowerShell session is not running"));
    }

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      const onStdout = (chunk: string) => {
        stdout += chunk;
        if (stdout.includes(END)) {
          cleanup();
          const body = stdout.slice(0, stdout.indexOf(END)).trim();
          resolve(body);
        }
      };

      const onStderr = (chunk: string) => {
        stderr += chunk;
      };

      const onExit = (code: number | null) => {
        cleanup();
        reject(
          new Error(
            stderr.trim() || `PowerShell exited${code == null ? "" : ` (${code})`}`
          )
        );
      };

      const cleanup = () => {
        proc.stdout.off("data", onStdout);
        proc.stderr.off("data", onStderr);
        proc.off("exit", onExit);
      };

      proc.stdout.on("data", onStdout);
      proc.stderr.on("data", onStderr);
      proc.once("exit", onExit);

      proc.stdin.write(`${command}; Write-Output '${END}'\n`, (error) => {
        if (error) {
          cleanup();
          reject(error);
        }
      });
    });
  }
}
