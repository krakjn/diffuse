# Development

Contributor guide for building and installing Diffuse.

## Prerequisites

- **Docker**
- **Cursor** (or VS Code) for install

## Quick start

```bash
just img      # build Docker image (first time, or after Dockerfile changes)
just build    # package VSIX to dist/
just install  # install dist/diffuse-*.vsix into Cursor
```

Then reload the window: `Ctrl+Shift+P` → **Developer: Reload Window**.

`just build` depends on `just img`, so a single `just build` rebuilds the image and packages the extension.

## Install troubleshooting

**`[DEP0169] DeprecationWarning: url.parse()`** when running `cursor --install-extension`:

```
(node:…) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized…
```

This is harmless. It comes from Cursor/Electron's CLI, not from Diffuse. Ignore it. Success looks like:

```
Extension 'diffuse-0.1.0.vsix' was successfully installed.
```

If shortcuts or the status bar do not appear, reload the window.

## KWin harness

Standalone script runner for debugging KWin integration without the extension:

```bash
./scripts/run-kwin.sh list
./scripts/run-kwin.sh decrease
./scripts/run-kwin.sh increase
```

Scripts live in `kwin/`:

```
kwin/
├── adjust-opacity.js   # @diffuse-kwin-script-version 1
└── list-windows.js
```

The `DIFFUSE` params block in `adjust-opacity.js` is injected at runtime by both the extension (`kwin-runner.ts`) and `scripts/run-kwin.sh`.

## Supported targets (v0.1.0)

| Desktop | Status |
|---------|--------|
| KDE Plasma Wayland | Supported |
| GNOME Wayland | Phase 2 |
| Hyprland | Phase 3 |

See [ARCHITECTURE.md](ARCHITECTURE.md) for backend design and how to add new compositors.

## Target editors

| Editor | resourceClass |
|--------|---------------|
| Cursor | `cursor` |
| VS Code | `code` |
| VSCodium | `vscodium` |
| Code-OSS | `code-oss` |
