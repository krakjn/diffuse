import type { AdjustResult, BackendId, OpacityBackend } from "./types";

export function createUnsupportedBackend(
  id: BackendId,
  message: string
): OpacityBackend {
  return {
    id,
    async isAvailable() {
      return false;
    },
    async adjustOpacity(
      _step: number,
      _min: number,
      _max: number
    ): Promise<AdjustResult> {
      throw new Error(message);
    },
  };
}
