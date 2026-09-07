# Diffuse

![Diffuse](assets/icon.png)

Adjust editor window opacity on Linux with keyboard shortcuts.

| Shortcut | Action |
|----------|--------|
| `Ctrl+Alt+Z` | Decrease opacity (more transparent) |
| `Ctrl+Alt+C` | Increase opacity (more opaque) |

The status bar shows your desktop environment and current opacity, for example `Diffuse: KDE Plasma 85%`.

## Install

1. Build the VSIX: `just build` (see [Development](docs/DEVELOPMENT.md)).
2. Install: `just install` (or `cursor --install-extension dist/diffuse-0.1.0.vsix`).
3. **Reload Window** — `Ctrl+Shift+P` → **Developer: Reload Window** (required after first install).
4. Confirm the status bar shows `Diffuse: …` and test the shortcuts above.

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

## Development

Build, package, publish, and contributor docs: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Architecture and adding backends: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT — see [LICENSE](LICENSE).
