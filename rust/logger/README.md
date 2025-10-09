# smooai-logger (Rust)

A Rust port of the SmooAI contextual logger that mirrors the feature set of `@smooai/logger` and the Python parity package. The crate exposes a JSON-first logging API with correlation tracking, HTTP helpers, optional pretty-printing, and rotating-file output.

## Installation

Add the Git dependency until the crate is published to crates.io:

```toml
[dependencies]
smooai-logger = { git = "https://github.com/SmooAI/logger", package = "smooai-logger" }
```

## Usage

```rust
use smooai_logger::{log_args, log_error, HttpRequest, Level, Logger};

fn main() -> anyhow::Result<()> {
    let logger = Logger::default();

    logger.add_http_request(HttpRequest {
        method: Some("get".into()),
        path: Some("/ping".into()),
        ..Default::default()
    });

    // Combine strings, structured context, and errors.
    logger.info(log_args![
        "Request accepted",
        serde_json::json!({"latencyMs": 12}),
    ])?;

    let err = anyhow::anyhow!("downstream failed");
    logger.error(log_args![log_error(err)])?;

    Ok(())
}
```

### Context helpers

- `Logger::add_user_context`, `add_http_request`, and `add_http_response` populate standard context keys.
- `Logger::add_telemetry_fields` merges request/trace identifiers, duration, namespace, and service metadata.
- `Logger::set_namespace` overrides the namespace derived from HTTP helpers.
- `Logger::reset_context` regenerates correlation, request, and trace identifiers.

### Pretty printing and rotation

Pretty output is automatically enabled in local or build environments (`SST_DEV`, `IS_LOCAL`, or `GITHUB_ACTIONS`). File logging can be enabled explicitly via `LoggerOptions { log_to_file: Some(true), .. }` and honours `RotationOptions` (`path`, `filename_prefix`, `extension`, `size`, `interval`, `max_files`, `max_total_size`).

## Running tests

```bash
cargo test
```

## License

MIT © SmooAI
