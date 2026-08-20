---
"@smooai/logger": minor
---

Retire the deprecated egui log viewer and remove its install-time binary download.

`@smooai/logger`'s `postinstall` ran `bundle-log-viewer`, which downloaded
`https://github.com/SmooAI/logger/releases/latest/download/smooai-log-viewer-<platform>-<arch>`
and `chmod 0755`'d it on **every** `npm i @smooai/logger` — an unpinned, unverified remote
binary fetch (`latest`, not the installed version, with no checksum or signature), silently
falling back to `cargo build` when the download failed. The Python distribution did the same
thing from `poe build` / `poe publish`.

The binary it fetched was the egui log viewer, which `log-viewer/DEPRECATED.md` declared gone as
of `studio-v0.1.0` — superseded by SmooAI Observability Studio in
[SmooAI/observability](https://github.com/SmooAI/observability) (`desktop/`).

Removed:

- the `postinstall` hook and both `bundle-log-viewer` scripts (Node + Python)
- the `smooai-log-viewer` bin (npm) and console script (PyPI) and their wrappers
- the `log-viewer/` crate source and the `build-log-viewer.yml` release workflow
- 97 MB of tracked build artifacts (`python/log-viewer/{linux-x64,darwin-arm64}` binaries and a
  stale `smooai-logger-3.1.2.tgz`), now gitignored
- an unreferenced `log-viewer/README.md` entry in `files`, and the unused `@oclif/core` devDep

`log-viewer/DEPRECATED.md` stays as the tombstone pointing at the replacement. The logging API
itself is unchanged in every language.
