// Writes a CommonJS marker into the compiled backend output.
//
// The backend is compiled by `tsc -p tsconfig.backend.json` to CommonJS
// (`module: "CommonJS"`), but the repository root package.json declares
// `"type": "module"` for the Vite frontends. Without an override, Node walks up
// from each compiled file, finds the root package.json, treats every `.js` as
// ESM, and dies on the first `Object.defineProperty(exports, …)` with
// "ReferenceError: exports is not defined in ES module scope".
//
// A package.json at the output root scopes the CommonJS declaration to the
// compiled tree only. Node resolves the *nearest* package.json, so this covers
// both dist-backend/apps/backend/** and dist-backend/packages/** without
// affecting the frontend build in dist/.
//
// Written by a Node script rather than a shell `echo` so it behaves identically
// on Windows cmd, PowerShell, and POSIX shells (cmd's `echo` would keep the
// literal quotes and emit invalid JSON).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '..', 'dist-backend');

mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'package.json'), JSON.stringify({ type: 'commonjs' }) + '\n');

console.log('Wrote CommonJS marker to dist-backend/package.json');
