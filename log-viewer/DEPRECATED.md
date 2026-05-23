# DEPRECATED — moved to `@smooai/observability`

> **As of 2026-05-22 (SMOODEV-1175), this crate has been migrated.**

The Rust desktop log viewer that lived here has moved to the SmooAI Observability monorepo and been promoted from a single-purpose log viewer into a full **SmooAI Observability Studio** — a native client for SmooAI logs, errors, metrics, distributed traces, and gen-AI/LLM telemetry, locally and remotely (via M2M `client_credentials` against `api.smoo.ai`).

## New home

- **Repo**: [SmooAI/observability](https://github.com/SmooAI/observability)
- **Path**: `rust/log-viewer/`
- **Crate**: `smooai-observability-viewer`
- **Binary**: `smooobs`

## Build from source

```bash
git clone https://github.com/SmooAI/observability.git
cd observability/rust
cargo run --release -p smooai-observability-viewer
```

## Why the move

The viewer is an observability **consumer**, not a logger feature. Its natural home is alongside the rest of `@smooai/observability` (which already hosts the Rust SDK, JS/TS browser/Node SDKs, Python/Go/.NET scaffolds). See [ADR-013](https://github.com/SmooAI/smooai/blob/main/docs/Decisions/ADR-013-Native-Desktop-Observability-Viewer.md) and the full plan at [docs/Engineering/Rust-Desktop-Observability-Viewer.md](https://github.com/SmooAI/smooai/blob/main/docs/Engineering/Rust-Desktop-Observability-Viewer.md) (private repo).

## What lives here now (transitional)

The original source remains in place so the existing release pipeline (`.github/workflows/build-log-viewer.yml`) continues to ship binaries during the transition. Once the new crate ships its own signed builds (phase 7 of SMOODEV-1175), the source and CI here will be removed.

**Do not add new features to this copy.** All work happens in `~/dev/smooai/observability/rust/log-viewer/`.
