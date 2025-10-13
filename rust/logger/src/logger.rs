use std::collections::HashMap;
use std::error::Error;
use std::fmt;
use std::io::{self, Write};
use std::sync::Arc;

use chrono::{SecondsFormat, Utc};
use serde_json::{Map, Value};
use url::Url;
use uuid::Uuid;

use crate::context::{
    self, add_base_context, add_nested_context, apply_context_config, base_context_key,
    context_value, remove_nulls, reset_global_context, set_correlation_id, ContextConfig,
    ContextKey, HttpRequest, HttpResponse, TelemetryFields, User, CONFIG_FULL, CONFIG_MINIMAL,
};
use crate::env::{is_build, is_local};
use crate::error::{log_error, LoggedError};
use crate::pretty;
use crate::rotation::{RotatingFileWriter, RotationOptions};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Level {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
    Fatal,
}

impl Level {
    pub fn as_str(&self) -> &'static str {
        match self {
            Level::Trace => "trace",
            Level::Debug => "debug",
            Level::Info => "info",
            Level::Warn => "warn",
            Level::Error => "error",
            Level::Fatal => "fatal",
        }
    }

    pub fn code(&self) -> u32 {
        match self {
            Level::Trace => 10,
            Level::Debug => 20,
            Level::Info => 30,
            Level::Warn => 40,
            Level::Error => 50,
            Level::Fatal => 60,
        }
    }

    pub fn parse_level(level: &str) -> Option<Self> {
        match level.to_ascii_lowercase().as_str() {
            "trace" => Some(Level::Trace),
            "debug" => Some(Level::Debug),
            "info" => Some(Level::Info),
            "warn" | "warning" => Some(Level::Warn),
            "error" => Some(Level::Error),
            "fatal" => Some(Level::Fatal),
            _ => None,
        }
    }
}

