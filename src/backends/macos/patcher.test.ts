import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { BACKUP_SUFFIX, isContentPatched } from "./patch-content";
import { installPatchAt, uninstallPatchAt } from "./patcher";

const ORIGINAL = `import { app } from "electron";
app.whenReady().then(() => {});
`;

function run(): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "diffuse-patch-"));
  const mainPath = path.join(dir, "main.js");
  const configPath = path.join(dir, "config.json");
  fs.writeFileSync(mainPath, ORIGINAL, "utf8");

  const installed = installPatchAt(mainPath, configPath);
  assert.equal(installed.success, true, installed.message);
  const patched = fs.readFileSync(mainPath, "utf8");
  assert.equal(isContentPatched(patched), true);
  assert.ok(patched.includes(configPath));
  assert.ok(fs.existsSync(mainPath + BACKUP_SUFFIX));
  assert.equal(fs.readFileSync(mainPath + BACKUP_SUFFIX, "utf8"), ORIGINAL);

  const again = installPatchAt(mainPath, configPath);
  assert.equal(again.success, true, again.message);
  const patchedAgain = fs.readFileSync(mainPath, "utf8");
  const starts = patchedAgain.split("// [Diffuse:START]").length - 1;
  assert.equal(starts, 1);

  const removed = uninstallPatchAt(mainPath);
  assert.equal(removed.success, true, removed.message);
  assert.equal(fs.readFileSync(mainPath, "utf8"), ORIGINAL);
  assert.equal(fs.existsSync(mainPath + BACKUP_SUFFIX), false);

  const noop = uninstallPatchAt(mainPath);
  assert.equal(noop.success, true, noop.message);

  fs.rmSync(dir, { recursive: true, force: true });
}

run();
