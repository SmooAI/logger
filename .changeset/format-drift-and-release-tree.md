---
"@smooai/logger": patch
---

Commit the repo's formatting and stop the release pipeline from dirtying its own working tree.

Dropping `cargo publish --allow-dirty` surfaced what the flag had been hiding: `release.yml`'s
own `Format` step ran `pnpm format`, which **rewrites** files and never commits them, so
`cargo publish` a few steps later saw a dirty tree. Every crate published from this repo silently
carried uncommitted reformatting.

`main` was format-drifted across seven files with nothing checking — PR checks ran `oxlint` but
never a formatter, and `pnpm format:check` did not exist.

- The formatting is committed; `pnpm format` is now a no-op on `main`.
- New `format:check` (oxfmt + ruff + `cargo fmt` + `gofmt`) runs in PR checks.
- `release.yml`'s `Format` becomes `Format check` — check, never rewrite.
- The changesets `version` lifecycle now ends with `oxfmt --write CHANGELOG.md package.json`,
  because `changeset version` emits both in a shape oxfmt disagrees with; without it the next
  release PR would land unformatted and break `cargo publish --locked` again.

This release also re-publishes to crates.io, NuGet, and the Go module tag, which stalled at
`4.5.0` while npm and PyPI went to `4.5.2`.