impl fmt::Display for Level {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[derive(Debug, Clone, Default)]
pub struct LoggerOptions {
    pub name: Option<String>,
    pub context: Option<Value>,
    pub level: Option<Level>,
    pub context_config: Option<ContextConfig>,
    pub pretty_print: Option<bool>,
    pub log_to_file: Option<bool>,
    pub rotation: Option<RotationOptions>,
    pub config_settings: Option<HashMap<String, ContextConfig>>,
}

fn default_config_settings() -> HashMap<String, ContextConfig> {
    let mut settings = HashMap::new();
    settings.insert("DEFAULT".into(), (*CONFIG_MINIMAL).clone());
    settings.insert("MINIMAL".into(), (*CONFIG_MINIMAL).clone());
    settings.insert("FULL".into(), CONFIG_FULL.clone());
    settings
}

pub struct Logger {
    name: String,
    level: Level,
    context_config: Option<ContextConfig>,
    config_settings: HashMap<String, ContextConfig>,
    pretty_print: bool,
    log_to_file: bool,
    rotation: RotationOptions,
    file_writer: Option<Arc<RotatingFileWriter>>,
}

impl Default for Logger {
    fn default() -> Self {
        Logger::new(LoggerOptions::default())
    }
}

impl Logger {
    pub fn new(mut options: LoggerOptions) -> Self {
        let name = options.name.take().unwrap_or_else(|| "Logger".to_string());
        let level = options
            .level
            .or_else(|| {
                std::env::var("LOG_LEVEL")
                    .ok()
                    .and_then(|lvl| Level::parse_level(&lvl))
            })
            .unwrap_or(Level::Info);
        let pretty_print = options
            .pretty_print
            .unwrap_or_else(|| is_local() || is_build());

        let rotation = options.rotation.unwrap_or_default();

        let mut config_settings = options
            .config_settings
            .unwrap_or_else(default_config_settings);

        let context_config = options.context_config.take().or_else(|| {
            std::env::var("LOGGER_CONTEXT_CONFIG")
                .ok()
                .and_then(|key| config_settings.get(&key).cloned())
        });

        if !config_settings.contains_key("FULL") {
            config_settings.insert("FULL".into(), CONFIG_FULL.clone());
        }

        if !config_settings.contains_key("MINIMAL") {
            config_settings.insert("MINIMAL".into(), (*CONFIG_MINIMAL).clone());
        }

        let log_to_file = options.log_to_file.unwrap_or_else(is_local);
        let file_writer = if log_to_file {
            RotatingFileWriter::new(rotation.clone()).ok().map(Arc::new)
        } else {
            None
        };

        if let Some(context) = options.context.take() {
            let mut context = context;
            remove_nulls(&mut context);
            add_base_context(&context);
            if let Some(Value::String(correlation)) = context
                .as_object()
                .and_then(|map| map.get(ContextKey::CorrelationId.as_str()))
            {
                set_correlation_id(correlation);
            }
        }

        Self {
            name,
            level,
            context_config,
            config_settings,
            pretty_print,
            log_to_file: file_writer.is_some(),
            rotation,
            file_writer,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn set_name<S: Into<String>>(&mut self, name: S) {
        self.name = name.into();
    }

    pub fn level(&self) -> Level {
        self.level
    }

    pub fn set_level(&mut self, level: Level) {
        self.level = level;
    }

    pub fn rotation_options(&self) -> &RotationOptions {
        &self.rotation
    }

    pub fn logs_to_file(&self) -> bool {
        self.log_to_file
    }

    pub fn set_namespace<S: Into<String>>(&self, namespace: S) {
        self.add_base_context_key(
            ContextKey::Namespace.as_str(),
            Value::String(namespace.into()),
        );
    }

    pub fn context(&self) -> Value {
        context::global_context()
    }

    pub fn set_context(&self, context: Value) {
        context::set_global_context(context);
    }

    pub fn context_config(&self) -> Option<&ContextConfig> {
        self.context_config.as_ref()
    }

    pub fn set_context_config(&mut self, config: Option<ContextConfig>) {
        self.context_config = config;
    }

    pub fn config_settings(&self) -> &HashMap<String, ContextConfig> {
        &self.config_settings
    }

    pub fn set_config_settings(&mut self, settings: HashMap<String, ContextConfig>) {
        self.config_settings = settings;
    }

    pub fn reset_context(&self) {
        reset_global_context();
        self.reset_correlation_id();
    }

    pub fn add_base_context_key<V: Into<Value>>(&self, key: &str, value: V) {
        let mut map = Map::new();
        map.insert(key.to_string(), value.into());
        add_base_context(&Value::Object(map));
    }

    pub fn add_context(&self, context: Value) {
        add_nested_context(&context);
    }

    pub fn add_base_context(&self, context: Value) {
        add_base_context(&context);
    }

    pub fn correlation_id(&self) -> Option<String> {
        base_context_key(ContextKey::CorrelationId.as_str())
            .and_then(|value| value.as_str().map(|s| s.to_string()))
    }

    pub fn reset_correlation_id(&self) {
        let id = Uuid::new_v4().to_string();
        set_correlation_id(&id);
    }

    pub fn set_correlation_id(&self, id: &str) {
        set_correlation_id(id);
    }

    pub fn add_user_context(&self, user: User) {
        let value = context_value(user);
        let mut wrapper = Map::new();
        wrapper.insert(ContextKey::User.as_str().into(), value);
        add_base_context(&Value::Object(wrapper));
    }

    pub fn add_http_request(&self, http_request: HttpRequest) {
        if let (Some(method), Some(path)) =
            (http_request.method.as_ref(), http_request.path.as_ref())
        {
            let namespace = format!("{} {}", method.to_uppercase(), path);
            self.set_namespace(namespace);
        }

        if let Some(headers) = &http_request.headers {
            if let Some(correlation) = headers
                .get("X-Correlation-Id")
                .or_else(|| headers.get("x-correlation-id"))
            {
                self.set_correlation_id(correlation.as_str());
            }
        }

        self.add_http_context(Some(http_request), None);
    }

    pub fn add_http_response(&self, http_response: HttpResponse) {
        self.add_http_context(None, Some(http_response));
    }

    fn add_http_context(&self, request: Option<HttpRequest>, response: Option<HttpResponse>) {
        let mut http_map = Map::new();
        if let Some(req) = request {
            http_map.insert("request".into(), context_value(req));
        }
        if let Some(res) = response {
            http_map.insert("response".into(), context_value(res));
        }
        if http_map.is_empty() {
            return;
        }
        let mut wrapper = Map::new();
        wrapper.insert(ContextKey::Http.as_str().into(), Value::Object(http_map));
        add_base_context(&Value::Object(wrapper));
    }

    pub fn add_telemetry_fields(&self, fields: TelemetryFields) {
        add_base_context(&context_value(fields));
    }

    pub fn base_context_key(&self, key: &str) -> Option<Value> {
        base_context_key(key)
    }

    pub fn http_request_origin_domain(&self) -> Option<String> {
        let http_value = self.base_context_key(ContextKey::Http.as_str())?;
        let http_obj = http_value.as_object()?;
        let request = http_obj.get("request")?.as_object()?;
        let headers = request.get("headers")?.as_object()?;
        let origin = headers
            .get("origin")
            .or_else(|| headers.get("referrer"))
            .and_then(|value| value.as_str())?;
        Url::parse(origin)
            .ok()
            .and_then(|url| url.host_str().map(|host| host.to_string()))
    }

    pub fn build_log_object(&self, level: Level, args: &LogArgs) -> Value {
        let mut payload = context::global_context();
        if !payload.is_object() {
            payload = Value::Object(Map::new());
        }
        let map = payload
            .as_object_mut()
            .expect("log payload should be object");

        if let Some(msg) = args.message() {
            map.insert(ContextKey::Message.as_str().into(), Value::String(msg));
        }

        if !args.contexts.is_empty() {
            let entry = map
                .entry(ContextKey::Context.as_str().to_string())
                .or_insert_with(|| Value::Object(Map::new()));
            if let Value::Object(context_map) = entry {
                for ctx in &args.contexts {
                    if let Value::Object(obj) = ctx {
                        context::merge_maps(context_map, obj);
                    }
                }
            }
        }

        if !args.errors.is_empty() {
            let error_message = args
                .errors
                .iter()
                .map(|err| err.message.clone())
                .collect::<Vec<_>>()
                .join("; ");
            map.insert(
                ContextKey::Error.as_str().into(),
                Value::String(error_message),
            );
            let details = args
                .errors
                .iter()
                .map(|err| err.to_value())
                .collect::<Vec<_>>();
            map.insert(
                ContextKey::ErrorDetails.as_str().into(),
                Value::Array(details),
            );
        }

        if !map.contains_key(ContextKey::Message.as_str()) {
            if let Some(Value::String(error_msg)) = map.get(ContextKey::Error.as_str()) {
                map.insert(
                    ContextKey::Message.as_str().into(),
                    Value::String(error_msg.clone()),
                );
            }
        }

        map.insert(
            ContextKey::Level.as_str().into(),
            Value::Number(serde_json::Number::from(u64::from(level.code()))),
        );
        map.insert(
            ContextKey::LogLevel.as_str().into(),
            Value::String(level.as_str().into()),
        );
        map.insert(
            ContextKey::Time.as_str().into(),
            Value::String(Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)),
        );
        map.insert(
            ContextKey::Name.as_str().into(),
            Value::String(self.name.clone()),
        );

        remove_nulls(&mut payload);

        if let Some(config) = &self.context_config {
            payload = apply_context_config(&payload, config);
        }

        payload
    }

    fn emit(&self, payload: Value) -> io::Result<()> {
        let output = if self.pretty_print {
            pretty::pretty_json(&payload)
        } else {
            let mut line = pretty::plain_json(&payload);
            line.push('\n');
            line
        };

        let mut stdout = io::stdout();
        stdout.write_all(output.as_bytes())?;
        stdout.flush()?;

        if let Some(writer) = &self.file_writer {
            writer.write(&output)?;
        }

        Ok(())
    }

    fn do_log(&self, level: Level, args: LogArgs) -> io::Result<()> {
        let payload = self.build_log_object(level, &args);
        self.emit(payload)
    }

    fn is_enabled(&self, level: Level) -> bool {
        level.code() >= self.level.code()
    }

    pub fn trace<A: Into<LogArgs>>(&self, args: A) -> io::Result<()> {
        if self.is_enabled(Level::Trace) {
            self.do_log(Level::Trace, args.into())
        } else {
            Ok(())
        }
    }

    pub fn debug<A: Into<LogArgs>>(&self, args: A) -> io::Result<()> {
        if self.is_enabled(Level::Debug) {
            self.do_log(Level::Debug, args.into())
        } else {
            Ok(())
        }
    }

    pub fn info<A: Into<LogArgs>>(&self, args: A) -> io::Result<()> {
        if self.is_enabled(Level::Info) {
            self.do_log(Level::Info, args.into())
        } else {
            Ok(())
        }
    }

    pub fn warn<A: Into<LogArgs>>(&self, args: A) -> io::Result<()> {
        if self.is_enabled(Level::Warn) {
            self.do_log(Level::Warn, args.into())
        } else {
            Ok(())
        }
    }

    pub fn error<A: Into<LogArgs>>(&self, args: A) -> io::Result<()> {
        if self.is_enabled(Level::Error) {
            self.do_log(Level::Error, args.into())
        } else {
            Ok(())
        }
    }

    pub fn fatal<A: Into<LogArgs>>(&self, args: A) -> io::Result<()> {
        if self.is_enabled(Level::Fatal) {
            self.do_log(Level::Fatal, args.into())
        } else {
            Ok(())
        }
    }

    pub fn silent<A: Into<LogArgs>>(&self, _args: A) -> io::Result<()> {
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub enum LogValue {
    Message(String),
    Context(Value),
    Error(LoggedError),
}

#[derive(Debug, Clone, Default)]
pub struct LogArgs {
    messages: Vec<String>,
    pub(crate) contexts: Vec<Value>,
    pub(crate) errors: Vec<LoggedError>,
}

impl LogArgs {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push<T: Into<LogValue>>(&mut self, value: T) {
        match value.into() {
            LogValue::Message(message) => self.messages.push(message),
            LogValue::Context(context) => self.contexts.push(context),
            LogValue::Error(error) => self.errors.push(error),
        }
    }

    pub fn error<E>(&mut self, error: E)
    where
        E: Error + Send + Sync + 'static,
    {
        self.errors.push(log_error(error));
    }

    pub fn extend<I, T>(&mut self, iter: I)
    where
        I: IntoIterator<Item = T>,
        T: Into<LogValue>,
    {
        for item in iter {
            self.push(item);
        }
    }

    pub fn message(&self) -> Option<String> {
        if self.messages.is_empty() {
            None
        } else {
            Some(self.messages.join("; "))
        }
    }
}

impl From<&str> for LogArgs {
    fn from(value: &str) -> Self {
        let mut args = LogArgs::new();
        args.push(value);
        args
    }
}

impl From<String> for LogArgs {
    fn from(value: String) -> Self {
        let mut args = LogArgs::new();
        args.push(value);
        args
    }
}

impl From<Value> for LogArgs {
    fn from(value: Value) -> Self {
        let mut args = LogArgs::new();
        args.push(value);
        args
    }
}

impl From<LoggedError> for LogArgs {
    fn from(value: LoggedError) -> Self {
        let mut args = LogArgs::new();
        args.push(value);
        args
    }
}

impl FromIterator<LogValue> for LogArgs {
    fn from_iter<T: IntoIterator<Item = LogValue>>(iter: T) -> Self {
        let mut args = LogArgs::new();
        args.extend(iter);
        args
    }
}

impl FromIterator<LogArgs> for LogArgs {
    fn from_iter<T: IntoIterator<Item = LogArgs>>(iter: T) -> Self {
        let mut args = LogArgs::new();
        for sub in iter {
            args.extend(sub.into_iter());
        }
        args
    }
}

impl IntoIterator for LogArgs {
    type Item = LogValue;
    type IntoIter = LogArgsIntoIter;

    fn into_iter(self) -> Self::IntoIter {
        LogArgsIntoIter {
            messages: self.messages.into_iter(),
            contexts: self.contexts.into_iter(),
            errors: self.errors.into_iter(),
        }
    }
}

pub struct LogArgsIntoIter {
    messages: std::vec::IntoIter<String>,
    contexts: std::vec::IntoIter<Value>,
    errors: std::vec::IntoIter<LoggedError>,
}

impl Iterator for LogArgsIntoIter {
    type Item = LogValue;

    fn next(&mut self) -> Option<Self::Item> {
        if let Some(message) = self.messages.next() {
            return Some(LogValue::Message(message));
        }
        if let Some(context) = self.contexts.next() {
            return Some(LogValue::Context(context));
        }
        if let Some(error) = self.errors.next() {
            return Some(LogValue::Error(error));
        }
        None
    }
}

impl From<&str> for LogValue {
    fn from(value: &str) -> Self {
        LogValue::Message(value.to_string())
    }
}

impl From<String> for LogValue {
    fn from(value: String) -> Self {
        LogValue::Message(value)
    }
}

impl From<Value> for LogValue {
    fn from(value: Value) -> Self {
        LogValue::Context(value)
    }
}

impl From<LoggedError> for LogValue {
    fn from(value: LoggedError) -> Self {
        LogValue::Error(value)
    }
}

impl<'a> From<&'a LoggedError> for LogValue {
    fn from(value: &'a LoggedError) -> Self {
        LogValue::Error(value.clone())
    }
}

#[macro_export]
macro_rules! log_args {
    () => {
        $crate::logger::LogArgs::new()
    };
    ($($arg:expr),+ $(,)?) => {{
        let mut args = $crate::logger::LogArgs::new();
        $( args.push($arg); )+
        args
    }};
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::collections::HashMap;

    #[test]
    fn build_log_object_includes_message_and_context() {
        let logger = Logger::default();
        let args = log_args!("hello", json!({"foo": "bar"}));
        let payload = logger.build_log_object(Level::Info, &args);
        let obj = payload.as_object().unwrap();
        assert_eq!(obj.get("msg").unwrap(), "hello");
        let context = obj.get("context").unwrap().as_object().unwrap();
        assert_eq!(context.get("foo").unwrap(), "bar");
    }

    #[derive(Debug)]
    struct SampleError;

    impl std::fmt::Display for SampleError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "sample error")
        }
    }

