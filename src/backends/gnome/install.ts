import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { runtimeDir } from "../../runtime-paths";

export const GNOME_EXTENSION_UUID = "diffuse@krakjn.github.io";

const FILES = ["metadata.json", "extension.js"];

export function gnomeExtensionDir(): string {
  return path.join(
    os.homedir(),
    ".local",
    "share",
    "gnome-shell",
    "extensions",
    GNOME_EXTENSION_UUID
  );
}

export async function isGnomeExtensionInstalled(): Promise<boolean> {
  try {
    await fs.access(path.join(gnomeExtensionDir(), "metadata.json"));
    return true;
  } catch {
    return false;
  }
}

/** Copy the companion Shell extension into the user's extension directory. */
export async function installGnomeExtension(
  extensionPath: string
): Promise<string> {
  const source = runtimeDir(extensionPath, "gnome");
  const destination = gnomeExtensionDir();

  await fs.mkdir(destination, { recursive: true });
  for (const file of FILES) {
    await fs.copyFile(path.join(source, file), path.join(destination, file));
  }

  return destination;
}
