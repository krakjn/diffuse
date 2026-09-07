// @diffuse-kwin-script-version 1
// @diffuse-api adjust-editor-window-opacity
// @diffuse-plasma target: Plasma 6 Wayland
//
// Target policy:
//   1. activeWindow if it matches an editor resourceClass
//   2. focused editor window in windowList
//   3. any matching editor window (single-window fallback)

// --- diffuse params (injected) ---
const DIFFUSE = { step: -0.025, min: 0.25, max: 1.0 };
// --- end diffuse params ---

const EDITOR_CLASSES = ["cursor", "code", "vscodium", "code-oss"];

function matchesEditor(win) {
  return win && win.normalWindow && EDITOR_CLASSES.includes(win.resourceClass);
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
  print("DIFFUSE:ERROR:no-target-window");
} else {
  const before = win.opacity;
  win.opacity = Math.max(
    DIFFUSE.min,
    Math.min(DIFFUSE.max, win.opacity + DIFFUSE.step)
  );
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
