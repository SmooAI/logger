use std::collections::HashMap;

use once_cell::sync::Lazy;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use uuid::Uuid;

/// Context key names shared across logger implementations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ContextKey {
    Level,
    LogLevel,
    Time,
    Message,
    Name,
    CorrelationId,
    RequestId,
    TraceId,
    Namespace,
    Service,
    Duration,
    Error,
    ErrorDetails,
    Context,
    User,
    Http,
}

impl ContextKey {
    pub const fn as_str(&self) -> &'static str {
        match self {
            ContextKey::Level => "level",
            ContextKey::LogLevel => "LogLevel",
            ContextKey::Time => "time",
            ContextKey::Message => "msg",
            ContextKey::Name => "name",
            ContextKey::CorrelationId => "correlationId",
            ContextKey::RequestId => "requestId",
            ContextKey::TraceId => "traceId",
            ContextKey::Namespace => "namespace",
            ContextKey::Service => "service",
            ContextKey::Duration => "duration",
            ContextKey::Error => "error",
            ContextKey::ErrorDetails => "errorDetails",
            ContextKey::Context => "context",
            ContextKey::User => "user",
            ContextKey::Http => "http",
        }
    }
}

pub type ContextMap = Map<String, Value>;
pub type ContextValue = Value;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct User {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(rename = "fullName", skip_serializing_if = "Option::is_none")]
    pub full_name: Option<String>,
    #[serde(rename = "firstName", skip_serializing_if = "Option::is_none")]
    pub first_name: Option<String>,
    #[serde(rename = "lastName", skip_serializing_if = "Option::is_none")]
    pub last_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct HttpRequest {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub protocol: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hostname: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(rename = "queryString", skip_serializing_if = "Option::is_none")]
    pub query_string: Option<String>,
    #[serde(rename = "sourceIp", skip_serializing_if = "Option::is_none")]
    pub source_ip: Option<String>,
    #[serde(rename = "userAgent", skip_serializing_if = "Option::is_none")]
    pub user_agent: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct HttpResponse {
    #[serde(rename = "statusCode", skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct TelemetryFields {
    #[serde(rename = "requestId", skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<f64>,
    #[serde(rename = "traceId", skip_serializing_if = "Option::is_none")]
    pub trace_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub service: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Context configuration tree used to filter log payloads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContextConfig {
    /// Include everything in the target branch.
    AllowAll,
    /// Remove the target branch entirely.
    Deny,
    /// Keep only the listed keys at this level.
    OnlyKeys(Vec<String>),
    /// Apply nested configuration rules to object children.
    Nested(HashMap<String, ContextConfig>),
}

impl Default for ContextConfig {
    fn default() -> Self {
        ContextConfig::AllowAll
    }
}

pub static CONFIG_MINIMAL: Lazy<ContextConfig> = Lazy::new(|| {
    let mut http_map = HashMap::new();
    http_map.insert(
        "request".to_string(),
        ContextConfig::OnlyKeys(vec![
            "method".into(),
            "hostname".into(),
            "path".into(),
            "queryString".into(),
            "headers".into(),
            "sourceIp".into(),
            "userAgent".into(),
        ]),
    );
    http_map.insert(
        "response".to_string(),
        ContextConfig::OnlyKeys(vec!["statusCode".into(), "headers".into()]),
    );

    let mut root = HashMap::new();
    root.insert("http".into(), ContextConfig::Nested(http_map));
    ContextConfig::Nested(root)
});

pub const CONFIG_FULL: ContextConfig = ContextConfig::AllowAll;

static GLOBAL_CONTEXT: Lazy<RwLock<ContextValue>> =
    Lazy::new(|| RwLock::new(Value::Object(default_context_map())));

fn default_context_map() -> ContextMap {
    let mut map = Map::new();
    let id = Uuid::new_v4().to_string();
    map.insert(
        ContextKey::CorrelationId.as_str().to_string(),
        Value::String(id.clone()),
    );
    map.insert(
        ContextKey::RequestId.as_str().to_string(),
        Value::String(id.clone()),
    );
    map.insert(ContextKey::TraceId.as_str().to_string(), Value::String(id));
    map
}

fn with_global_context<F, R>(func: F) -> R
where
    F: FnOnce(&mut ContextMap) -> R,
{
    let mut guard = GLOBAL_CONTEXT.write();
    if !guard.is_object() {
        *guard = Value::Object(default_context_map());
    }
    let object = guard
        .as_object_mut()
        .expect("global context must be an object");
    func(object)
}

pub fn global_context() -> ContextValue {
    GLOBAL_CONTEXT.read().clone()
}

pub fn reset_global_context() {
    with_global_context(|object| {
        object.clear();
        object.extend(default_context_map());
    });
}

pub fn set_global_context(context: ContextValue) {
    let mut guard = GLOBAL_CONTEXT.write();
    *guard = match context {
        Value::Object(map) => Value::Object(map),
        other => other,
    };
}

pub fn update_global_context(context: &ContextValue) {
    with_global_context(|object| {
        if let Value::Object(incoming) = context {
            merge_maps(object, incoming);
        }
    });
}

pub fn base_context_key(key: &str) -> Option<ContextValue> {
    GLOBAL_CONTEXT.read().as_object()?.get(key).cloned()
}

pub fn add_base_context(context: &ContextValue) {
    update_global_context(context);
}

pub fn add_nested_context(context: &ContextValue) {
    with_global_context(|object| {
        let nested = object
            .entry(ContextKey::Context.as_str().to_string())
            .or_insert_with(|| Value::Object(Map::new()));
        if let Value::Object(nested_map) = nested {
            if let Value::Object(new_map) = context {
                merge_maps(nested_map, new_map);
            }
        }
    });
}

pub fn set_correlation_id(id: &str) {
    with_global_context(|object| {
        let value = Value::String(id.to_string());
        object.insert(ContextKey::CorrelationId.as_str().into(), value.clone());
        object.insert(ContextKey::RequestId.as_str().into(), value.clone());
        object.insert(ContextKey::TraceId.as_str().into(), value);
    });
}

pub fn merge_maps(target: &mut ContextMap, patch: &ContextMap) {
    for (key, value) in patch.iter() {
        merge_value(target.entry(key.clone()).or_insert(Value::Null), value);
    }
}

fn merge_value(target: &mut Value, patch: &Value) {
    if let Value::Object(target_map) = target {
        if let Value::Object(patch_map) = patch {
            for (key, value) in patch_map {
                merge_value(target_map.entry(key.clone()).or_insert(Value::Null), value);
            }
            return;
        }
    }

    *target = patch.clone();
}

pub fn remove_nulls(value: &mut Value) -> bool {
    match value {
        Value::Object(map) => {
            let mut keys_to_remove = Vec::new();
            for (key, val) in map.iter_mut() {
                if remove_nulls(val) {
                    keys_to_remove.push(key.clone());
                }
            }
            for key in keys_to_remove {
                map.remove(&key);
            }
            map.is_empty()
        }
        Value::Array(array) => {
            array.retain_mut(|item| !remove_nulls(item));
            array.is_empty()
        }
        Value::Null => true,
        _ => false,
    }
}

pub fn apply_context_config(value: &Value, config: &ContextConfig) -> Value {
    match config {
        ContextConfig::AllowAll => value.clone(),
        ContextConfig::Deny => Value::Null,
        ContextConfig::OnlyKeys(keys) => {
            if let Value::Object(map) = value {
                let mut filtered = Map::new();
                for key in keys {
                    if let Some(val) = map.get(key) {
                        filtered.insert(key.clone(), val.clone());
                    }
                }
                Value::Object(filtered)
            } else {
                Value::Null
            }
        }
        ContextConfig::Nested(children) => {
            if let Value::Object(map) = value {
                let mut filtered = Map::new();
                for (key, val) in map {
                    let child_config = children.get(key).unwrap_or(&ContextConfig::AllowAll);
                    let filtered_value = apply_context_config(val, child_config);
                    if !is_effectively_empty(&filtered_value) {
                        filtered.insert(key.clone(), filtered_value);
                    }
                }
                Value::Object(filtered)
            } else {
                value.clone()
            }
        }
    }
}

fn is_effectively_empty(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::Object(map) => map.is_empty(),
        Value::Array(array) => array.is_empty(),
        _ => false,
    }
}

