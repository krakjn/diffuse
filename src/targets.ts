/**
 * Which windows Diffuse is allowed to touch.
 *
 * Every backend and the injected KWin/PowerShell scripts resolve their target
 * through this list, so adding an editor is a one-line change here.
 */

/** Wayland `resourceClass` / X11 `WM_CLASS` / GNOME `wm_class`. */
export const EDITOR_CLASSES = ["cursor", "code", "vscodium", "code-oss"];

/** Windows image names. */
export const EDITOR_EXECUTABLES = [
  "cursor",
  "code",
  "vscodium",
  "code - oss",
  "code-oss",
];

export function matchesEditorClass(value: string | undefined | null): boolean {
  if (!value) {
    return false;
  }
  return EDITOR_CLASSES.includes(value.toLowerCase());
}

export function matchesEditorExecutable(
  value: string | undefined | null
): boolean {
  if (!value) {
    return false;
  }
  const name = value.toLowerCase().replace(/\.exe$/, "");
  return EDITOR_EXECUTABLES.includes(name);
}
