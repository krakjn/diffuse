/*
 * Diffuse KWin effect — live compositor opacity via Effect.Opacity.
 * target is read from effect config on every change; the effect stays loaded.
 * EDITOR_CLASSES is injected at install from src/targets.ts.
 *
 * A live Opacity animation takes a paint ref that overrides
 * PAINT_DISABLED_BY_DESKTOP / MINIMIZE, so we only hold it while the
 * window is actually visible.
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

function desiredOpacity(win) {
  const target = readTarget();
  if (target >= 1.0) {
    return undefined;
  }
  if (!win.onCurrentDesktop) {
    return undefined;
  }
  if (win.minimized) {
    return undefined;
  }
  if (win.hiddenByShowDesktop) {
    return undefined;
  }
  return target;
}

function cancelOpacity(win) {
  if (win.diffuseOpacityAnimation !== undefined) {
    cancel(win.diffuseOpacityAnimation);
    win.diffuseOpacityAnimation = undefined;
  }
  win.diffuseOpacityTarget = undefined;
}

function applyOpacity(win, reason) {
  if (!matchesEditor(win)) {
    return;
  }

  const want = desiredOpacity(win);
  if (want === win.diffuseOpacityTarget) {
    return;
  }

  cancelOpacity(win);

  if (want !== undefined) {
    win.diffuseOpacityAnimation = set({
      window: win,
      duration: 1,
      type: Effect.Opacity,
      from: want,
      to: want,
    });
    win.diffuseOpacityTarget = want;
  }

  // cancel() schedules no repaint and set() only schedules a layer repaint,
  // which the scene culls once the window is opaque again.
  effects.addRepaintFull();

  print(
    "DIFFUSE:" +
      JSON.stringify({
        kind: "effect",
        reason: reason,
        fullScreen: win.fullScreen,
        windowClass: windowClass(win),
        target: want === undefined ? readTarget() : want,
        pinned: want !== undefined,
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
    applyOpacity(win, "windowDesktopsChanged");
  });

  win.minimizedChanged.connect(function () {
    applyOpacity(win, "minimizedChanged");
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

  effects.desktopChanged.connect(function () {
    refreshAll("currentDesktopChanged");
  });
  effects.showingDesktopChanged.connect(function () {
    refreshAll("showingDesktopChanged");
  });

  effect.configChanged.connect(function () {
    refreshAll("configChanged");
  });

  for (const win of effects.stackingOrder) {
    watchWindow(win);
  }
}

init();
