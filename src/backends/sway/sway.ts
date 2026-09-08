import { matchesEditorClass } from "../../targets";
import { commandExists, tryExec } from "../../util/exec";
import type { ApplyResult, Availability, OpacityBackend } from "../types";
import { available, unavailable } from "../types";

interface SwayNode {
  id?: number;
  focused?: boolean;
  app_id?: string | null;
  window_properties?: { class?: string };
  nodes?: SwayNode[];
  floating_nodes?: SwayNode[];
}

interface SwayTarget {
  id: number;
  name: string;
}

function findFocused(node: SwayNode): SwayNode | null {
  if (node.focused && typeof node.id === "number") {
    return node;
  }
  for (const child of [...(node.nodes ?? []), ...(node.floating_nodes ?? [])]) {
    const found = findFocused(child);
    if (found) {
      return found;
    }
  }
  return null;
}

/** Native Wayland windows carry app_id; XWayland ones carry WM_CLASS. */
function nodeClass(node: SwayNode): string | undefined {
  return node.app_id ?? node.window_properties?.class ?? undefined;
}

export class SwayBackend implements OpacityBackend {
  readonly id = "sway" as const;
  readonly displayName = "Sway";

  async isAvailable(): Promise<Availability> {
    if (!process.env.SWAYSOCK) {
      return unavailable("Not a Sway session (SWAYSOCK is unset)");
    }
    if (!(await commandExists("swaymsg"))) {
      return unavailable("swaymsg not found");
    }

    const target = await this.focusedEditor();
    if (!target) {
      return unavailable("The focused Sway window is not an editor window");
    }

    return available();
  }

  async apply(value: number): Promise<ApplyResult> {
    const target = await this.focusedEditor();
    if (!target) {
      throw new Error("The focused Sway window is not an editor window");
    }

    const result = await tryExec("swaymsg", [
      `[con_id=${target.id}]`,
      "opacity",
      value.toFixed(3),
    ]);

    if (!result.ok) {
      throw new Error(result.stderr || "swaymsg failed to set opacity");
    }

    return { value, target: target.name };
  }

  private async focusedEditor(): Promise<SwayTarget | null> {
    const result = await tryExec("swaymsg", ["-t", "get_tree"]);
    if (!result.ok) {
      return null;
    }

    let tree: SwayNode;
    try {
      tree = JSON.parse(result.stdout) as SwayNode;
    } catch {
      return null;
    }

    const focused = findFocused(tree);
    if (!focused || typeof focused.id !== "number") {
      return null;
    }

    const name = nodeClass(focused);
    if (!matchesEditorClass(name)) {
      return null;
    }

    return { id: focused.id, name: name as string };
  }
}
