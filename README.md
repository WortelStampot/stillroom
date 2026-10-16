# Stillroom

A quiet viewer for public-domain paintings, drawings and prints from the Art Institute of Chicago.
One work at a time, no name attached until you ask for it.

- **Live:** https://wortelstampot.github.io/stillroom/
- **Dev:** https://wortelstampot.github.io/stillroom/dev/

## How changes move

1. Work happens on the `dev` branch. Every push to `dev` republishes the dev site within a minute or two.
2. When the dev site looks right, merge `dev` into `main`. That republishes the live site.
3. Never edit `gh-pages` by hand; the Publish workflow rebuilds it from `main` and `dev` each time.

The dev site keeps its own kept pile, separate from the live one, and says "Stillroom · dev" in the corner.
Each page carries the branch, commit and time it was published; the session log (press D) records it.

## Keys

→ / Space next · ← back · K keep · I label · scroll or pinch to zoom · drag to move · G glide ·
Esc or 0 whole work · P kept pile · F full screen · H keep controls showing · D save session log

## Images and data

Images and records come from the [Art Institute of Chicago API](https://api.artic.edu/docs)
and its IIIF image server. Only works the museum marks as public domain are shown.

`tools/stillroom.command` sets the Mac's screen for viewing (see comments inside).
