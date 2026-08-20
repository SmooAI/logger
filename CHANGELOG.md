# @smooai/logger

## 4.5.2

### Patch Changes

- ad58fce: Sync non-npm manifest versions during the version bump instead of after publish, and guard it.

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

## 4.5.1

### Patch Changes

- cb917c2: Make the parity corpus real: all five ports now replay the same committed file, and fix a Python correlation-id drift it caught.

  `parity-corpus.json` called itself "the contract" for "five hand-written ports", but only
  TypeScript and Python loaded it, and it held six level-code rows — nothing about the wire shape
  a structured logger actually has to agree on. A corpus nobody loads is worse than none, because
  it reads as a guarantee.

  The corpus now covers level mapping, canonical wire field names, message shape (a bare string
  must not leak into `context`), correlation-id propagation, and the default redaction key list —
  and **all five** ports load it: `src/parity-corpus.spec.ts`, `python/tests/test_parity_corpus.py`,
  `rust/logger/tests/parity_corpus.rs`, `go/parity_corpus_test.go`, and
  `dotnet/tests/SmooAI.Logger.Tests/ParityCorpusTests.cs`. Editing one corpus value turns all five
  suites red — verified by hand-breaking the redaction placeholder.

  **Python behavior fix, found by the new corpus:** setting `Logger.correlation_id` updated only
  `correlationId`, while TypeScript, Go, Rust and .NET all also overwrite `requestId` and `traceId`
  with the same value. A Python service that adopted an inbound correlation id therefore kept
  emitting a locally-generated `requestId`/`traceId` and fell out of the correlated view. Python
  now mirrors all three, matching the other four ports.

  The 15-entry default redaction key list (SMOODEV-942) was hand-copied into five languages; the
  corpus is now its single source and each port asserts its own list equals it, in order.

## 4.5.0

### Minor Changes

- bba1d02: Add per-line caller location to the Rust and .NET ports, closing the last two gaps in that row.

  Every entry from all five ports now says where it was emitted. Rust and .NET join Go's
  single-frame shape:

  ```jsonc
  {
    "caller": { "file": "UserService.cs", "line": 42, "function": "CreateUser" }
  }
  ```

  - **.NET** uses `[CallerFilePath]` / `[CallerLineNumber]` / `[CallerMemberName]`, which the
    compiler fills in at each call site — no `StackTrace` walk, so it costs nothing at runtime.
    The three parameters are threaded down to `Emit` so the location is the _caller's_ line and
    not the one-line forwarder inside `SmooLogger`.
  - **Rust** uses `#[track_caller]` on the level methods, `do_log`, and `build_log_object`, so
    `Location::caller()` resolves to your `logger.info(...)` line rather than a frame inside the
    crate. `function` is absent: `std::panic::Location` carries no symbol name, and resolving one
    would mean capturing a backtrace on every line.

  Both emit the file **basename** only — `[CallerFilePath]` and `Location::file()` expand to the
  absolute path on the build machine, which is noise and a mild leak.

  `ContextKey.Caller` is added to the .NET key set. Rust uses a module-level `CALLER_KEY` constant
  rather than a new `ContextKey` variant, since adding one to that public enum would break
  downstream exhaustive matches.

## 4.4.1

### Patch Changes

- 4be0846: Fix the Go module path so the Go port is installable again.

  `go/go.mod` declared `module github.com/SmooAI/logger/go/v3`, but every Go tag this repo has
  ever pushed is `go/v4.x` (`go/v4.1.3` … `go/v4.3.0`) — no `go/v3.*` tag has ever existed. Go
  resolves a `go/vN.x` tag only for a module path ending in `/vN`, so
  `go get github.com/SmooAI/logger/go/v3@v4.3.0` resolved nothing and the only thing that worked
  was a `main` pseudo-version. The Go port has been un-`go get`-able at a real version since v4.0.0.

  The module path is now `github.com/SmooAI/logger/go/v4`, matching the tags. A new
  `check:go-module` guard asserts the `/vN` suffix equals `package.json`'s major and **fails** on
  mismatch; it runs in PR checks and again inside the release tagging step, after changesets has
  bumped the version — the only point where the version that becomes the tag can be compared to
  the module path.

## 4.4.0

### Minor Changes

- 154ecd1: Retire the deprecated egui log viewer and remove its install-time binary download.

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

## 4.3.0

