//! SmooAI Logger for Rust.
//!
//! This crate mirrors the feature set of the TypeScript and Python loggers provided by
//! `@smooai/logger`, offering structured contextual logging, correlation tracking, and
//! optional file rotation with pretty-printed output.

pub mod aws;
pub mod context;
pub mod env;
pub mod error;
pub mod logger;
pub mod pretty;
pub mod rotation;

pub use crate::context::{default_redact_keys, ContextConfig, ContextKey, ContextValue, CONFIG_FULL, CONFIG_MINIMAL, REDACTED_VALUE};
pub use crate::error::{log_error, LoggedError};
pub use crate::logger::{Level, LogArgs, Logger, LoggerOptions};
pub use crate::rotation::RotationOptions;

pub use serde_json::json;

/// Crate-wide test serialization lock. All tests that touch the global
/// `CONTEXT` (via `reset_global_context`, `add_base_context`, namespace /
/// correlation setters, env-var writes consumed by AWS context helpers, etc.)
/// must acquire this same `Mutex<()>` before mutating state, so the three
/// test modules (`context`, `logger`, `aws`) don't race. `cargo test`
/// otherwise runs the modules in parallel even though tests inside one
/// module are serialized by their own lock — which is what blew up the
/// SMOODEV-942 / SMOODEV-943 release pipeline.
#[cfg(test)]
pub(crate) static TEST_GLOBAL_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
