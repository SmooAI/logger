---
"@smooai/logger": patch
---

**Fix Rust clippy `useless_conversion` lint (Rust 1.95)**

Rust 1.95's clippy flags `args.extend(sub.into_iter())` as useless — `.extend()` already accepts `IntoIterator`. Remove the `.into_iter()` call so the Release workflow's lint step passes on the pinned-stable toolchain.
