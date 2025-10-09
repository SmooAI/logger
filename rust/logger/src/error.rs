use std::any::type_name;
use std::error::Error;

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct LoggedError {
    pub message: String,
    #[serde(rename = "name")]
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stack: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub causes: Vec<String>,
}

impl LoggedError {
    pub fn to_value(&self) -> Value {
        serde_json::to_value(self).unwrap_or(Value::Null)
    }
}

pub fn log_error<E>(error: E) -> LoggedError
where
    E: Error + Send + Sync + 'static,
{
    let message = error.to_string();
    let name = extract_type_name::<E>();
    let debug_stack = format!("{:?}", error);

    let mut causes = Vec::new();
    let mut current = error.source();
    while let Some(cause) = current {
        causes.push(cause.to_string());
        current = cause.source();
    }

    LoggedError {
        message,
        name,
        stack: Some(debug_stack),
        causes,
    }
}

fn extract_type_name<T>() -> String {
    type_name::<T>()
        .rsplit("::")
        .next()
        .unwrap_or("Error")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug)]
    struct SampleError;

    impl std::fmt::Display for SampleError {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            write!(f, "sample error")
        }
    }

    impl Error for SampleError {}

    #[test]
    fn log_error_captures_message() {
        let logged = log_error(SampleError);
        assert_eq!(logged.message, "sample error");
        assert_eq!(logged.name, "SampleError");
        assert!(logged.stack.is_some());
    }
}
