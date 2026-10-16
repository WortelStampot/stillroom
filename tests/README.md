# Stillroom tests

Headless checks that run Stillroom against stand-ins for the museums' APIs and image servers,
so they need no network. They test `../index.html` unless `STILLROOM_PAGE` points elsewhere.
Python 3 with Pillow makes the stand-in images; Chromium comes from `CHROMIUM` (default `/opt/pw-browsers/chromium`).

    npm install
    npm run edges      # controls hidden after a keypress, shown at each edge, H pins; zoom in and back out
    npm run failures   # a small original loads at its own width; a broken work retries 3 ways, then moves on
    npm run log        # browse, zoom, press D: prints the saved session log
    npm run persist    # the log survives closing the tab; D saves every session since the last D
    npm run zoom       # zoom, Glide and the fallback when tiles fail; writes screenshots here
    npm run rijks      # both museums: the mix, no in-copyright works, label, pile, zoom; then the Art Institute down
    npm run soak       # 40 works with zooming on a slow server: time to appear, requests in flight, memory

Expected from the Oct 16, 2026 build: soak shows 0 stuck, at most 5 requests in flight, works appearing in about 0.35 s.
