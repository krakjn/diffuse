import type { ExtensionContext, OutputChannel } from "vscode";
import { workspace } from "vscode";
import type { BackendRegistry } from "./backends/registry";
import type { DetectResult, OpacityBackend } from "./backends/types";
import { detectEnvironment, getDetectionSummary, resolveCandidates } from "./detect";
import { noBackendMessage } from "./messages";

const OPACITY_KEY = "diffuse.opacity";

export interface OpacityConfig {
  step: number;
  minOpacity: number;
  maxOpacity: number;
  backend: string;
}

export function getOpacityConfig(): OpacityConfig {
  const config = workspace.getConfiguration("diffuse");
  return {
    step: config.get<number>("step", 0.025),
    minOpacity: config.get<number>("minOpacity", 0.25),
    maxOpacity: config.get<number>("maxOpacity", 1.0),
    backend: config.get<string>("backend", "auto"),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toPercent(value: number): number {
  return Math.round(value * 100);
}

interface Resolution {
  backend: OpacityBackend | null;
  reason: string;
}

/**
 * Owns opacity state, clamping, and backend resolution.
 *
 * Backends only ever answer "set this window to `value`"; every bit of
 * arithmetic, persistence, and scheduling lives here.
 */
export class OpacityService {
  private detectResult: DetectResult;
  private resolution?: Resolution;
  private target: number;
  private applied: number;
  private flushing = false;
  private failure?: string;

  constructor(
    private readonly context: ExtensionContext,
    private readonly registry: BackendRegistry,
    private readonly log: OutputChannel,
    private readonly onError: (message: string) => void
  ) {
    this.detectResult = detectEnvironment();
    const stored = context.globalState.get<number>(OPACITY_KEY, 1);
    this.target = stored;
    this.applied = stored;
  }

  /** Current clamped target. Used by opt-in installers that write a sidecar config. */
  get opacity(): number {
    return this.target;
  }

  /** Log the environment and seed state from the compositor when it can be read. */
  async initialize(): Promise<void> {
    this.log.appendLine(getDetectionSummary(this.detectResult));

    const { backend, reason } = await this.resolveBackend();

    if (!backend) {
      this.failure = reason;
      this.log.appendLine(`no backend: ${reason}`);
      return;
    }

    this.log.appendLine(`backend ${backend.id} (${backend.displayName})`);

    if (backend.ensureReady) {
      try {
        await backend.ensureReady(this.target);
        this.log.appendLine(`${backend.id} ready opacity=${this.target}`);
      } catch (error) {
        this.fail(describeError(error));
        return;
      }
    }

    if (backend.read) {
      try {
        const live = await backend.read();
        if (live !== null) {
          this.target = live;
          this.applied = live;
          this.log.appendLine(`seeded opacity from ${backend.id}: ${live}`);
        }
      } catch (error) {
        this.log.appendLine(`read failed: ${describeError(error)}`);
      }
    }
  }

  /** Re-run detection and drop the cached backend. */
  async refresh(): Promise<void> {
    this.detectResult = detectEnvironment();
    this.resolution = undefined;
    this.failure = undefined;
    await this.initialize();
  }

  async adjust(direction: "increase" | "decrease"): Promise<void> {
    const { step, minOpacity, maxOpacity } = getOpacityConfig();
    const delta = direction === "decrease" ? -step : step;
    await this.setTo(this.target + delta, minOpacity, maxOpacity);
  }

  async reset(): Promise<void> {
    const { minOpacity, maxOpacity } = getOpacityConfig();
    this.target = clamp(maxOpacity, minOpacity, 1);
    await this.flush(true);
  }

  private async setTo(value: number, min?: number, max?: number): Promise<void> {
    const config = getOpacityConfig();
    this.target = clamp(value, min ?? config.minOpacity, max ?? config.maxOpacity);
    await this.flush();
  }

  /**
   * Apply the latest target, collapsing anything queued while a backend runs.
   * Held keybindings must never stack subprocesses.
   */
  private async flush(force = false): Promise<void> {
    if (this.flushing) {
      return;
    }
    this.flushing = true;

    try {
      while (force || this.target !== this.applied) {
        force = false;
        const value = this.target;
        const { backend, reason } = await this.resolveBackend();
        if (!backend) {
          this.fail(reason);
          return;
        }

        const result = await backend.apply(value);
        this.applied = value;
        await this.context.globalState.update(OPACITY_KEY, value);
        this.failure = undefined;

        const target = result.target ? ` target=${result.target}` : "";
        this.log.appendLine(
          `opacity ${toPercent(value)}% via ${backend.id}${target}`
        );
      }
    } catch (error) {
      this.fail(describeError(error));
    } finally {
      this.flushing = false;
    }
  }

  private fail(message: string): void {
    this.target = this.applied;
    this.failure = message;
    // Re-probe next time; the user may have started a compositor since.
    this.resolution = undefined;
    this.log.appendLine(`error: ${message}`);
    this.onError(message);
  }

  private async resolveBackend(): Promise<Resolution> {
    if (this.resolution) {
      return this.resolution;
    }

    const configured = getOpacityConfig().backend;
    const candidates = resolveCandidates(configured, this.detectResult);
    const reasons: string[] = [];

    for (const id of candidates) {
      const backend = this.registry.get(id);
      if (!backend) {
        reasons.push(`${id}: no such backend`);
        continue;
      }

      // An explicit diffuse.backend is a deliberate override; skip probing.
      if (configured !== "auto") {
        this.log.appendLine(`backend forced to ${id} by diffuse.backend`);
        this.resolution = { backend, reason: "" };
        return this.resolution;
      }

      const availability = await backend.isAvailable();
      if (availability.ok) {
        this.resolution = { backend, reason: "" };
        return this.resolution;
      }

      const reason = availability.reason ?? "unavailable";
      reasons.push(`${id}: ${reason}`);
      this.log.appendLine(`backend ${id} unavailable — ${reason}`);
    }

    const detail = reasons.length ? ` (${reasons.join(" | ")})` : "";
    this.resolution = {
      backend: null,
      reason: `${noBackendMessage(this.detectResult)}${detail}`,
    };
    return this.resolution;
  }

  dispose(): void {
    this.registry.dispose();
  }
}

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
