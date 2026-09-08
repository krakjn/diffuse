// @diffuse-kwin-script-version 2
// @diffuse-api set-editor-window-opacity
// @diffuse-plasma target: Plasma 6 Wayland
//
// Target policy:
//   1. activeWindow if it matches an editor class
//   2. focused editor window in windowList
//   3. any matching editor window (single-window fallback)

// --- diffuse params (injected) ---
const DIFFUSE = { value: 1.0, classes: ["cursor", "code", "vscodium", "code-oss"] };
// --- end diffuse params ---

function matchesEditor(win) {
  if (!win || !win.normalWindow) {
    return false;
  }
  const cls = String(win.resourceClass).toLowerCase();
  return DIFFUSE.classes.indexOf(cls) !== -1;
}

function findTargetWindow() {
  const active = workspace.activeWindow;
  if (matchesEditor(active)) {
    return active;
  }

  const windows = workspace.windowList();
  for (const win of windows) {
    if (matchesEditor(win) && win.active) {
      return win;
    }
  }
  for (const win of windows) {
    if (matchesEditor(win)) {
      return win;
    }
  }
  return null;
}

const win = findTargetWindow();
if (!win) {
  print("DIFFUSE:ERROR:no editor window found on this KWin session");
} else {
  const before = win.opacity;
  win.opacity = DIFFUSE.value;
  print(
    "DIFFUSE:" +
      JSON.stringify({
        resourceClass: win.resourceClass,
        caption: win.caption,
        before: Number(before.toFixed(4)),
        after: Number(win.opacity.toFixed(4)),
      })
  );
}
