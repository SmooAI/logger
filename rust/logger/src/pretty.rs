use colored::{Color, Colorize};
use serde_json::Value;

const SEPARATOR: &str = "----------------------------------------------------------------------------------------------------";
const MESSAGE_COLOR: Color = Color::TrueColor { r: 46, g: 204, b: 113 };
const TIME_COLOR: Color = Color::TrueColor { r: 52, g: 152, b: 219 };
const ERROR_COLOR: Color = Color::TrueColor { r: 231, g: 76, b: 60 };

pub fn pretty_json(object: &Value) -> String {
    let mut output = String::new();
    let serialized = serde_json::to_string_pretty(object).unwrap_or_else(|_| "{}".to_string());

    for line in serialized.lines() {
        let trimmed = line.trim_start();
        let formatted = if trimmed.starts_with("\"msg\"") {
            highlight_key(line, MESSAGE_COLOR)
        } else if trimmed.starts_with("\"time\"") {
            highlight_key(line, TIME_COLOR)
        } else if trimmed.starts_with("\"error\"") {
            highlight_key(line, ERROR_COLOR)
        } else {
            line.to_string()
        };
        output.push_str(&formatted);
        output.push('\n');
    }

    output.push_str(SEPARATOR);
    output.push('\n');
    output.push_str(SEPARATOR);
    output.push('\n');
    output.push_str(SEPARATOR);
    output.push('\n');

    output
}

fn highlight_key(line: &str, color: Color) -> String {
    let mut parts = line.splitn(2, ':');
    if let (Some(key), Some(rest)) = (parts.next(), parts.next()) {
        format!("{}:{}", key.color(color).bold(), rest)
    } else {
        line.to_string()
    }
}

pub fn plain_json(object: &Value) -> String {
    serde_json::to_string(object).unwrap_or_else(|_| "{}".to_string())
}

pub fn separator() -> &'static str {
    SEPARATOR
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn pretty_json_formats() {
        let value = json!({"msg": "hello", "time": "now"});
        let formatted = pretty_json(&value);
        assert!(formatted.contains(SEPARATOR));
    }
}
