//! SmooAI Logger for Rust.
//!
//! This crate mirrors the feature set of the TypeScript and Python loggers provided by
//! `@smooai/logger`, offering structured contextual logging, correlation tracking, and
//! optional file rotation with pretty-printed output.

pub mod context;
pub mod env;
pub mod error;
pub mod logger;
pub mod pretty;
pub mod rotation;

pub use crate::context::{ContextConfig, ContextKey, ContextValue, CONFIG_FULL, CONFIG_MINIMAL};
pub use crate::error::{log_error, LoggedError};
pub use crate::logger::{Level, LogArgs, Logger, LoggerOptions};
pub use crate::rotation::RotationOptions;

pub use serde_json::json;
