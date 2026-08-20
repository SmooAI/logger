---
"@smooai/logger": minor
---

Add per-line caller location to the Rust and .NET ports, closing the last two gaps in that row.

Every entry from all five ports now says where it was emitted. Rust and .NET join Go's
single-frame shape:

```jsonc
{ "caller": { "file": "UserService.cs", "line": 42, "function": "CreateUser" } }
```

- **.NET** uses `[CallerFilePath]` / `[CallerLineNumber]` / `[CallerMemberName]`, which the
  compiler fills in at each call site — no `StackTrace` walk, so it costs nothing at runtime.
  The three parameters are threaded down to `Emit` so the location is the *caller's* line and
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