### Minor Changes

- 9c4fc8e: Correlate logs with OpenTelemetry traces. When a span is active, log records
  now carry the span's real W3C `traceId` + `spanId` instead of a fabricated
  uuid (falling back to the prior uuid correlation id only when no span is
  active). Each log line is also bridged into the standard
  `@opentelemetry/api-logs` facade, so it becomes an OTLP log record — correlated
  to the active span — whenever an observability LoggerProvider is registered
  (e.g. `@smooai/observability`'s logs signal). With no provider registered the
  bridge is a no-op and stdout output is unchanged. Depends only on the
  `@opentelemetry/api` + `@opentelemetry/api-logs` facades (no SDK, no circular
  dep on `@smooai/observability`).

### Patch Changes

- 2d4accf: Rust: log lines now carry the active OTel span's real W3C `traceId`/`spanId`
  (guarded on `span_context.is_valid()`), falling back to the correlation uuid,
  and are teed into `tracing` so a single subscriber sees both.

  `ContextKey` is now `#[non_exhaustive]`. It gains a variant whenever the family
  learns a new correlation field — `SpanId` is this release's — and without that
  attribute each addition is a source-breaking change for any downstream crate
  matching on it exhaustively.

## 4.2.1

### Patch Changes

- 5b801d7: .NET: log records now carry the active OTel span's real W3C `traceId`/`spanId`
  via `Activity.Current`, falling back to the correlation uuid when no valid
  activity is in scope.

  The version bump for the .NET package is driven from `package.json` by
  `scripts/sync-versions.mjs`, so this file exists to make sure the release
  CHANGELOG actually mentions the change — without it the NuGet package still
  republishes (any changeset in the release triggers every language), just with no
  record of what changed.

## 4.2.0

### Minor Changes

- ddf9461: Fix Python log-level wire parity with the TS/Go/Rust/.NET ports, and add a golden-vector parity corpus.

  **BREAKING for Python consumers that read the `level` field.** The Python port
  was the sole outlier across the five implementations: it emitted a lowercase
  string in `level` (`"info"`) and never emitted `LogLevel` at all. Every other
  port emits both fields. Python now matches:

  | field      | value                                     |
  | ---------- | ----------------------------------------- |
  | `level`    | pino-compatible **numeric** (info = 30)   |
  | `LogLevel` | canonical lowercase **string** (`"info"`) |

  Migration for Python consumers: anything asserting `record["level"] == "info"`
  should read `record["LogLevel"] == "info"` instead. The numeric codes were
  already defined in `level_to_code()` (trace=10 … fatal=60) and are unchanged;
  they were simply never written to the record.

  Also adds `parity-corpus.json` — a committed golden-vector corpus pinning the
  exact `level`/`LogLevel` pair every port must emit for all six levels, asserted
  by the TypeScript (`src/parity-corpus.spec.ts`) and Python
  (`python/tests/test_parity_corpus.py`) suites so drift fails the build.
  Follows the ADR-089 pattern used by `@smooai/audit`.

## 4.1.11

### Patch Changes

- 71c47e7: SMOODEV-966: Add `RotatingFileOutput` to the .NET port — size-based rollover, gzip-compressed archives, configurable retention (`MaxArchivedFiles`), and a configurable filename pattern. Wired into `SmooLogger` via `SmooLoggerOptions.Rotation`, mirroring the TS `RotationOptions` and Rust `rotation.rs` surfaces.

## 4.1.10

### Patch Changes

- 627bda0: Migrate build tooling from tsup to tsdown — faster, oxc-based, drop-in replacement. The `esbuild-plugin-alias` shim used to swap `rotating-file-stream` for a no-op stub in the browser build is replaced with `@rollup/plugin-alias` (rolldown-compatible). `src/decycle.cjs` (a side-effect CJS file that patches global `JSON`) is marked external so rolldown leaves it alone. Output extensions shift from `.js`/`.mjs`/`.d.ts` to `.cjs`/`.mjs`/`.d.cts`/`.d.mts` (tsdown defaults); the `exports` map + the CLI bin path are updated to match. No public API change.

## 4.1.9

### Patch Changes

- 60745c7: SMOODEV-966: Add `RotatingFileOutput` to the .NET port — size-based rollover, gzip-compressed archives, configurable retention (`MaxArchivedFiles`), and a configurable filename pattern. Wired into `SmooLogger` via `SmooLoggerOptions.Rotation`, mirroring the TS `RotationOptions` and Rust `rotation.rs` surfaces.

## 4.1.8

### Patch Changes

- 393b229: SMOODEV-942 follow-up: Fix Rust test races. The redaction + AWS context PRs (SMOODEV-942 / SMOODEV-943) added new tests in `logger.rs` + `aws.rs` that each had their own per-module `TEST_LOCK` / `ENV_LOCK`. cargo runs tests across modules in parallel, so the three module test groups raced on the global `CONTEXT` → `set_namespace` got wiped between writes and reads, and panicking tests poisoned the local lock and cascaded.

  Hoists a single `pub(crate) static TEST_GLOBAL_LOCK` in `lib.rs` (`#[cfg(test)]`) and switches every test that touches the global context — in `context.rs`, `logger.rs`, `aws.rs` — to acquire that one lock with `unwrap_or_else(|e| e.into_inner())` so a panic in one test no longer blocks the others. All 15 lib tests now pass under default parallel execution.

## 4.1.7

### Patch Changes

- 9c68fb2: SMOODEV-944: .NET port — implement `AwsServerLogger` with Lambda / SQS / API Gateway / ECS context helpers. New `SmooAI.Logger.AwsServerLogger` (extends `SmooLogger`) adds `AddLambdaContext(ILambdaContext)`, `AddLambdaEnvironmentContext()`, `AddSqsRecordContext(SQSEvent.SQSMessage)`, `AddApiGatewayContext(APIGatewayProxyRequest)`, and `AddECSContext()`. Mirrors the TS `AwsServerLogger`, Python `AwsServerLogger`, and Go `LambdaLogger` surfaces. NuGet deps added to `SmooAI.Logger`: `Amazon.Lambda.Core`, `Amazon.Lambda.SQSEvents`, `Amazon.Lambda.APIGatewayEvents` — small, version-stable interface packages every .NET Lambda project pulls in anyway. File rotation parity (TS `RotationOptions`) is intentionally deferred to a follow-up; the AWS context surface is the bigger gap.

## 4.1.6

### Patch Changes

- d22a7ce: SMOODEV-942: Add sensitive-field redaction across all 5 ports (TS, Python, Rust, Go, .NET). Logger now redacts a default set of auth-bearing HTTP headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `x-amz-security-token`, `proxy-authorization`) and credential-shaped field names (`password`, `passwd`, `secret`, `apiKey`, `api_key`, `token`, `access_token`, `refresh_token`, `client_secret`) before logs are emitted — replacing values with `"[REDACTED]"`. Matching is case-insensitive. Each port exposes `addRedactKeys()` / `AddRedactKeys()` / `add_redact_keys()` to extend the list, plus a constructor option to override the defaults entirely (pass an empty list to disable). Previously every port logged HTTP request headers and request bodies as-is, leaking Bearer tokens and cookies into CloudWatch / log shipping pipelines.
- e5cf073: SMOODEV-943: Rust port — implement AWS Lambda/SQS/API Gateway/ECS context helpers. Adds a new `aws` module with an `AwsContextLogger` trait that mirrors the Go `LambdaLogger` and Python `AwsServerLogger` surfaces — `add_lambda_context`, `add_lambda_environment_context`, `add_sqs_record_context`, `add_api_gateway_context`, `add_ecs_context`. Lambda/SQS/API Gateway methods are gated behind an opt-in `aws-lambda` cargo feature (which pulls in `lambda_runtime` and `aws_lambda_events`) so consumers that don't need the AWS bindings aren't forced to compile them. ECS context (`add_ecs_context`, `ecs_environment_context`) is env-var-only and always available. Previously `rust/logger/src/lib.rs` only exposed the base `Logger` — the README marketed Lambda + SQS + API Gateway support but the implementation was missing.

