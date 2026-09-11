import * as assert from "assert";
import {
  buildMainProcessInjection,
  isContentPatched,
  prependPatch,
  stripAllPatches,
  stripOnePatch,
  PATCH_TAG_END,
  PATCH_TAG_START,
} from "./patch-content";

const ORIGINAL = `import { app } from "electron";
app.whenReady().then(() => {});
`;

function patchedOnce(): string {
  return prependPatch(ORIGINAL, buildMainProcessInjection("/tmp/.diffuse-config.json"));
}

function run(): void {
  const once = patchedOnce();
  assert.equal(isContentPatched(once), true);
  assert.equal(isContentPatched(ORIGINAL), false);
  assert.ok(once.startsWith(PATCH_TAG_START));
  assert.ok(once.includes("w.setOpacity"));
  assert.ok(once.includes("/tmp/.diffuse-config.json"));
  assert.ok(once.includes(ORIGINAL));

  const stripped = stripOnePatch(once);
  assert.equal(stripped, ORIGINAL);
  assert.equal(isContentPatched(stripped), false);

  const doubled = prependPatch(once, buildMainProcessInjection("/tmp/.diffuse-config.json"));
  const all = stripAllPatches(doubled);
  assert.equal(all.removed, 2);
  assert.equal(all.content, ORIGINAL);

  const malformed = `${PATCH_TAG_START}\nimport {app} from "electron";\n${ORIGINAL}`;
  const stuck = stripAllPatches(malformed);
  assert.equal(stuck.removed, 0);
  assert.equal(stuck.content, malformed);
  assert.equal(stripOnePatch(malformed), malformed);

  const injection = buildMainProcessInjection("/Users/test/.diffuse-config.json");
  assert.ok(injection.includes(PATCH_TAG_START));
  assert.ok(injection.includes(PATCH_TAG_END));
  assert.ok(injection.includes("Diffuse_app"));
  assert.ok(injection.includes("0.05"));
}

run();
