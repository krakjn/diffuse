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

## Publish (Open VSX)

Cursor and VSCodium install third-party extensions from [Open VSX](https://open-vsx.org), not the Microsoft Marketplace. Diffuse is listed as [`krakjn.diffuse`](https://open-vsx.org/extension/krakjn/diffuse).

### Release a version

1. Bump `version` in `package.json`.
2. `just build`
3. Publish the VSIX (`OVSX_PAT` is a token from [Open VSX access tokens](https://open-vsx.org/user-settings/tokens)):

```bash
just publish
```

Official VS Code users still need a separate `vsce publish` to the Visual Studio Marketplace. That is optional and does not replace Open VSX.

### Claim namespace ownership (verified listing)

Creating the `krakjn` namespace made the publisher a **contributor**, not an owner. Without an owner, Open VSX marks the listing **unverified** (warning icon). Ownership is granted by Eclipse, not by `package.json`.

Claim it once, as GitHub user **krakjn** (the Open VSX login):

1. Sign in at [open-vsx.org](https://open-vsx.org) at least once (required).
2. Open the [namespace claim form](https://github.com/EclipseFdn/open-vsx.org/issues/new?template=claim-namespace-ownership.yml&title=Claiming%20namespace%20krakjn).
3. Fill it as **Option 3** (not a VS Code Marketplace publisher). Use this body:

```markdown
### Namespace
krakjn

### Ownership
- [x] The namespace is not currently owned on Open VSX

### Account Age
- [x] The GitHub ID making this request has at least 12 months of public history

### VS Code Publisher with Repo
- [ ] (leave unchecked — not on the VS Code Marketplace)

### VS Code Publisher without Repo
- [ ] (leave unchecked)

### Not a VS Code Marketplace Publisher
- [x] The namespace is not a publisher account on the VS Code Marketplace
- [x] The namespace matches the GitHub ID making this request

### All Other Cases
- [ ] (leave unchecked)

### Claim evidence
GitHub ID `krakjn` matches the Open VSX namespace and publisher field.

- GitHub: https://github.com/krakjn (account created 2020-11-24)
- Extension repo: https://github.com/krakjn/diffuse
- Open VSX listing: https://open-vsx.org/extension/krakjn/diffuse
- Commit by this GitHub ID: https://github.com/krakjn/diffuse/commit/99d3fcedd6f7aade3c1cee6378eae34e80dc4c25
```

Eclipse will grant ownership on that issue. After that, versions published by a namespace member show as verified.
