# Art Lab

Design tool used to make character and desk recipes: a standalone page running the game's own scenery and art code on a 2D canvas via `shim.ts` (no Phaser), showing a live office diorama, studio, lineup, and palette.

## Why outside the app

Not shipped with the app. Kept in `tools/` to avoid bloating the production web bundle while directly reading game modules from `apps/web/game` and office templates from `apps/api`.

## Build and Run

Build from repo root:
```bash
npx esbuild tools/art-lab/entry.ts --bundle --minify --outfile=lab.js
```

To open:
- Paste `lab.js` into the `<script id="lab">` tag in `tools/art-lab/lab.html` and open `lab.html` in a browser.
- Alternatively, add `<script src="lab.js"></script>` and serve `tools/art-lab/` with a static server (e.g. `npx serve tools/art-lab`).
