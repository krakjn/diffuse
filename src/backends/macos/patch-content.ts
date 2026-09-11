/**
 * Pure helpers for the Electron main-process patch.
 *
 * The injected block is prepended to `out/main.js` so its static `import`s
 * hoist before the editor's own code, and `browser-window-created` fires
 * before the first window exists.
 *
 * Technique follows Glassy (MIT): https://github.com/optimistengineer/glassy
 */

export const PATCH_TAG_START = "// [Diffuse:START]";
export const PATCH_TAG_END = "// [Diffuse:END]";
export const BACKUP_SUFFIX = ".diffuse-backup";

/** Floor the injected code will honour so a window can never go fully invisible. */
export const INJECTION_MIN_OPACITY = 0.05;

export function isContentPatched(content: string): boolean {
  const startIdx = content.indexOf(PATCH_TAG_START);
  if (startIdx === -1) {
    return false;
  }
  return content.indexOf(PATCH_TAG_END, startIdx + PATCH_TAG_START.length) !== -1;
}

/**
 * Strip one Diffuse patch block. Returns the original string when the tags
 * are missing or unpaired (caller decides whether to restore from backup).
 */
export function stripOnePatch(content: string): string {
  const startIdx = content.indexOf(PATCH_TAG_START);
  if (startIdx === -1) {
    return content;
  }

  const endIdx = content.indexOf(PATCH_TAG_END, startIdx + PATCH_TAG_START.length);
  if (endIdx === -1) {
    return content;
  }

  const removeStart = startIdx === 0 ? 0 : content.lastIndexOf("\n", startIdx);
  let removeEnd = endIdx + PATCH_TAG_END.length;
  if (content[removeEnd] === "\n") {
    removeEnd += 1;
  }
  return (
    content.substring(0, removeStart >= 0 ? removeStart : 0) +
    content.substring(removeEnd)
  );
}

/** Remove every well-formed Diffuse patch. Stops if a malformed block remains. */
export function stripAllPatches(content: string): { content: string; removed: number } {
  let current = content;
  let removed = 0;
  while (current.includes(PATCH_TAG_START)) {
    const next = stripOnePatch(current);
    if (next === current) {
      break;
    }
    current = next;
    removed += 1;
  }
  return { content: current, removed };
}

export function prependPatch(content: string, injection: string): string {
  return `${injection}\n${content}`;
}

export function buildMainProcessInjection(configPath: string): string {
  const escaped = configPath.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const min = INJECTION_MIN_OPACITY;
  return `${PATCH_TAG_START}
import { app as Diffuse_app, BrowserWindow as Diffuse_BW } from "electron";
import { readFileSync as Diffuse_rf, existsSync as Diffuse_ex, watchFile as Diffuse_wf } from "fs";
;(() => {
  try {
    const Diffuse_cp = '${escaped}';
    let Diffuse_o = 1;
    const Diffuse_seen = new WeakSet();
    const Diffuse_apply = (w) => {
      try {
        if (!Diffuse_seen.has(w)) {
          Diffuse_seen.add(w);
          if (Diffuse_o >= 1) w.setOpacity(0.999);
        }
        w.setOpacity(Diffuse_o);
      } catch (e) {}
    };
    const Diffuse_read = () => {
      try {
        if (!Diffuse_ex(Diffuse_cp)) return;
        const c = JSON.parse(Diffuse_rf(Diffuse_cp, "utf8"));
        if (typeof c.opacity === "number" && c.opacity >= ${min} && c.opacity <= 1) {
          Diffuse_o = c.opacity;
        }
      } catch (e) {}
    };
    Diffuse_read();
    Diffuse_app.on("browser-window-created", (_e, w) => { Diffuse_apply(w); });
    const Diffuse_applyAll = () => {
      Diffuse_read();
      Diffuse_BW.getAllWindows().forEach(Diffuse_apply);
    };
    Diffuse_app.whenReady().then(() => {
      Diffuse_applyAll();
      Diffuse_wf(Diffuse_cp, { interval: 500 }, Diffuse_applyAll);
    });
  } catch (e) {}
})();
${PATCH_TAG_END}`;
}
