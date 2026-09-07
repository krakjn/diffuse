# diffuse

Adjust VS Code / Cursor window opacity on Linux.

## Phase 1: VS Code extension (KDE Plasma Wayland)

Ctrl+Alt+Z decreases opacity; Ctrl+Alt+C increases it.

## Docker build (no host npm required)

```bash
just package                    # build image + write dist/*.vsix
OVSX_PAT=<token> just publish   # package + publish to Open VSX
just docker-build               # rebuild image only
just                            # list all recipes
```

Or manually:

```bash
docker compose run --rm package
export OVSX_PAT=<your-token>
docker compose run --rm publish
```

### Development (host npm)

```bash
npm install
npm run compile
```

Press **F5** in VS Code/Cursor to launch the Extension Development Host, or install the packaged VSIX from `dist/`:

```bash
docker compose run --rm package
# Extensions → Install from VSIX → dist/diffuse-0.1.0.vsix
```

### Phase -1 harness (still available)

```bash
just kwin-list
just kwin-decrease
just kwin-increase
```

### KWin script layout

```
kwin/
├── adjust-opacity.js   # @diffuse-kwin-script-version 1
└── list-windows.js
```

No `v1/` folder until a second script version is needed. Version is tracked in the file header and `KWIN_SCRIPT_VERSION` in TypeScript.

### Supported (v0.1.0)

| Desktop | Status |
|---------|--------|
| KDE Plasma Wayland | Yes |
| GNOME Wayland | Phase 2 |
| Hyprland | Phase 3 |

### Target editors

| Editor | resourceClass |
|--------|---------------|
| Cursor | `cursor` |
| VS Code | `code` |
| VSCodium | `vscodium` |
| Code-OSS | `code-oss` |