## 4.1.5

### Patch Changes

- 5de1e66: SMOODEV-945: Go port — add `LambdaLogger.AddECSContext()` for Fargate/ECS parity with Python. Reads the standard ECS-on-Fargate / Amazon-ECS-Agent env vars (`ECS_CONTAINER_METADATA_URI_V4`, `AWS_EXECUTION_ENV`, `AWS_REGION`, etc.) and attaches them under an `ecs` key in the logger context. Previously the Go port had Lambda / SQS / API Gateway / LambdaEnvironment context helpers but no ECS counterpart.

## 4.1.4

### Patch Changes

- d8f0487: Fix `ReferenceError: Cannot access '__filename' before initialization` (TDZ) when `AwsServerLogger` is loaded under tsx CJS interop. The old code destructured `import.meta.url` into locals named `__dirname` / `__filename` — when bundlers compile this to CJS they rewrite `import.meta.url` to a shim that reads the module-scope `__filename`, and a same-named `const` on the LHS creates a TDZ for that reference. Use a differently-named holder (`esmPaths`) so the compiled CJS doesn't self-reference a not-yet-initialized binding. This bit any tsx-run script that transitively imported `@smooai/fetch` → `@smooai/logger` (SMOODEV-908 inspect-runs, SMOODEV-918 ghl-import).

