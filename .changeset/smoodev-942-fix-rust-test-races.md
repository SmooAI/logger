---
"@smooai/logger": patch
---

SMOODEV-942 follow-up: Fix Rust test races. The redaction + AWS context PRs (SMOODEV-942 / SMOODEV-943) added new tests in `logger.rs` + `aws.rs` that each had their own per-module `TEST_LOCK` / `ENV_LOCK`. cargo runs tests across modules in parallel, so the three module test groups raced on the global `CONTEXT` → `set_namespace` got wiped between writes and reads, and panicking tests poisoned the local lock and cascaded.

Hoists a single `pub(crate) static TEST_GLOBAL_LOCK` in `lib.rs` (`#[cfg(test)]`) and switches every test that touches the global context — in `context.rs`, `logger.rs`, `aws.rs` — to acquire that one lock with `unwrap_or_else(|e| e.into_inner())` so a panic in one test no longer blocks the others. All 15 lib tests now pass under default parallel execution.
