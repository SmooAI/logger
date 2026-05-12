//! AWS context helpers — Lambda, API Gateway, SQS, ECS.
//!
//! Mirrors the Go (`go/lambda.go`) and Python (`python/src/smooai_logger/aws_logger.py`)
//! ports' AwsServerLogger surface. Adds invocation/event metadata to the logger's
//! base context so it lands in CloudWatch alongside every structured log entry.
//!
//! ## Feature gates
//!
//! Lambda / SQS / API Gateway helpers depend on the AWS event types from
//! [`lambda_runtime`] and [`aws_lambda_events`], so they're gated behind the
//! `aws-lambda` cargo feature.
//!
//! ECS context helpers ([`ecs_environment_context`] / [`AwsContextLogger::add_ecs_context`])
//! read env vars only and are always available.
//!
//! ## Example
//!
//! ```no_run
//! use smooai_logger::{Logger, aws::AwsContextLogger};
//!
//! let logger = Logger::default();
//! logger.add_ecs_context();
//! let _ = logger.info("running in ECS");
//! ```

use serde_json::{json, Map, Value};

use crate::context::add_base_context;
use crate::logger::Logger;

/// Captures `AWS_LAMBDA_FUNCTION_NAME` / `AWS_LAMBDA_FUNCTION_VERSION` /
/// `AWS_EXECUTION_ENV` / `AWS_LAMBDA_LOG_GROUP_NAME` / `AWS_LAMBDA_LOG_STREAM_NAME` /
/// `AWS_LAMBDA_FUNCTION_MEMORY_SIZE` / `AWS_REGION` / `NODE_ENV` env vars into
/// a structured value, ready to merge under `lambda` and top-level region/env keys.
pub fn lambda_environment_context() -> Value {
    let mut lambda = Map::new();
    if let Ok(v) = std::env::var("AWS_LAMBDA_FUNCTION_NAME") {
        lambda.insert("functionName".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_LAMBDA_FUNCTION_VERSION") {
        lambda.insert("functionVersion".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_EXECUTION_ENV") {
        lambda.insert("executionEnvironment".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_LAMBDA_LOG_GROUP_NAME") {
        lambda.insert("logGroupName".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_LAMBDA_LOG_STREAM_NAME") {
        lambda.insert("logStreamName".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_LAMBDA_FUNCTION_MEMORY_SIZE") {
        lambda.insert("functionMemorySize".into(), Value::String(v));
    }

    let mut root = Map::new();
    if !lambda.is_empty() {
        root.insert("lambda".into(), Value::Object(lambda));
    }
    if let Ok(v) = std::env::var("AWS_REGION").or_else(|_| std::env::var("AWS_DEFAULT_REGION")) {
        root.insert("region".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("NODE_ENV") {
        root.insert("nodeEnv".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("NODE_CONFIG_ENV") {
        root.insert("nodeConfigEnv".into(), Value::String(v));
    }
    Value::Object(root)
}

/// Captures Amazon ECS / Fargate env vars into an `ecs` context object.
///
/// Reads: `ECS_CONTAINER_METADATA_URI_V4`, `ECS_CONTAINER_METADATA_URI`,
/// `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI`, `ECS_AGENT_URI`,
/// `AWS_EXECUTION_ENV`, `AWS_DEFAULT_REGION`, `AWS_REGION`.
pub fn ecs_environment_context() -> Value {
    let mut ecs = Map::new();
    if let Ok(v) = std::env::var("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI") {
        ecs.insert("containerCredentialsRelativeUri".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("ECS_CONTAINER_METADATA_URI_V4") {
        ecs.insert("containerMetadataUriV4".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("ECS_CONTAINER_METADATA_URI") {
        ecs.insert("containerMetadataUri".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("ECS_AGENT_URI") {
        ecs.insert("agentUri".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_EXECUTION_ENV") {
        ecs.insert("executionEnv".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_DEFAULT_REGION") {
        ecs.insert("defaultRegion".into(), Value::String(v));
    }
    if let Ok(v) = std::env::var("AWS_REGION") {
        ecs.insert("region".into(), Value::String(v));
    }
    json!({ "ecs": Value::Object(ecs) })
}

/// AWS context extension methods on [`Logger`]. Provides parity with the
/// Go `LambdaLogger` and Python `AwsServerLogger` surfaces.
pub trait AwsContextLogger {
    /// Attach Lambda environment vars (function name, version, log group, etc.)
    /// to the logger's base context. Works regardless of the `aws-lambda` feature.
    fn add_lambda_environment_context(&self);

    /// Attach ECS / Fargate task metadata to the logger's base context under `ecs`.
    /// Works regardless of the `aws-lambda` feature.
    fn add_ecs_context(&self);

    /// Attach Lambda invocation context (requestId, function ARN, etc.) plus
    /// the environment context to the logger's base context. Requires the
    /// `aws-lambda` feature.
    #[cfg(feature = "aws-lambda")]
    fn add_lambda_context(&self, ctx: &lambda_runtime::Context);

    /// Attach SQS record context (messageId, eventSource, eventSourceArn) plus
    /// any string message attributes to the logger's base context under `sqs`.
    /// Also sets the correlation ID to the SQS message ID. Requires the
    /// `aws-lambda` feature.
    #[cfg(feature = "aws-lambda")]
    fn add_sqs_record_context(&self, record: &aws_lambda_events::sqs::SqsMessage);

    /// Attach API Gateway proxy request context (route, method, path, headers)
    /// to the logger's base context, mirroring `addLambdaContext` in the TS port.
    /// Requires the `aws-lambda` feature.
    #[cfg(feature = "aws-lambda")]
    fn add_api_gateway_context(&self, request: &aws_lambda_events::apigw::ApiGatewayProxyRequest);
}

impl AwsContextLogger for Logger {
    fn add_lambda_environment_context(&self) {
        let env_ctx = lambda_environment_context();
        if let Value::Object(map) = &env_ctx {
            if map.is_empty() {
                return;
            }
        }
        add_base_context(&env_ctx);
    }

    fn add_ecs_context(&self) {
        let ecs_ctx = ecs_environment_context();
        if let Some(inner) = ecs_ctx.get("ecs").and_then(|v| v.as_object()) {
            if inner.is_empty() {
                return;
            }
        }
        add_base_context(&ecs_ctx);
    }

    #[cfg(feature = "aws-lambda")]
    fn add_lambda_context(&self, ctx: &lambda_runtime::Context) {
        let mut lambda = Map::new();
        if !ctx.request_id.is_empty() {
            lambda.insert("requestId".into(), Value::String(ctx.request_id.clone()));
        }
        if !ctx.invoked_function_arn.is_empty() {
            lambda.insert("functionArn".into(), Value::String(ctx.invoked_function_arn.clone()));
        }
        if let Some(trace_id) = ctx.xray_trace_id.as_ref() {
            if !trace_id.is_empty() {
                lambda.insert("xrayTraceId".into(), Value::String(trace_id.clone()));
            }
        }

        let mut root = Map::new();
        root.insert("lambda".into(), Value::Object(lambda));
        add_base_context(&Value::Object(root));

        // Merge environment context on top
        self.add_lambda_environment_context();

        // Use the Lambda request ID as the correlation ID
        if !ctx.request_id.is_empty() {
            self.set_correlation_id(&ctx.request_id);
        }
    }

    #[cfg(feature = "aws-lambda")]
    fn add_sqs_record_context(&self, record: &aws_lambda_events::sqs::SqsMessage) {
        let mut sqs = Map::new();
        if let Some(id) = &record.message_id {
            sqs.insert("messageId".into(), Value::String(id.clone()));
        }
        if let Some(src) = &record.event_source {
            sqs.insert("eventSource".into(), Value::String(src.clone()));
        }
        if let Some(arn) = &record.event_source_arn {
            sqs.insert("eventSourceArn".into(), Value::String(arn.clone()));
        }
        if let Some(handle) = &record.receipt_handle {
            sqs.insert("receiptHandle".into(), Value::String(handle.clone()));
        }

        // String-valued message attributes (skip Binary)
        let mut attrs = Map::new();
        for (k, attr) in record.message_attributes.iter() {
            if let Some(s) = &attr.string_value {
                attrs.insert(k.clone(), Value::String(s.clone()));
            }
        }
        if !attrs.is_empty() {
            sqs.insert("attributes".into(), Value::Object(attrs));
        }

        let mut root = Map::new();
        root.insert("sqs".into(), Value::Object(sqs));
        add_base_context(&Value::Object(root));

        if let Some(id) = &record.message_id {
            if !id.is_empty() {
                self.set_correlation_id(id);
            }
        }
    }

    #[cfg(feature = "aws-lambda")]
    fn add_api_gateway_context(&self, request: &aws_lambda_events::apigw::ApiGatewayProxyRequest) {
        let mut http_request = Map::new();
        http_request.insert("method".into(), Value::String(request.http_method.as_str().to_string()));
        if let Some(path) = &request.path {
            http_request.insert("path".into(), Value::String(path.clone()));
        }

        // Headers — aws_lambda_events uses HeaderMap; flatten string-valued entries.
        let mut headers = Map::new();
        for (key, value) in request.headers.iter() {
            if let Ok(v) = value.to_str() {
                headers.insert(key.as_str().to_string(), Value::String(v.to_string()));
            }
        }
        if !headers.is_empty() {
            http_request.insert("headers".into(), Value::Object(headers));
        }

        // API Gateway-specific bag
        let mut apigw = Map::new();
        if let Some(rid) = &request.request_context.request_id {
            if !rid.is_empty() {
                apigw.insert("requestId".into(), Value::String(rid.clone()));
            }
        }
        if let Some(stage) = &request.request_context.stage {
            apigw.insert("stage".into(), Value::String(stage.clone()));
        }
        if let Some(api_id) = &request.request_context.apiid {
            if !api_id.is_empty() {
                apigw.insert("apiId".into(), Value::String(api_id.clone()));
            }
        }

        let mut root = Map::new();
        if !http_request.is_empty() {
            let mut http = Map::new();
            http.insert("request".into(), Value::Object(http_request));
            root.insert("http".into(), Value::Object(http));
        }
        if !apigw.is_empty() {
            root.insert("apiGateway".into(), Value::Object(apigw));
        }
        if !root.is_empty() {
            add_base_context(&Value::Object(root));
        }

        if let Some(rid) = &request.request_context.request_id {
            if !rid.is_empty() {
                self.set_correlation_id(rid);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::context::reset_global_context;
    use crate::logger::Logger;
    #[test]
    fn add_ecs_context_picks_up_env_vars() {
        let _guard = crate::TEST_GLOBAL_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_global_context();
        // SAFETY: protected by ENV_LOCK above.
        unsafe {
            std::env::set_var("ECS_CONTAINER_METADATA_URI_V4", "http://169.254.170.2/v4/abc");
            std::env::set_var("AWS_EXECUTION_ENV", "AWS_ECS_FARGATE");
            std::env::set_var("AWS_REGION", "us-east-1");
        }

        let logger = Logger::default();
        logger.add_ecs_context();
        let ctx = logger.context();
        let ecs = ctx
            .as_object()
            .and_then(|m| m.get("ecs"))
            .and_then(|v| v.as_object())
            .expect("ecs context not set");
        assert_eq!(ecs.get("containerMetadataUriV4").unwrap(), "http://169.254.170.2/v4/abc");
        assert_eq!(ecs.get("executionEnv").unwrap(), "AWS_ECS_FARGATE");
        assert_eq!(ecs.get("region").unwrap(), "us-east-1");

        // SAFETY: protected by ENV_LOCK above.
        unsafe {
            std::env::remove_var("ECS_CONTAINER_METADATA_URI_V4");
            std::env::remove_var("AWS_EXECUTION_ENV");
            std::env::remove_var("AWS_REGION");
        }
    }

    #[test]
    fn add_lambda_environment_context_reads_env() {
        let _guard = crate::TEST_GLOBAL_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        reset_global_context();
        // SAFETY: protected by ENV_LOCK above.
        unsafe {
            std::env::set_var("AWS_LAMBDA_FUNCTION_NAME", "test-fn");
            std::env::set_var("AWS_LAMBDA_FUNCTION_VERSION", "$LATEST");
            std::env::set_var("AWS_LAMBDA_LOG_GROUP_NAME", "/aws/lambda/test-fn");
            std::env::set_var("AWS_REGION", "us-west-2");
        }

        let logger = Logger::default();
        logger.add_lambda_environment_context();
        let ctx = logger.context();
        let lambda = ctx
            .as_object()
            .and_then(|m| m.get("lambda"))
            .and_then(|v| v.as_object())
            .expect("lambda context not set");
        assert_eq!(lambda.get("functionName").unwrap(), "test-fn");
        assert_eq!(lambda.get("functionVersion").unwrap(), "$LATEST");
        assert_eq!(lambda.get("logGroupName").unwrap(), "/aws/lambda/test-fn");
        assert_eq!(ctx.as_object().unwrap().get("region").unwrap(), "us-west-2");

        // SAFETY: protected by ENV_LOCK above.
        unsafe {
            std::env::remove_var("AWS_LAMBDA_FUNCTION_NAME");
            std::env::remove_var("AWS_LAMBDA_FUNCTION_VERSION");
            std::env::remove_var("AWS_LAMBDA_LOG_GROUP_NAME");
            std::env::remove_var("AWS_REGION");
        }
    }
}
