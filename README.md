# Diffuse

![Diffuse](assets/icon.png)

Adjust editor window transparency/opacity with keyboard shortcuts.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+Z` | Decrease opacity (more transparent) |
| `Ctrl+Alt+C` | Increase opacity (less transparent) |

The status bar shows current opacity, for example `opacity: 85%`.

## Supported platforms

| Platform | Backend | Status |
|----------|---------|--------|
| KDE Plasma Wayland | KWin script over D-Bus | Supported |
| Sway | `swaymsg` | Supported |
| X11, any desktop | `xprop` | Supported |
| GNOME X11 | `xprop` | Confirmed |
| GNOME Wayland | XWayland via `xprop`, else companion Shell extension | Supported |
| Windows | `SetLayeredWindowAttributes` | Supported |
| macOS | — | [Not supported](#why-not-macos) |

Diffuse probes the candidates for your session in order and uses the first that
works, so KDE on X11, GNOME on X11, XFCE, i3, MATE, and Cinnamon all land on
`xprop` without any desktop-specific code. Set `diffuse.backend` to skip probing
and force one.

Hyprland already owns window opacity in its own config. Diffuse detects that
session and stays out of the way.

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

## Settings

| Setting | Default | Meaning |
|---------|---------|---------|
| `diffuse.step` | `0.025` | Opacity change per keypress |
| `diffuse.minOpacity` | `0.25` | Lower bound |
| `diffuse.maxOpacity` | `1` | Upper bound |
| `diffuse.backend` | `auto` | Force a backend instead of probing |
| `diffuse.showStatusBar` | `true` | Show current opacity in the status bar |

## Credits

Diffuse is inspired by [GlassIt-VSC](https://github.com/hikarin522/GlassIt-VSC)
by [hikarin522](https://github.com/hikarin522) — the extension that proved editor
transparency was worth having, and whose `Ctrl+Alt+Z` / `Ctrl+Alt+C` bindings
Diffuse deliberately keeps so muscle memory carries over. GlassIt-VSC is MIT
licensed and is itself a port of the
[GlassIt](https://packagecontrol.io/packages/GlassIt) plugin for Sublime Text.

### MIT License

#### NOTES:

##### GNOME

GNOME on X11 is confirmed: Mutter honours `_NET_WM_WINDOW_OPACITY`, so the
`xprop` backend is enough.

On GNOME Wayland, Electron normally still runs through XWayland and the same
path works. If your editor is a native Wayland client, run **Diffuse: Install
GNOME Shell Extension**, enable it in the Extensions app, and log out and back
in.

##### Why not macOS

macOS has no public API for changing another application's window opacity, and
the private one does not work from outside the owning process. Calling
`CGSSetWindowAlpha` on another app's window returns `kCGErrorSuccess` and
changes nothing — the WindowServer refuses silently rather than erroring.

That leaves two real options, and Diffuse takes neither:

| Approach | What it costs |
|----------|---------------|
| [yabai](https://github.com/koekeishiya/yabai) | injects a scripting addition into Dock.app, which needs System Integrity Protection partially disabled |
| [Vibrancy Continued](https://github.com/illixion/vscode-vibrancy-continued) | rewrites the editor's own files so the code runs inside the process that owns the window |

Asking you to weaken SIP or patch your editor is more than a transparency
toggle is worth. If you want either, install those projects directly — they do
it well and they are honest about the tradeoff.
