---
"@smooai/logger": patch
---

Migrate build tooling from tsup to tsdown — faster, oxc-based, drop-in replacement. The `esbuild-plugin-alias` shim used to swap `rotating-file-stream` for a no-op stub in the browser build is replaced with `@rollup/plugin-alias` (rolldown-compatible). `src/decycle.cjs` (a side-effect CJS file that patches global `JSON`) is marked external so rolldown leaves it alone. Output extensions shift from `.js`/`.mjs`/`.d.ts` to `.cjs`/`.mjs`/`.d.cts`/`.d.mts` (tsdown defaults); the `exports` map + the CLI bin path are updated to match. No public API change.
