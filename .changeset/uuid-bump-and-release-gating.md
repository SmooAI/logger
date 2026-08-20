---
"@smooai/logger": patch
---

Bump `uuid` to `^11.1.1`, gate each registry publish on that registry, and stop Go caching the parity corpus.

- **`uuid` 9.0.1 → 11.1.1.** The moderate advisory (missing buffer bounds check in v3/v5/v6 when
  `buf` is provided) is **not reachable** here — logger only ever calls `v4()` with no arguments —
  but every consumer of `@smooai/logger` was inheriting the advisory and having to carry its own
  `pnpm.overrides` pin. Fixed at the source instead. `@types/uuid` dropped; uuid 11 ships its own.
- **Publish steps no longer gate on `steps.changesets.outputs.published`.** That output is true only
  when the publish command shipped something _in that run_, so a run that died after npm left the
  other four behind — and the follow-up run, with no changesets left, reported `published=false`,
  skipped all four, and went **green having published nothing**. That is exactly how 4.5.1 and
  4.5.2 stranded crates.io, NuGet and the Go tag at 4.5.0. Each step now asks its own registry
  whether the version is already there, which also lets a re-run heal a partial release.
- **`go:test` gains `-count=1`.** Go currently refuses to cache `parity_corpus_test.go` because it
  reads `../parity-corpus.json` from outside the package dir — verified — but a parity guarantee
  should not rest on that.
