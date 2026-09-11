import assert from "node:assert/strict";
import { isHyprlandSupported, parseHyprlandVersion } from "./hyprland";

assert.deepEqual(parseHyprlandVersion("v0.55.0"), { major: 0, minor: 55 });
assert.deepEqual(parseHyprlandVersion("0.56.2"), { major: 0, minor: 56 });
assert.deepEqual(parseHyprlandVersion("v0.55.0-12-gabcdef"), {
  major: 0,
  minor: 55,
});
assert.equal(parseHyprlandVersion("not-a-version"), null);

assert.equal(isHyprlandSupported({ major: 0, minor: 55 }), true);
assert.equal(isHyprlandSupported({ major: 0, minor: 56 }), true);
assert.equal(isHyprlandSupported({ major: 1, minor: 0 }), true);
assert.equal(isHyprlandSupported({ major: 0, minor: 54 }), false);

console.log("hyprland version parse: ok");