    impl std::error::Error for SampleError {}

    #[test]
    fn build_log_object_collects_error_details() {
        let logger = Logger::default();
        logger.reset_context();
        let args = log_args!(log_error(SampleError));
        let payload = logger.build_log_object(Level::Error, &args);
        let obj = payload.as_object().unwrap();
        assert_eq!(obj.get("error").unwrap(), "sample error");
        let details = obj.get("errorDetails").unwrap().as_array().unwrap();
        assert_eq!(details[0].get("message").unwrap(), "sample error");
    }

    #[test]
    fn add_http_request_sets_namespace_and_correlation() {
        let logger = Logger::default();
        logger.reset_context();
        let mut headers = HashMap::new();
        headers.insert("X-Correlation-Id".to_string(), "abc-123".to_string());
        let request = HttpRequest {
            method: Some("get".into()),
            path: Some("/thing".into()),
            headers: Some(headers.clone()),
            ..Default::default()
        };
        logger.add_http_request(request);
        let ctx = logger.context();
        let obj = ctx.as_object().unwrap();
        assert_eq!(obj.get("namespace").unwrap(), "GET /thing");
        assert_eq!(obj.get("correlationId").unwrap(), "abc-123");
        let origin = logger.http_request_origin_domain();
        assert!(origin.is_none());

        let mut origin_headers = headers;
        origin_headers.insert("origin".into(), "https://example.com/path".into());
        logger.add_http_request(HttpRequest {
            method: Some("post".into()),
            path: Some("/submit".into()),
            headers: Some(origin_headers),
            ..Default::default()
        });
        assert_eq!(
            logger.http_request_origin_domain().as_deref(),
            Some("example.com")
        );
    }

    #[test]
    fn context_config_filters_fields() {
        let mut logger = Logger::default();
        logger.reset_context();
        logger.set_context_config(Some((*CONFIG_MINIMAL).clone()));
        let request = json!({
            "http": {
                "request": {
                    "method": "GET",
                    "hostname": "example.com",
                    "path": "/secret",
                    "body": {"sensitive": true}
                }
            }
        });
        logger.add_base_context(request);
        let payload = logger.build_log_object(Level::Info, &log_args!());
        let http = payload
            .get("http")
            .unwrap()
            .as_object()
            .unwrap()
            .get("request")
            .unwrap()
            .as_object()
            .unwrap();
        assert!(http.get("body").is_none());
        assert!(http.get("method").is_some());
    }
}
