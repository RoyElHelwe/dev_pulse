// Copies Excalidraw's fonts into public/excalidraw/ so the whiteboard loads them from the app,
// not from a CDN (the office may run on a LAN without internet). Run before `next dev` / `next build`.
import { cpSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// The package's main entry is dist/prod/index.js; the fonts sit next to it.
const from = join(dirname(createRequire(import.meta.url).resolve('@excalidraw/excalidraw')), 'fonts');
const to = join(root, 'public', 'excalidraw', 'fonts');

if (!existsSync(from)) throw new Error(`Excalidraw fonts not found at ${from}`);
cpSync(from, to, { recursive: true });
console.log('Copied Excalidraw fonts to public/excalidraw/fonts');
