---
"@smooai/logger": patch
---

SMOODEV-945: Go port — add `LambdaLogger.AddECSContext()` for Fargate/ECS parity with Python. Reads the standard ECS-on-Fargate / Amazon-ECS-Agent env vars (`ECS_CONTAINER_METADATA_URI_V4`, `AWS_EXECUTION_ENV`, `AWS_REGION`, etc.) and attaches them under an `ecs` key in the logger context. Previously the Go port had Lambda / SQS / API Gateway / LambdaEnvironment context helpers but no ECS counterpart.
