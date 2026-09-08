import type { BackendId, OpacityBackend } from "./types";

export class BackendRegistry {
  private readonly backends = new Map<BackendId, OpacityBackend>();

  register(backend: OpacityBackend): void {
    this.backends.set(backend.id, backend);
  }

  get(id: BackendId): OpacityBackend | undefined {
    return this.backends.get(id);
  }

  list(): OpacityBackend[] {
    return [...this.backends.values()];
  }
}
