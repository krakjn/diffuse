import { uninstallKdeEffect } from "./backends/kde/kwin-effect-runner";

/** vscode:uninstall hook. Runs without the VS Code API. */
async function main(): Promise<void> {
  await uninstallKdeEffect();
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Diffuse uninstall: ${message}`);
});
