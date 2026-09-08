# Diffuse

![Diffuse](assets/icon.png)

Adjust editor window opacity on Linux with keyboard shortcuts.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+Z` | Decrease opacity (more transparent) |
| `Ctrl+Alt+C` | Increase opacity (more opaque) |

The status bar shows current opacity, for example `opacity: 85%`.


## Supported desktop environments

| Desktop | Status |
|---------|--------|
| KDE Plasma Wayland | Supported |
| GNOME Wayland | Planned |
| Hyprland | Planned |

X11 sessions are not supported.

## Supported editors

Diffuse targets editor windows by `resourceClass`:

| Editor | resourceClass |
|--------|---------------|
| Cursor | `cursor` |
| VS Code | `code` |
| VSCodium | `vscodium` |
| Code-OSS | `code-oss` |

### MIT License