pub fn context_value<T: Serialize>(value: T) -> Value {
    serde_json::to_value(value).unwrap_or_else(|_| json!({}))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_context_initializes_ids() {
        reset_global_context();
        let context = global_context();
        let obj = context.as_object().unwrap();
        assert!(obj.get(ContextKey::CorrelationId.as_str()).is_some());
        assert!(obj.get(ContextKey::RequestId.as_str()).is_some());
        assert!(obj.get(ContextKey::TraceId.as_str()).is_some());
    }

    #[test]
    fn apply_minimal_context_config_filters_http() {
        let value = json!({
            "http": {
                "request": {
                    "method": "GET",
                    "hostname": "example.com",
                    "body": {"secure": true}
                },
                "response": {
                    "statusCode": 200,
                    "body": "secret"
                },
                "other": "keep"
            },
            "namespace": "test"
        });

        let filtered = apply_context_config(&value, &*CONFIG_MINIMAL);
        let http = filtered.get("http").unwrap().as_object().unwrap();
        let request = http.get("request").unwrap().as_object().unwrap();
        assert_eq!(request.get("method").unwrap(), "GET");
        assert!(request.get("body").is_none());
        let response = http.get("response").unwrap().as_object().unwrap();
        assert_eq!(response.get("statusCode").unwrap(), 200);
        assert!(response.get("body").is_none());
        assert_eq!(http.get("other").unwrap(), "keep");
    }
}
