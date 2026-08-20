---
"@smooai/logger": patch
---

Sync non-npm manifest versions during the version bump instead of after publish, and guard it.

`ci:publish` ran `pnpm build && changeset publish && pnpm version:sync` — the sync happened
**after** the publish, mutating manifests in the CI workspace that were then thrown away. So every
git tag shipped stale version constants, and `cargo publish --allow-dirty` existed only to paper
over the dirt. With `4.4.0` published on npm, the repo was carrying `3.2.3` in
`python/pyproject.toml`, `python/uv.lock` and `go/version.go`, `3.1.2` in `rust/logger/Cargo.toml`
and its lock, and `4.1.0` in `dotnet/…/SmooAI.Logger.csproj` — five languages, four versions, none
of them the published one.

Every consumer of a non-npm port was reading a version constant from a different release.

- The sync moves into the changesets `version` lifecycle (`"version": "changeset version && node scripts/sync-versions.mjs"`, with `version: pnpm run version` on the action), so the bumped manifests are **committed** with the version bump.
- `cargo publish` drops `--allow-dirty` and gains `--locked`.
- `python/uv.lock` joins the synced set. It was missed before and is not cosmetic: `poe install-dev` runs `uv sync --locked`, which errors when the lock disagrees with `pyproject.toml`.
- `sync-versions.mjs` now also rewrites `go.mod`'s `/vN` suffix on a major bump.
- New `check:versions` guard **fails** (never warns) when any manifest disagrees, running in PR checks and again inside the release tagging step — after changesets has bumped the version, the only point where the version that becomes the tag can be checked.

`check-go-module` is folded into it: both read the same `scripts/versioned-files.mjs`, so the guard
cannot drift from the syncer — a hand-copied second list is the failure mode this whole change is about.
