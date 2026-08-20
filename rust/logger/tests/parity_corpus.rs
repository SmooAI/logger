//! Golden-vector parity corpus (ADR-089 pattern, as used by `@smooai/audit`).
//!
//! Asserts the Rust port satisfies the same contract every other port
//! (TypeScript / Python / Go / .NET) is held to, from the same committed file.
//! A failure here means either this port drifted or the shared contract moved —
//! fix the port, not the corpus.

use std::sync::Mutex;

use serde_json::{Map, Value};
use smooai_logger::{default_redact_keys, ContextKey, Level, LogArgs, Logger, LoggerOptions, REDACTED_VALUE};

/// The corpus checks mutate the process-global context, so they must not run
/// concurrently with each other. (`TEST_GLOBAL_LOCK` is crate-internal and this
/// is a separate test binary, so this file needs its own lock.)
static CORPUS_LOCK: Mutex<()> = Mutex::new(());

/// Bumped alongside the corpus's own `version` when its shape changes.
const CORPUS_VERSION: u64 = 2;

fn corpus() -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../parity-corpus.json");
    let raw = std::fs::read_to_string(path).expect("parity-corpus.json must be readable");
    let corpus: Value = serde_json::from_str(&raw).expect("parity-corpus.json must be valid JSON");
    assert_eq!(
        corpus["version"].as_u64(),
        Some(CORPUS_VERSION),
        "parity-corpus.json is a shape this loader does not understand"
    );
    corpus
}

fn field(corpus: &Value, concept: &str) -> String {
    corpus["fieldNames"][concept]
        .as_str()
        .unwrap_or_else(|| panic!("corpus has no fieldNames.{concept}"))
        .to_string()
}

fn level_from_name(name: &str) -> Level {
    match name {
        "trace" => Level::Trace,
        "debug" => Level::Debug,
        "info" => Level::Info,
        "warn" => Level::Warn,
        "error" => Level::Error,
        "fatal" => Level::Fatal,
        other => panic!("corpus names level {other:?}, which the Rust port does not expose"),
    }
}

fn test_logger() -> Logger {
    let logger = Logger::new(LoggerOptions {
        name: Some("ParityCorpus".into()),
        log_to_file: Some(false),
        ..Default::default()
    });
    logger.reset_context();
    logger
}

/// Builds one record at `level` with `message` and an optional context object.
fn emit(level: &str, message: &str, context: Option<&Value>) -> Map<String, Value> {
    let logger = test_logger();
    let mut args = LogArgs::new();
    args.push(message.to_string());
    if let Some(context) = context {
        args.push(context.clone());
    }
    logger
        .build_log_object(level_from_name(level), &args)
        .as_object()
        .expect("a record must be a JSON object")
        .clone()
}

#[test]
fn level_wire_shape_matches_corpus() {
    let _guard = CORPUS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let corpus = corpus();
    let rows = corpus["levels"]["rows"].as_array().expect("levels.rows");
    assert!(!rows.is_empty(), "an empty corpus is not coverage");

    let level_key = field(&corpus, "level");
    let log_level_key = field(&corpus, "logLevel");
    let message = corpus["record"]["message"].as_str().unwrap();

    for row in rows {
        let name = row["name"].as_str().unwrap();
        let record = emit(name, message, None);

        // level -> pino-compatible NUMERIC code
        assert_eq!(record[&level_key].as_u64(), row["level"].as_u64(), "{name}: numeric level");
        // LogLevel -> canonical lowercase STRING
        assert_eq!(record[&log_level_key].as_str(), row["LogLevel"].as_str(), "{name}: LogLevel string");
    }
}

#[test]
fn every_record_carries_the_required_fields() {
    let _guard = CORPUS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let corpus = corpus();
    let message = corpus["record"]["message"].as_str().unwrap();
    let required = corpus["record"]["requiredFields"].as_array().unwrap();

    for row in corpus["levels"]["rows"].as_array().unwrap() {
        let name = row["name"].as_str().unwrap();
        let record = emit(name, message, None);
        for required_field in required {
            let key = required_field.as_str().unwrap();
            assert!(record.contains_key(key), "{name}: required field {key:?} missing");
            assert!(!record[key].is_null(), "{name}: required field {key:?} is null");
        }
    }
}

