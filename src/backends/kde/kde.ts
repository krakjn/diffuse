import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";
import {
  ensureEffectInstalled,
  isKwinEffectReachable,
  readEffectTarget,
  resetKdeCaches,
  setEffectTarget,
} from "./kwin-effect-runner";

export class KdeBackend implements OpacityBackend {
  readonly id = "kde" as const;
  readonly displayName = "KWin";

  constructor(private readonly extensionPath: string) {}

  async isAvailable(): Promise<Availability> {
    const problem = await isKwinEffectReachable();
    return problem ? unavailable(problem) : available();
  }

  async ensureReady(value: number): Promise<void> {
    await ensureEffectInstalled(this.extensionPath);
    await setEffectTarget(value);
  }

  async apply(value: number): Promise<ApplyResult> {
    await ensureEffectInstalled(this.extensionPath);
    await setEffectTarget(value);
    return { value, target: "diffuse_opacity" };
  }

  async read(): Promise<number | null> {
    return readEffectTarget();
  }

  dispose(): void {
    resetKdeCaches();
  }
}
