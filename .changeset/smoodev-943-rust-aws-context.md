---
"@smooai/logger": patch
---

SMOODEV-943: Rust port — implement AWS Lambda/SQS/API Gateway/ECS context helpers. Adds a new `aws` module with an `AwsContextLogger` trait that mirrors the Go `LambdaLogger` and Python `AwsServerLogger` surfaces — `add_lambda_context`, `add_lambda_environment_context`, `add_sqs_record_context`, `add_api_gateway_context`, `add_ecs_context`. Lambda/SQS/API Gateway methods are gated behind an opt-in `aws-lambda` cargo feature (which pulls in `lambda_runtime` and `aws_lambda_events`) so consumers that don't need the AWS bindings aren't forced to compile them. ECS context (`add_ecs_context`, `ecs_environment_context`) is env-var-only and always available. Previously `rust/logger/src/lib.rs` only exposed the base `Logger` — the README marketed Lambda + SQS + API Gateway support but the implementation was missing.
