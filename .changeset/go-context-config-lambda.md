---
"@smooai/logger": minor
---

Add context config filtering, Lambda adapter, and caller tracking to Go logger

- Port ContextConfig system from Rust (AllowAll/Deny/OnlyKeys/Nested recursive filtering)
- Add PresetConfigMinimal and PresetConfigFull presets
- Add CallerInfo with runtime.Caller for file/line/function tracking
- Add LambdaLogger with AWS Lambda context, SQS, and API Gateway integration
- Add error cause chain walking via errors.Unwrap in ErrorDetail