#[test]
fn wire_field_names_match_corpus() {
    let corpus = corpus();
    let actual: Vec<(&str, &str)> = vec![
        ("level", ContextKey::Level.as_str()),
        ("logLevel", ContextKey::LogLevel.as_str()),
        ("time", ContextKey::Time.as_str()),
        ("message", ContextKey::Message.as_str()),
        ("name", ContextKey::Name.as_str()),
        ("context", ContextKey::Context.as_str()),
        ("correlationId", ContextKey::CorrelationId.as_str()),
        ("requestId", ContextKey::RequestId.as_str()),
        ("traceId", ContextKey::TraceId.as_str()),
        ("spanId", ContextKey::SpanId.as_str()),
        ("namespace", ContextKey::Namespace.as_str()),
        ("service", ContextKey::Service.as_str()),
        ("duration", ContextKey::Duration.as_str()),
        ("error", ContextKey::Error.as_str()),
        ("errorDetails", ContextKey::ErrorDetails.as_str()),
        ("user", ContextKey::User.as_str()),
        ("http", ContextKey::Http.as_str()),
    ];

    let names = corpus["fieldNames"].as_object().unwrap();
    for (concept, emitted) in &actual {
        assert_eq!(names[*concept].as_str(), Some(*emitted), "field {concept:?}: Rust emits {emitted:?}");
    }
    // Every concept the corpus names must be covered above — otherwise a new
    // shared field could be added and Rust would silently not be held to it.
    for concept in names.keys() {
        assert!(
            actual.iter().any(|(c, _)| c == concept),
            "corpus names concept {concept:?}, which this test does not map to a ContextKey"
        );
    }
}

#[test]
fn message_shape_matches_corpus() {
    let _guard = CORPUS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let corpus = corpus();
    let message_key = field(&corpus, "message");
    let context_key = field(&corpus, "context");

    for case in corpus["messageShape"]["cases"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let context = case["context"].is_object().then(|| case["context"].clone());
        let record = emit("info", case["message"].as_str().unwrap(), context.as_ref());

        assert_eq!(record[&message_key].as_str(), case["expectMsg"].as_str(), "{name}: msg");

        match case.get("expectContext").filter(|v| v.is_object()) {
            Some(expected) => {
                let actual = record[&context_key].as_object().unwrap();
                for (key, value) in expected.as_object().unwrap() {
                    assert_eq!(actual.get(key), Some(value), "{name}: context[{key:?}]");
                }
            }
            // A bare string message must not leak into `context`.
            None => assert!(!record.contains_key(&context_key), "{name}: bare message leaked into {context_key:?}"),
        }
    }
}

#[test]
fn correlation_id_surfaces_and_mirrors() {
    let _guard = CORPUS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let corpus = corpus();
    let expected = corpus["correlationId"]["value"].as_str().unwrap();

    let logger = test_logger();
    logger.set_correlation_id(expected);
    let mut args = LogArgs::new();
    args.push(corpus["record"]["message"].as_str().unwrap().to_string());
    let record = logger.build_log_object(Level::Info, &args);

    let field_name = corpus["correlationId"]["field"].as_str().unwrap();
    assert_eq!(record[field_name].as_str(), Some(expected));
    for mirrored in corpus["correlationId"]["alsoSets"].as_array().unwrap() {
        let key = mirrored.as_str().unwrap();
        assert_eq!(record[key].as_str(), Some(expected), "{key} must mirror correlationId");
    }
}

#[test]
fn default_redact_keys_match_corpus_in_order() {
    let corpus = corpus();
    let expected: Vec<String> = corpus["redaction"]["defaultKeys"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_str().unwrap().to_string())
        .collect();
    assert_eq!(default_redact_keys(), expected);
    assert_eq!(REDACTED_VALUE, corpus["redaction"]["placeholder"].as_str().unwrap());
}

#[test]
fn redaction_matches_corpus() {
    let _guard = CORPUS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let corpus = corpus();
    let context_key = field(&corpus, "context");
    let placeholder = corpus["redaction"]["placeholder"].as_str().unwrap();
    let message = corpus["record"]["message"].as_str().unwrap();

    for case in corpus["redaction"]["cases"].as_array().unwrap() {
        let name = case["name"].as_str().unwrap();
        let record = emit("info", message, Some(&case["context"]));
        let context = record[&context_key]
            .as_object()
            .unwrap_or_else(|| panic!("{name}: expected a {context_key:?} object"));

        for key in case["redacted"].as_array().unwrap() {
            let key = key.as_str().unwrap();
            assert_eq!(context[key].as_str(), Some(placeholder), "{name}: context[{key:?}] must be redacted");
        }
        for (key, value) in case["preserved"].as_object().unwrap() {
            assert_eq!(context.get(key), Some(value), "{name}: context[{key:?}] must be preserved");
        }
    }
}
