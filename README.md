# Diffuse

[![Open VSX](https://img.shields.io/open-vsx/v/krakjn/diffuse?label=Open%20VSX&logo=eclipse)](https://open-vsx.org/extension/krakjn/diffuse)
[![Downloads](https://img.shields.io/open-vsx/dt/krakjn/diffuse?label=downloads&logo=eclipse)](https://open-vsx.org/extension/krakjn/diffuse)


![Diffuse](assets/icon.png)

Diffused light. Adjust window opacity on Linux [Wayland and X11], Windows, and macOS

![image](/assets/example.png)

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+Z` (`Cmd+Option+Z` on macOS) | Decrease opacity (more transparent) |
| `Ctrl+Alt+C` (`Cmd+Option+C` on macOS) | Increase opacity (less transparent) |
| `Ctrl+Alt+X` (`Cmd+Option+X` on macOS) | Reset to `diffuse.maxOpacity` (default 1.0). On Hyprland, reset returns to `decoration.active_opacity` from the compositor config. |

On Linux, those chords never reach the editor if the desktop already owns them. For example, KDE Plasma's **Mouse Tiler** KWin shortcuts default to `Ctrl+Alt+C` / `Ctrl+Alt+X`. Clear or remap them under **System Settings → Keyboard → Shortcuts → KWin**. Command Palette **Diffuse: Reset Opacity** still works either way.

Uninstalling Diffuse on KDE removes the `diffuse_opacity` KWin effect and deletes its keys from `kwinrc` via `kwriteconfig`. On Plasma Wayland the editor stays composited while it is translucent and visible (no direct scanout).

### [CHANGELOG](#changelog)

## Supported platforms

| Platform |  Status |
|----------| --------|
| Linux: KDE [Wayland,X11] | Supported |
| Linux: Hyprland 0.55+ [Wayland] | Supported |
| Linux: GNOME [Wayland,X11] | Supported |
| Linux: Sway [Wayland,X11] | Supported |
| Linux: any desktop [X11] | Supported |
| Windows | Supported |
| macOS | [Supported](#macos) |

Diffuse probes the candidates for your session in order and uses the first that
works. Set `diffuse.backend` to skip probing and force one.

X11 opacity needs a compositing manager — picom, xcompmgr, or your desktop's
built-in compositor. Without one the property is set and then ignored.

## Supported editors

Diffuse targets editor windows by window class on Linux and by process name on
Windows:

| Editor | Class |
|--------|-------|
| VS Code | `code` |
| VSCodium | `vscodium` |
| Code-OSS | `code-oss` |
| Cursor | `cursor` |

On macOS the patch applies to the running editor. Diffuse also looks in
`/Applications` and `~/Applications` for VS Code, VS Code Insiders, Cursor,
VSCodium, Code - OSS, Windsurf, and Antigravity.

## Settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `diffuse.step` | `0.025` | Opacity change per keypress |
| `diffuse.minOpacity` | `0.25` | Lower bound |
| `diffuse.maxOpacity` | `1.0` | Upper bound; reset returns here except on Hyprland |
| `diffuse.backend` | `auto` | Force a backend instead of probing |
| `diffuse.macosAutoRestartAfterUpdate` | `false` | On macOS, restart automatically after an editor update so the patch is loaded |

## Credits

Diffuse was inspired by [GlassIt-VSC](https://github.com/hikarin522/GlassIt-VSC).
The move to wayland prevented GlassIt from working, which was the motivation of `diffuse`.

Hunting around for macOS support, I found [Glassy](https://github.com/optimistengineer/glassy)
really elegant approach which I emulated in `diffuse`

### [MIT License](/LICENSE)

## NOTES:

### macOS

1. Open the Command Palette (`Cmd+Shift+P`)
2. Run **Diffuse: Enable macOS Transparency**
3. Confirm the warning — this rewrites the editor's `out/main.js`
4. Restart when prompted, or quit and reopen the editor

After that, the usual opacity shortcuts write `~/.diffuse-config.json` and the
patched main process applies `BrowserWindow.setOpacity()` to the current
windows.

If an editor update overwrites `main.js`, Diffuse re-applies the patch on
startup when you previously opted in. A restart is still required for the new
file to load. Set `diffuse.macosAutoRestartAfterUpdate` if you would rather skip
the prompt.

To undo: **Diffuse: Disable macOS Transparency**, then restart. Uninstall the
extension only after the patch is gone.

### Hyprland

Keybinds change only the focused editor window (`address:`). Closing that
window drops the override; a new window comes back at Hyprland's
`decoration.active_opacity`. Diffuse does not edit `hyprland.lua`.

To persist a value across window close without touching the rest of your
config, add one line to `~/.config/hypr/hyprland.lua`:

```lua
require("diffuse") -- ~/.config/hypr/diffuse.lua
```

```lua
-- ~/.config/hypr/diffuse.lua
hl.window_rule({
  name = "diffuse-editors",
  match = { class = "^(cursor|code|vscodium|code-oss)$" },
  opacity = "0.85 override 0.85 override 0.85 override",
})
```

That rule is class-wide. The live shortcuts stay per-window.

Hyprland older than 0.55 is not supported (Lua `set_prop` only).

### Known limitations

- **macOS requires patching the editor.** That may trigger a modified or
  corrupt installation warning. Enable and disable both need a restart.
- **Updates undo the patch.** Diffuse re-applies it when you opted in, but some
  updates still need a manual restart.
- **Transparency is the whole window**, including text. There is no blur or
  vibrancy.
- **The app bundle must be writable.** Installations in `/Applications` owned
  by root need `chown`, or copy the app to `~/Applications`. App Translocation
  (quarantine) can also make the bundle read-only.
- **Do not stack patches.** Uninstall Glassy or Vibrancy Continued first — they
  also rewrite `main.js`.
- **The injection is ESM.** Current VS Code, Cursor, VSCodium, Windsurf, and
  Antigravity builds use an ESM `main.js`. A CommonJS main process would not
  load the patch.
- **X11 needs a compositor.** Without picom, xcompmgr, or the desktop's own
  compositor, `_NET_WM_WINDOW_OPACITY` is set and then ignored.
- **Hyprland needs 0.55+.** Older releases do not speak the Lua dispatcher API.

# CHANGELOG

## 1.3.0

- fix KDE windowing bug: upon switching workspaces the code window would follow this has been resolved

## 1.2.0

- fix full screen bug in kde
- added hyprland support!

## 1.1.0

- Added support for macOS
- provided helpers to warn users upon install


## 1.0.0
- Full support for Linux and Windows