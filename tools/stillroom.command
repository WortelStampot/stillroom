#!/bin/bash
# Stillroom viewing session.
# Puts the Mac into viewing settings (via the "Stillroom On" shortcut), opens Stillroom,
# and puts everything back (via "Stillroom Off") when you press Return.

ON="Stillroom On"
OFF="Stillroom Off"

here="$(cd "$(dirname "$0")" && pwd)"
page=""
for p in "$here/stillroom.html" "$HOME/Downloads/stillroom.html" "$HOME/Desktop/stillroom.html"; do
  if [ -f "$p" ]; then page="$p"; break; fi
done

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
  echo "Make both shortcuts first (see the setup steps), then run this again."
  exit 1
fi

if [ -z "$page" ]; then
  echo "Couldn't find stillroom.html next to this script, in Downloads, or on the Desktop."
  exit 1
fi

echo "Setting the screen for viewing…"
shortcuts run "$ON" || echo "The \"$ON\" shortcut reported a problem. Carrying on."

open -a Safari "$page"

echo
echo "Stillroom is open. Press F on the page for full screen."
echo "When you're done looking, come back here and press Return to restore your usual settings."
read -r

echo "Restoring your usual settings…"
shortcuts run "$OFF" || echo "The \"$OFF\" shortcut reported a problem."
echo "Done. You can close this window."
