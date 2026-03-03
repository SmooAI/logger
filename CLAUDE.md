# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Use Context7 MCP server for up-to-date library documentation.**

## Project Overview

`@smooai/logger` is a multi-language contextual structured logging system for AWS and browser environments. It automatically captures execution context (code location, request journey, AWS metadata, HTTP details, browser info). The repo also includes a desktop Log Viewer app built with Rust/egui/DuckDB.

### Languages & Toolchains

- **TypeScript** — pnpm, tsup
- **Python** — uv, poethepoet
- **Rust** — cargo (logger crate + log-viewer desktop app)
- **Go** — go mod

---

## 1. Build, Test, and Development Commands

### TypeScript

```bash
pnpm install              # Install dependencies
pnpm build                # Build TypeScript package
pnpm test                 # Run Vitest tests
pnpm typecheck            # TypeScript type checking
pnpm lint                 # ESLint
pnpm format               # Auto-format code
pnpm check-all            # Full CI parity (typecheck, lint, test, build)
pnpm pre-commit-check     # Quick pre-commit validation
```

### Python

```bash
cd python && uv sync --group dev   # Setup Python environment
poe lint                           # Ruff linting
poe format                         # Ruff formatting
poe typecheck                      # BasedPyright type checking
poe test                           # pytest
poe build                          # Build Python package
```

Or from repo root:

```bash
pnpm python:build
pnpm python:test
pnpm python:lint
pnpm python:format
pnpm python:typecheck
```

### Rust

```bash
cd rust/logger && cargo test       # Run Rust tests
cd rust/logger && cargo clippy     # Lint
cd rust/logger && cargo fmt        # Format
```

Or from repo root:

```bash
pnpm rust:build
pnpm rust:test
pnpm rust:lint
pnpm rust:fmt
```

### Go

```bash
cd go && go test ./...             # Run Go tests
cd go && go vet ./...              # Lint
```

Or from repo root:

```bash
pnpm go:build
pnpm go:test
pnpm go:lint
```

### Log Viewer (Rust egui desktop app)

```bash
pnpm log-viewer               # Run the log viewer
pnpm log-viewer:bundle         # Bundle for distribution
pnpm log-viewer:test           # Run log viewer tests
pnpm log-viewer:lint           # Clippy linting
pnpm log-viewer:fmt            # Format log viewer code
pnpm log-viewer:typecheck      # Type checking
```

---

## 2. Git Workflow — Worktrees

### Working directory structure

All work happens from `~/dev/smooai/`. The main worktree is at `~/dev/smooai/logger/`. Feature worktrees live alongside it:

```
~/dev/smooai/
├── logger/                              # Main worktree (ALWAYS on main)
├── logger-SMOODEV-XX-short-desc/        # Feature worktree
└── ...
```

**IMPORTANT:** `~/dev/smooai/logger/` must ALWAYS stay on the `main` branch. **Never do feature work directly on main.** All feature work goes in worktrees.

### Branch naming

Always prefix with the Jira ticket number:

```
SMOODEV-XX-short-description
```

### Commit messages

Always prefix with the Jira ticket. Explain **why**, not just what:

```
SMOODEV-XX: Add structured context propagation for Lambda cold starts
```

### Creating a worktree

```bash
cd ~/dev/smooai/logger
git worktree add ../logger-SMOODEV-XX-short-desc -b SMOODEV-XX-short-desc main

cd ../logger-SMOODEV-XX-short-desc
pnpm install
cd python && uv sync && cd ..
```

### Merging to main

```bash
cd ~/dev/smooai/logger
git checkout main && git pull --rebase
git merge SMOODEV-XX-short-desc --no-ff
git push
```

### Cleanup after merge

```bash
git worktree remove ~/dev/smooai/logger-SMOODEV-XX-short-desc
git branch -d SMOODEV-XX-short-desc
```

---

## 3. Coding Style

- TypeScript: ESLint + Prettier, 4-space indentation, trailing commas
- Python: Ruff linting and formatting, BasedPyright for type checking
- Rust: `cargo fmt` + `cargo clippy`
- Go: `go fmt` + `go vet`
- Run `pnpm format` before committing

---

## 4. Testing Guidelines

- **TypeScript**: Vitest, colocated as `*.test.ts`
- **Python**: pytest via `poe test`
- **Rust**: `cargo test`
- **Go**: `go test`
- Every batch of work MUST include unit tests
- All applicable tests must pass before landing code

---

## 5. Changesets & Versioning

Always add changesets when `@smooai/logger` changes — including for all languages:

```bash
pnpm changeset
```

---

## 6. CI / GitHub Actions

CI runs on every PR: typecheck, lint, format check, test, build (all languages).

```bash
gh run list                          # List recent workflow runs
gh run view <run-id> --log-failed    # View failed step logs
```

CI must be green before merging.

---

## 7. Pre-Push Checklist

Before merging and pushing, verify:

1. `pnpm check-all` passes
2. `pnpm python:test && pnpm python:lint && pnpm python:typecheck` pass
3. `pnpm rust:test && pnpm rust:lint` pass
4. `pnpm go:test && pnpm go:lint` pass
5. Changeset added if needed
6. All changes committed and pushed