## 4.1.3

### Patch Changes

- 3aeac72: SMOODEV-666: Multi-target the SmooAI.Logger NuGet package to `net8.0;net9.0;net10.0` so consumers on every current .NET LTS + STS release get a native framework match in the `lib/` folder. Microsoft.Extensions.Logging.Abstractions 8.0.2 resolves cleanly on all three — no per-TFM conditionals needed.
- 1fffdde: SMOODEV-667: Drop invalid `logging` crates.io category slug that was aborting the release pipeline before it could reach the NuGet publish step. crates.io only accepts categories from its fixed list (`development-tools::debugging` stays). This unblocks `SmooAI.Logger` NuGet publishes for the first time since the .NET port landed — NuGet was stuck on the 0.1.0 placeholder while npm had advanced to 4.1.2.

## 4.1.2

### Patch Changes

- 13a5834: SMOODEV-664: Rewrite the .NET (NuGet) README to value-frame the package — lead with correlation-IDs-across-services, typed user/request/response context, and caller-location-on-every-line. Drop the implementation-detail lead, add a quick-start showing a real request trace, and link cross-language siblings. Republishes SmooAI.Logger with the new README.

## 4.1.1

### Patch Changes

- 1db237b: SMOODEV-662: Sync SmooAI.Logger NuGet version to package.json + polish NuGet README + wire NuGet publish into release workflow

## 4.1.0

### Minor Changes

- 94daf9b: **Add top-level `browser` export condition + bare `./browser` entry**

  `@smooai/logger` already shipped a browser-safe build under `./browser` (exposing `BrowserLogger`, a browser-native `Logger`, and a full `index`), but the top-level `.` entry had no `browser` condition. Browser bundlers therefore resolved `import { Logger } from '@smooai/logger'` to the Node entry, pulling `rotating-file-stream`, `node:fs`, and related Node-only dependencies into the bundle.

  Adding the `browser` condition on `.` means consumers can now do:

  ```ts
  import { Logger } from "@smooai/logger";
  ```

  …and the bundler automatically picks the browser-safe dist when building for a browser target. No aliasing or explicit `/browser` subpath import required.

  Also added a bare `./browser` entry (in addition to the existing `./browser/*` subpath pattern) so `import X from '@smooai/logger/browser'` resolves to `dist/browser/index.*` without needing the explicit `/index` suffix.

### Patch Changes

- d2af83b: **Drop deprecated `baseUrl` from tsconfig**

  The previous attempt used `ignoreDeprecations: "5.0"` which works locally but CI expects `"6.0"` (depends on exact patch version of TypeScript). Nothing in the codebase relies on baseUrl (no `paths`, no imports start with `./src/...` from a module root), so the cleaner fix is to just remove it. This unblocks the Release workflow which has been red since TypeScript began flagging the deprecation.

- c192d42: **Fix Rust clippy `useless_conversion` lint (Rust 1.95)**

  Rust 1.95's clippy flags `args.extend(sub.into_iter())` as useless — `.extend()` already accepts `IntoIterator`. Remove the `.into_iter()` call so the Release workflow's lint step passes on the pinned-stable toolchain.

- cc30c41: **Silence TS5101 deprecation warning for `baseUrl` in tsconfig**

  TypeScript 5.0+ flags the `baseUrl` compiler option as deprecated (to be removed in TS 7.0). The repo's `tsconfig.json` still uses `baseUrl: "./"`; recent Release workflow runs failed during typecheck with:

  ```
  tsconfig.json: error TS5101: Option 'baseUrl' is deprecated
  ```

  Adds `"ignoreDeprecations": "5.0"` to quiet the warning until we do a wider tsconfig modernisation. No behavioural change.

