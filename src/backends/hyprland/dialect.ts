import type { ExecResult } from "../../util/exec";

/**
 * hyprctl's opacity properties were renamed in 0.53. Both spellings live here
 * so a future rename is a one-file change.
 */
export interface HyprDialect {
  readonly name: string;
  /** Command argument lists to run in order. */
  setArgs(value: number): string[][];
  /** Read-back arguments, when the dialect supports it. */
  readArgs(): string[] | null;
}

function format(value: number): string {
  return value.toFixed(3);
}

/** Hyprland 0.53 and newer: `opacity <v> override` triplet. */
export const MODERN_DIALECT: HyprDialect = {
  name: "opacity",
  setArgs(value) {
    const v = format(value);
    return [
      [
        "dispatch",
        "setprop",
        "active",
        "opacity",
        v,
        "override",
        v,
        "override",
        v,
        "override",
      ],
    ];
  },
  readArgs: () => ["getprop", "active", "opacity"],
};

/** Hyprland 0.52 and older: paired `alpha*override` + `alpha*` properties. */
export const LEGACY_DIALECT: HyprDialect = {
  name: "alpha",
  setArgs(value) {
    const v = format(value);
    return [
      ["dispatch", "setprop", "active", "alphaoverride", "1"],
      ["dispatch", "setprop", "active", "alpha", v],
      ["dispatch", "setprop", "active", "alphainactiveoverride", "1"],
      ["dispatch", "setprop", "active", "alphainactive", v],
      ["dispatch", "setprop", "active", "alphafullscreenoverride", "1"],
      ["dispatch", "setprop", "active", "alphafullscreen", v],
    ];
  },
  readArgs: () => null,
};

export const DIALECTS: HyprDialect[] = [MODERN_DIALECT, LEGACY_DIALECT];

/** hyprctl answers "ok" on success and prints a complaint otherwise. */
export function accepted(result: ExecResult): boolean {
  if (!result.ok) {
    return false;
  }
  const text = `${result.stdout} ${result.stderr}`.toLowerCase();
  if (
    text.includes("unknown request") ||
    text.includes("prop not found") ||
    text.includes("invalid")
  ) {
    return false;
  }
  return text.includes("ok");
}
