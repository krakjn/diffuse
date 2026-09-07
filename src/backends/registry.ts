import type { OpacityBackend } from "./types";

export class BackendRegistry {
  private readonly backends = new Map<string, OpacityBackend>();

  register(backend: OpacityBackend): void {
    this.backends.set(backend.id, backend);
  }

  get(id: string): OpacityBackend | undefined {
    return this.backends.get(id);
  }

  list(): OpacityBackend[] {
    return [...this.backends.values()];
  }
}
