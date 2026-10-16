#!/bin/bash
# Stillroom viewing session.
# Puts the Mac into viewing settings (via the "Stillroom On" shortcut), opens Stillroom,
# and puts everything back (via "Stillroom Off") when you press Return.
#
#   stillroom.command          opens the live site
#   stillroom.command dev      opens the dev site
#   stillroom.command local    opens stillroom.html from this folder, Downloads or the Desktop

ON="Stillroom On"
OFF="Stillroom Off"
LIVE="https://wortelstampot.github.io/stillroom/"
DEV="https://wortelstampot.github.io/stillroom/dev/"

case "${1:-live}" in
  live)  target="$LIVE" ;;
  dev)   target="$DEV" ;;
  local)
    here="$(cd "$(dirname "$0")" && pwd)"
    target=""
    for p in "$here/stillroom.html" "$HOME/Downloads/stillroom.html" "$HOME/Desktop/stillroom.html"; do
      if [ -f "$p" ]; then target="$p"; break; fi
    done
    if [ -z "$target" ]; then
      echo "Couldn't find stillroom.html next to this script, in Downloads, or on the Desktop."
      exit 1
    fi
    ;;
  *) echo "Use: stillroom.command [live|dev|local]"; exit 1 ;;
esac

if ! command -v shortcuts >/dev/null 2>&1; then
  echo "This Mac doesn't have the shortcuts command (it needs macOS 12 or later)."
  exit 1
fi

missing=0
for s in "$ON" "$OFF"; do
  if ! shortcuts list | grep -qxF "$s"; then
    echo "Couldn't find a shortcut named \"$s\" in the Shortcuts app."
    missing=1
  fi
done
if [ "$missing" = 1 ]; then
  echo "Make both shortcuts first, then run this again."
  exit 1
fi

echo "Setting the screen for viewing…"
shortcuts run "$ON" || echo "The \"$ON\" shortcut reported a problem. Carrying on."

open -a Safari "$target"

echo
echo "Stillroom is open ($target). Press F on the page for full screen."
echo "When you're done looking, come back here and press Return to restore your usual settings."
read -r

echo "Restoring your usual settings…"
shortcuts run "$OFF" || echo "The \"$OFF\" shortcut reported a problem."
echo "Done. You can close this window."
