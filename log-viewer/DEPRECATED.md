# DEPRECATED — moved to `@smooai/observability`

> **As of 2026-05-22 (SMOODEV-1175), this crate has been migrated.**
> **As of `studio-v0.1.0` (SMOODEV-1255), the egui implementation is gone.** The replacement is a Dioxus app, distributed via GitHub Releases.

The Rust desktop log viewer that lived here has moved to the SmooAI Observability monorepo and been rebuilt from scratch as **SmooAI Observability Studio** — a Dioxus 0.6 native client for SmooAI logs, errors, metrics (traces + gen-AI coming), reached over M2M `client_credentials` against `api.smoo.ai`.

## Get the app

**Download a release** (signed builds coming in a follow-up):

- macOS (arm64): [`SmooAI-Observability-Studio.dmg`](https://github.com/SmooAI/observability/releases/tag/studio-v0.1.0)
- Linux x86_64: [`SmooAI-Observability-Studio-x86_64.AppImage`](https://github.com/SmooAI/observability/releases/tag/studio-v0.1.0)
- Windows x86_64: [`SmooAI-Observability-Studio-x86_64.zip`](https://github.com/SmooAI/observability/releases/tag/studio-v0.1.0)

Full release list: <https://github.com/SmooAI/observability/releases>.

**Or build from source**:

```bash
git clone https://github.com/SmooAI/observability.git
cd observability/desktop
cargo run --release -p observability-studio-app
```

The new layout:

- **Repo**: [SmooAI/observability](https://github.com/SmooAI/observability)
- **Path**: `desktop/`
- **Workspace crates**: `observability-studio-app` (binary `observability-studio`), `observability-studio-client`, `observability-studio-theme`
- **Design system**: shared via [`@smooai/ui`](https://github.com/SmooAI/ui) (the `smooai-ui` crate)

## Why the move

The viewer is an observability **consumer**, not a logger feature. Its natural home is alongside the rest of `@smooai/observability` (which already hosts the Rust SDK, JS/TS browser/Node SDKs, Python/Go/.NET scaffolds). See [ADR-013](https://github.com/SmooAI/smooai/blob/main/docs/Decisions/ADR-013-Native-Desktop-Observability-Viewer.md) (private smooai repo).

## Notes on the previous egui implementation

The original `smooai-log-viewer` egui crate was deleted in [observability `SMOODEV-1255-rm-egui`](https://github.com/SmooAI/observability/pull/) once the Dioxus port reached parity (logs / errors / metrics views — local-file ingestion was the only feature not ported, and that workflow is better served by running the AWS / CloudWatch source through the new Settings → Add Org flow against `api.smoo.ai`).

If you depended on the old egui binary specifically, pin to a [SmooAI/logger v4.x release](https://github.com/SmooAI/logger/releases) that predates this deprecation note — but expect no further updates on that line.
