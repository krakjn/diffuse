/*
 * Diffuse KWin effect — live compositor opacity via Effect.Opacity.
 * target is read from effect config on every change; the effect stays loaded.
 * EDITOR_CLASSES is injected at install from src/targets.ts.
 */

"use strict";

// --- diffuse params (injected) ---
const EDITOR_CLASSES = ["cursor", "code", "vscodium", "code-oss"];
// --- end diffuse params ---

function readTarget() {
  const value = Number(effect.readConfig("target", 1.0));
  if (isNaN(value)) {
    return 1.0;
  }
  return value;
}

function windowClass(win) {
  const cls = win.windowClass || win.resourceClass || "";
  return String(cls).toLowerCase();
}

function matchesEditor(win) {
  if (!win || !win.normalWindow) {
    return false;
  }
  const tokens = windowClass(win).split(/\s+/);
  for (let i = 0; i < EDITOR_CLASSES.length; i++) {
    if (tokens.indexOf(EDITOR_CLASSES[i]) !== -1) {
      return true;
    }
  }
  return false;
}

function cancelOpacity(win) {
  if (win.diffuseOpacityAnimation !== undefined) {
    cancel(win.diffuseOpacityAnimation);
    win.diffuseOpacityAnimation = undefined;
  }
}

function applyOpacity(win, reason) {
  if (!matchesEditor(win)) {
    return;
  }

  cancelOpacity(win);
  const target = readTarget();

  win.diffuseOpacityAnimation = set({
    window: win,
    duration: 1,
    type: Effect.Opacity,
    from: target,
    to: target,
  });

  print(
    "DIFFUSE:" +
      JSON.stringify({
        kind: "effect",
        reason: reason,
        fullScreen: win.fullScreen,
        windowClass: windowClass(win),
        target: target,
      })
  );
}

function refreshAll(reason) {
  for (const win of effects.stackingOrder) {
    applyOpacity(win, reason);
  }
}

function watchWindow(win) {
  if (!matchesEditor(win)) {
    return;
  }

  applyOpacity(win, "attach");

  win.windowFullScreenChanged.connect(function () {
    applyOpacity(win, "fullScreenChanged");
  });

  win.windowDesktopsChanged.connect(function () {
    applyOpacity(win, "desktopChanged");
  });
}

function init() {
  print(
    "DIFFUSE:" +
      JSON.stringify({
        kind: "effect",
        reason: "effect-started",
        target: readTarget(),
      })
  );

  effects.windowAdded.connect(watchWindow);
  effects.windowClosed.connect(cancelOpacity);
  effects.windowActivated.connect(function (win) {
    applyOpacity(win, "windowActivated");
  });

  effect.configChanged.connect(function () {
    refreshAll("configChanged");
  });

  for (const win of effects.stackingOrder) {
    watchWindow(win);
  }
}

init();