## 4.0.3

### Patch Changes

- dcb8e7c: Add Go language-specific README with idiomatic usage examples, cross-language install table, and full API reference including LambdaLogger, context management, and correlation tracking.

## 4.0.2

### Patch Changes

- ba9bd4c: Publish v4.0.1 fixes to PyPI and crates.io (previous release publish was interrupted)

## 4.0.1

### Patch Changes

- 7fe43eb: Upgrade duckdb from 0.9.2 to 1.4 to fix macOS build, replace deprecated macos-13 CI runner with macos-15-intel

## 4.0.0

### Major Changes

- 05cb4d7: Add context config filtering, Lambda adapter, and caller tracking to Go logger
  - Port ContextConfig system from Rust (AllowAll/Deny/OnlyKeys/Nested recursive filtering)
  - Add PresetConfigMinimal and PresetConfigFull presets
  - Add CallerInfo with runtime.Caller for file/line/function tracking
  - Add LambdaLogger with AWS Lambda context, SQS, and API Gateway integration
  - Add error cause chain walking via errors.Unwrap in ErrorDetail

## 3.3.0

### Minor Changes

- 72f29c0: Add context config filtering, Lambda adapter, and caller tracking to Go logger
  - Port ContextConfig system from Rust (AllowAll/Deny/OnlyKeys/Nested recursive filtering)
  - Add PresetConfigMinimal and PresetConfigFull presets
  - Add CallerInfo with runtime.Caller for file/line/function tracking
  - Add LambdaLogger with AWS Lambda context, SQS, and API Gateway integration
  - Add error cause chain walking via errors.Unwrap in ErrorDetail

## 3.2.3

### Patch Changes

- 3758f86: Update README Built With section to include Python, Rust, Go implementations and the Log Viewer desktop application.

## 3.2.2

### Patch Changes

- 2aae163: Fixed publishing versions and added scripts for rust/logger.

## 3.2.1

### Patch Changes

- 4405339: Fixed publishing versions and added scripts for rust/logger.

## 3.2.0

### Minor Changes

- 4f89541: ## Multi-Language Logger Ecosystem

  This release transforms `@smooai/logger` into a comprehensive multi-language logging ecosystem:

  ### 🐍 Python Package (`smooai-logger`)

  - Available on PyPI as `smooai-logger`
  - Full Python implementation with identical API to TypeScript version
  - Synchronized versioning with npm package

  ### 🦀 Rust Crate (`smooai-logger`)

  - Available on crates.io as `smooai-logger`
  - Native Rust logging implementation
  - Synchronized versioning with npm package

  ### 📊 Log Viewer CLI (`smooai-log-viewer`)

  - Interactive GUI application for viewing `.smooai-logs` files
  - Available as CLI command when installing npm package: `smooai-log-viewer`
  - Cross-platform native binaries bundled with package
  - Features filtering, searching, JSON expansion, and context viewing

  ### 🔄 Automated Publishing Pipeline

  - Single changesets release now publishes to npm, PyPI, and crates.io
  - Automatic version synchronization across all packages
  - Enhanced CI/CD workflow for multi-language support

  This creates a unified logging solution across JavaScript/TypeScript, Python, and Rust ecosystems, all with consistent APIs and synchronized versions.

## 3.1.2

### Patch Changes

- ab25cc4: Fixed error handling in context objects so error values are captured and added to error / errorDetails.

## 3.1.1

### Patch Changes

- c421af4: Update @smooai dependencies.

## 3.1.0

### Minor Changes

- 51296f1: Upgrade from zod 3 to zod 4.

## 3.0.8

### Patch Changes

- 37e2c86: Fix response body handling.

## 3.0.7

### Patch Changes

- 9cadf35: Fix issue with cloneAndAddResponseContext.

## 3.0.6

### Patch Changes

- 3188183: Add proper response logging.

## 3.0.5

### Patch Changes

- d577148: Remove some automatically added log context in addLambdaContext.

## 3.0.4

### Patch Changes

- 2c37200: Improved namespace handling.

## 3.0.3

### Patch Changes

- 2310c54: Improved README.md to tell a better story about the tool.

## 3.0.2

### Patch Changes

- a8be379: Update readme.
- a8be379: Updated dependencies.

