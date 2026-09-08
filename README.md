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
| Hyprland | `hyprctl` | Supported |
| Sway | `swaymsg` | Supported |
| X11, any desktop | `xprop` | Supported |
| GNOME Wayland | XWayland via `xprop`, else companion Shell extension | Supported |
| Windows | `SetLayeredWindowAttributes` | Supported |
| macOS | yabai | [Opt-in](#macos-workaround) |

Diffuse probes the candidates for your session in order and uses the first that
works, so KDE on X11, XFCE, i3, MATE, and Cinnamon all land on `xprop` without
any desktop-specific code. Set `diffuse.backend` to skip probing and force one.

X11 opacity needs a compositing manager — picom, xcompmgr, or your desktop's
built-in compositor. Without one the property is set and then ignored.

## Supported editors

Diffuse targets editor windows by window class on Linux and by process name on
Windows and macOS:

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

##### GNOME Wayland

Electron normally runs through XWayland, where Mutter honours
`_NET_WM_WINDOW_OPACITY` and the `xprop` backend already works. If your editor
runs as a native Wayland client, run **Diffuse: Install GNOME Shell Extension**,
enable it in the Extensions app, and log out and back in.

##### macOS workaround

macOS has no public API for changing another application's window opacity, so
Diffuse delegates to [yabai](https://github.com/koekeishiya/yabai) when it finds
it. **Diffuse installs nothing, loads nothing, and changes no system settings.**
You elect this setup yourself.

> Step 2 partially disables System Integrity Protection, which lowers your Mac's
> security. Read [yabai's own writeup][sip] and decide for yourself.

1. Install and start yabai:

   ```bash
   brew install koekeishiya/formulae/yabai
   yabai --start-service
   ```

2. Partially disable SIP. Hold the power button until "Loading startup options"
   appears, click **Options** then **Continue**, and choose **Utilities** →
   **Terminal**:

   ```bash
   # Apple Silicon, macOS 13 or newer
   csrutil enable --without fs --without debug --without nvram

   # Intel
   csrutil disable --with kext --with dtrace --with nvram --with basesystem
   ```

   Reboot.

3. Apple Silicon only — allow non-Apple-signed arm64e binaries, then reboot again:

   ```bash
   sudo nvram boot-args=-arm64e_preview_abi
   ```

4. Load the scripting addition and enable opacity:

   ```bash
   sudo yabai --load-sa
   yabai -m config window_opacity on
   ```

   To survive a Dock restart, add a `dock_did_restart` signal to `~/.yabairc`
   and a NOPASSWD entry to `/private/etc/sudoers.d/yabai`, both covered in the
   [yabai wiki][sip].

5. Verify with your editor focused:

   ```bash
   yabai -m window --opacity 0.85
   ```

   If that dims the window, the Diffuse shortcuts will too, and the status bar
   stops reading `opacity: unsupported`.

Known snags, so failures do not get misattributed to Diffuse: macOS 26 Tahoe
refuses the `-arm64e_preview_abi` boot-arg on some machines, and yabai 7.1.17 has
open payload-injection reports. Check yabai's issue tracker first.

[sip]: https://github.com/koekeishiya/yabai/wiki/Disabling-System-Integrity-Protection

