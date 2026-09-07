#!/usr/bin/env bash
# Run a versioned diffuse KWin script ephemerally via session D-Bus.
#
# Usage:
#   ./scripts/run-kwin.sh decrease|increase   Adjust editor window opacity
#   ./scripts/run-kwin.sh list                  List windows (debug)

set -euo pipefail

ACTION="${1:?usage: decrease|increase|list}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_VERSION="1"

if [[ "$ACTION" == "list" ]]; then
  SCRIPT="$REPO_ROOT/kwin/list-windows.js"
  STEP=""
else
  SCRIPT="$REPO_ROOT/kwin/adjust-opacity.js"
  case "$ACTION" in
    decrease) STEP="-0.05" ;;
    increase) STEP="0.05" ;;
    *) echo "unknown action: $ACTION" >&2; exit 1 ;;
  esac
fi

if [[ ! -f "$SCRIPT" ]]; then
  echo "script not found: $SCRIPT" >&2
  exit 1
fi

QDBUS=""
for candidate in qdbus6 qdbus qdbus-qt6; do
  if command -v "$candidate" >/dev/null 2>&1; then
    QDBUS="$candidate"
    break
  fi
done
if [[ -z "$QDBUS" ]]; then
  echo "qdbus not found (install qt6-tools or kde-cli-tools)" >&2
  exit 1
fi

TMP="$(mktemp "/tmp/diffuse-kwin-${SCRIPT_VERSION}-XXXXXX.js")"
trap 'rm -f "$TMP"' EXIT

if [[ -n "$STEP" ]]; then
  sed "s/step: -0.05/step: ${STEP}/" "$SCRIPT" > "$TMP"
else
  cp "$SCRIPT" "$TMP"
fi

load_reply="$("$QDBUS" org.kde.KWin /Scripting org.kde.kwin.Scripting.loadScript "$TMP")"
NUM="${load_reply##*/Script}"
if [[ "$NUM" == "$load_reply" ]]; then
  NUM="$load_reply"
fi

"$QDBUS" org.kde.KWin "/Scripting/Script${NUM}" org.kde.kwin.Script.run >/dev/null
"$QDBUS" org.kde.KWin "/Scripting/Script${NUM}" org.kde.kwin.Script.stop >/dev/null

sleep 0.2
OUTPUT="$(journalctl _COMM=kwin_wayland -o cat --since "2 seconds ago" 2>/dev/null \
  | sed -n 's/^js: DIFFUSE://p;s/^DIFFUSE://p')"

if [[ "$ACTION" == "list" ]]; then
  printf '%s\n' "$OUTPUT"
else
  printf '%s\n' "$OUTPUT" | tail -1
fi
