---
"@smooai/logger": patch
---

SMOODEV-944: .NET port — implement `AwsServerLogger` with Lambda / SQS / API Gateway / ECS context helpers. New `SmooAI.Logger.AwsServerLogger` (extends `SmooLogger`) adds `AddLambdaContext(ILambdaContext)`, `AddLambdaEnvironmentContext()`, `AddSqsRecordContext(SQSEvent.SQSMessage)`, `AddApiGatewayContext(APIGatewayProxyRequest)`, and `AddECSContext()`. Mirrors the TS `AwsServerLogger`, Python `AwsServerLogger`, and Go `LambdaLogger` surfaces. NuGet deps added to `SmooAI.Logger`: `Amazon.Lambda.Core`, `Amazon.Lambda.SQSEvents`, `Amazon.Lambda.APIGatewayEvents` — small, version-stable interface packages every .NET Lambda project pulls in anyway. File rotation parity (TS `RotationOptions`) is intentionally deferred to a follow-up; the AWS context surface is the bigger gap.
