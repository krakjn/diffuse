import type { ExtensionContext, OutputChannel } from "vscode";
import { workspace } from "vscode";
import type { BackendRegistry } from "./backends/registry";
import type { DetectResult, OpacityBackend } from "./backends/types";
import { KdeBackend } from "./backends/kde/kde";
import { detectEnvironment, resolveBackendId } from "./detect";
import { unsupportedMessage } from "./messages";

const OPACITY_KEY = "diffuse.opacity";

export interface OpacityConfig {
  step: number;
  minOpacity: number;
  maxOpacity: number;
  backend: string;
  showStatusBar: boolean;
}

export function getOpacityConfig(): OpacityConfig {
  const config = workspace.getConfiguration("diffuse");
  return {
    step: config.get<number>("step", 0.025),
    minOpacity: config.get<number>("minOpacity", 0.25),
    maxOpacity: config.get<number>("maxOpacity", 1),
    backend: config.get<string>("backend", "auto"),
    showStatusBar: config.get<boolean>("showStatusBar", true),
  };
}

export function getStoredOpacity(context: ExtensionContext): number {
  return context.globalState.get<number>(OPACITY_KEY, 1);
}

async function resolveBackend(
  registry: BackendRegistry,
  detected: DetectResult
): Promise<OpacityBackend | null> {
  const { backend: configured } = getOpacityConfig();
  const backendId = resolveBackendId(configured, detected);
  if (!backendId) {
    return null;
  }

  const backend = registry.get(backendId);
  if (!backend) {
    return null;
  }

  if (!(await backend.isAvailable())) {
    return null;
  }

  return backend;
}

export async function adjustOpacity(
  context: ExtensionContext,
  registry: BackendRegistry,
  detected: DetectResult,
  direction: "increase" | "decrease",
  log: OutputChannel
): Promise<number | null> {
  const backend = await resolveBackend(registry, detected);
  if (!backend) {
    throw new Error(unsupportedMessage(detected));
  }

  const { step, minOpacity, maxOpacity } = getOpacityConfig();
  const signedStep = direction === "decrease" ? -step : step;

  log.appendLine(
    `adjust ${direction} step=${signedStep} min=${minOpacity} max=${maxOpacity} backend=${backend.id}`
  );

  if (backend instanceof KdeBackend) {
    log.appendLine(`kwin script version ${backend.scriptVersion}`);
  }

  const result = await backend.adjustOpacity(
    signedStep,
    minOpacity,
    maxOpacity
  );
  await context.globalState.update(OPACITY_KEY, result.after);
  log.appendLine(`opacity ${result.before} -> ${result.after}`);

  return result.after;
}

export function getDetectionSummary(detected: DetectResult): string {
  const backend = detected.backendId ?? "none";
  return `session=${detected.session} desktop=${detected.desktop} (${detected.displayName}) backend=${backend} supported=${detected.supported}`;
}
