// @diffuse-kwin-script-version 1
// @diffuse-api list-windows-debug

for (const win of workspace.windowList()) {
  if (win.normalWindow) {
    print(
      "DIFFUSE:" +
        JSON.stringify({
          resourceClass: win.resourceClass,
          resourceName: win.resourceName,
          caption: win.caption,
          opacity: Number(win.opacity.toFixed(4)),
          active: win.active,
        })
    );
  }
}
