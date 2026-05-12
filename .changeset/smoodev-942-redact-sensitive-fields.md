---
"@smooai/logger": patch
---

SMOODEV-942: Add sensitive-field redaction across all 5 ports (TS, Python, Rust, Go, .NET). Logger now redacts a default set of auth-bearing HTTP headers (`Authorization`, `Cookie`, `Set-Cookie`, `X-Api-Key`, `x-amz-security-token`, `proxy-authorization`) and credential-shaped field names (`password`, `passwd`, `secret`, `apiKey`, `api_key`, `token`, `access_token`, `refresh_token`, `client_secret`) before logs are emitted — replacing values with `"[REDACTED]"`. Matching is case-insensitive. Each port exposes `addRedactKeys()` / `AddRedactKeys()` / `add_redact_keys()` to extend the list, plus a constructor option to override the defaults entirely (pass an empty list to disable). Previously every port logged HTTP request headers and request bodies as-is, leaking Bearer tokens and cookies into CloudWatch / log shipping pipelines.