## 3.0.1

### Patch Changes

- ae928d2: Update readme.

## 3.0.0

### Major Changes

- ab4347d: Changed how browser was exported so it's in @smooai/logger/browser.

  Prior BrowserLogger was at @smooai/logger/BrowserLogger.

  This seemed to lead to some issues when building downstream where node based utilities would get picked up from this package when building in browser land.

## 2.3.0

### Minor Changes

- ec16cbd: Switched to using .ansi as log extension for ansi colors iliazeus.vscode-ansi.

### Patch Changes

- ec16cbd: Fix build issue.
- ec16cbd: Fix minor issue with log output.

## 2.2.0

### Minor Changes

- 4b9d54a: Switched to using .ansi as log extension for ansi colors iliazeus.vscode-ansi.

### Patch Changes

- 4b9d54a: Fix minor issue with log output.

## 2.1.0

### Minor Changes

- 598a83b: Switched to using .ansi as log extension for ansi colors iliazeus.vscode-ansi.

## 2.0.1

### Patch Changes

- a060fc7: Fix readme issue.

## 2.0.0

### Major Changes

- c9d9ad3: Breaking Change: Changed AwsLambdaLogger to AwsServerLogger.

  AwsServerLogger is growing to have functionality beyond just Lambda (to soon include ECS) so it makes sense to change it now to AwsServerLogger.

  Fixed ANSI colors in all places.

  Added file log output and log rotation enabled by default when running on server locally.

## 1.2.4

### Patch Changes

- 1710c6f: Fix false local environment.

## 1.2.3

### Patch Changes

- 2681743: Fix treeshaking.

## 1.2.2

### Patch Changes

- 4b028b8: Fix BrowserLogger build.
- 4b028b8: Fixed build issue with .d.ts files.

## 1.2.1

### Patch Changes

- f2c5c5e: Fixed build issue with .d.ts files.

## 1.2.0

### Minor Changes

- 46b8c91: Fix the BrowserLogger build and replace chalk with picocolors to fix issue with using BrowserLogger.

## 1.1.0

### Minor Changes

- deee649: Fix package exports.

## 1.0.24

### Patch Changes

- 880cf11: Fix local logging.

## 1.0.23

### Patch Changes

- 0e2da13: Update readme.

## 1.0.22

### Patch Changes

- 7101205: Update prettier plugins.

## 1.0.21

### Patch Changes

- 7caf010: Updated all vite dependencies.

## 1.0.20

### Patch Changes

- be42715: Added browser logs for error and or message after context object.

## 1.0.19

### Patch Changes

- 5d85b5c: Update @smooai/utils.

## 1.0.18

### Patch Changes

- aed2567: Upgrade node types to v22.
- 3d6ab6b: Change from lodash to lodash.merge.

## 1.0.17

### Patch Changes

- 20bdb04: Upgraded to Node 22.

## 1.0.16

### Patch Changes

- 0fdb32d: Fix exports.

## 1.0.15

### Patch Changes

- ac6a1fd: Fix publish for Github releases.

## 1.0.14

### Patch Changes

- 6bf4674: Update author / bugs / homepage.

## 1.0.13

### Patch Changes

- 1c05cca: Use pnpm create-entry-points from @smooai/utils.

## 1.0.12

### Patch Changes

- 3086ea5: Fix package exports.
- 3086ea5: Add default to package exports.

## 1.0.11

### Patch Changes

- dfc62be: Fix package exports.

## 1.0.10

### Patch Changes

- fb07588: Fix local env.

## 1.0.9

### Patch Changes

- 017ac94: Add build to git hooks.

## 1.0.8

### Patch Changes

- c6c993d: Make sure typings are included.
- c6c993d: Add license to package.

## 1.0.7

### Patch Changes

- f645b67: Fix release CI.

## 1.0.6

### Patch Changes

- 167aff5: Add checks to CI.

## 1.0.5

### Patch Changes

- f0d7f95: Add badges.

## 1.0.4

### Patch Changes

- b6f7cd1: Made improvements to the readme.

## 1.0.3

### Patch Changes

- e0a3076: Remove cross-fetch dependency.

## 1.0.2

### Patch Changes

- 9b46780: Added ci:publish.

## 1.0.1

### Patch Changes

- b10956f: Fix issue with @vercel/style-guid.
- e0d719f: Moved into its own package.
