//! Per-line caller location (`caller: { file, line }`).
//!
//! The value that matters is not "a caller field exists" but that it points at
//! the USER's call site rather than a frame inside this crate — which is exactly
//! what `#[track_caller]` on the level methods buys.

use smooai_logger::{Level, LogArgs, Logger, LoggerOptions};

fn test_logger() -> Logger {
    let logger = Logger::new(LoggerOptions {
        name: Some("CallerTest".into()),
        log_to_file: Some(false),
        ..Default::default()
    });
    logger.reset_context();
    logger
}

fn args(message: &str) -> LogArgs {
    let mut args = LogArgs::new();
    args.push(message.to_string());
    args
}

#[test]
fn caller_points_at_this_file_and_the_calling_line() {
    let logger = test_logger();

    // Keep these two statements adjacent: the assertion below pins the emitted
    // line number to the `build_log_object` call, so an edit between them fails.
    let expected_line = line!() + 1;
    let record = logger.build_log_object(Level::Info, &args("hello"));

    let caller = record["caller"].as_object().expect("every record carries `caller`");
    assert_eq!(
        caller["file"].as_str(),
        Some("caller_location.rs"),
        "file must be the basename, not the build-machine absolute path"
    );
    assert_eq!(caller["line"].as_u64(), Some(u64::from(expected_line)));
}

#[test]
fn caller_tracks_the_call_site_not_a_fixed_crate_frame() {
    let logger = test_logger();

    let first = logger.build_log_object(Level::Info, &args("one"));
    let second = logger.build_log_object(Level::Info, &args("two"));

    let line_of = |record: &serde_json::Value| record["caller"]["line"].as_u64().unwrap();
    assert_eq!(
        line_of(&second) - line_of(&first),
        1,
        "two adjacent calls must report adjacent lines; a constant here would mean \
         the location is being read from a frame inside the crate"
    );
}

/// A helper one frame deeper: without `#[track_caller]` on the level methods the
/// location would resolve inside `logger.rs` for every one of these.
fn log_from_helper(logger: &Logger) -> serde_json::Value {
    logger.build_log_object(Level::Warn, &args("from helper"))
}

#[test]
fn caller_resolves_through_a_user_helper() {
    let record = log_from_helper(&test_logger());
    let caller = record["caller"].as_object().unwrap();
    assert_eq!(caller["file"].as_str(), Some("caller_location.rs"));
    // The helper's own body, not the test that called it — `Location::caller()`
    // is the immediate caller, and `log_from_helper` is not `#[track_caller]`.
    assert!(caller["line"].as_u64().unwrap() > 0);
}
