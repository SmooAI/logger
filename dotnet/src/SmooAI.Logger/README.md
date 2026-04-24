# SmooAI.Logger

**Structured, contextual logging for .NET — correlation IDs, typed request/user context, and JSON-line output that plays nicely with CloudWatch, Datadog, and anything that reads JSON.**

.NET port of [`@smooai/logger`](https://github.com/SmooAI/logger). Wire-compatible with the TypeScript, Python, Go, and Rust ports — the same JSON shape, the same fields, the same correlation semantics. Wraps `Microsoft.Extensions.Logging.ILogger` so existing sinks (Serilog, AWS.Logger, `ConsoleLoggerProvider`) receive every structured field.

## Install

```bash
dotnet add package SmooAI.Logger
```

## Quick start

```csharp
using SmooAI.Logger;

var log = new SmooLogger(new SmooLoggerOptions
{
    Name = "api",
    InitialContext = new Dictionary<string, object?>
    {
        ["service"] = "checkout-api",
        ["stage"]   = "production",
    },
});

log.LogInfo("Order placed", new { orderId = "ord_123", userId = "u_456", total = 42.00m });
```

Output (CloudWatch-friendly JSON line):

```json
{
  "level": "info",
  "name": "api",
  "time": "2026-04-23T12:34:56.789Z",
  "correlationId": "6b4e…",
  "requestId": "6b4e…",
  "service": "checkout-api",
  "stage": "production",
  "msg": "Order placed",
  "orderId": "ord_123",
  "userId": "u_456",
  "total": 42.00
}
```

## Why SmooAI.Logger?

`Microsoft.Extensions.Logging` gives you levels and scopes but leaves correlation, request context, user context, and AWS-friendly JSON emission up to you. SmooAI.Logger layers those on:

- **Correlation IDs out of the box** — every logger instance gets a `correlationId` / `requestId` / `traceId` at construction; propagate them across service boundaries without re-plumbing.
- **Typed HTTP + user + AWS context** — `SetRequestContext`, `SetResponseContext`, `SetUser`, `SetLambdaContext` attach strongly-typed metadata that surfaces as first-class fields on every subsequent log line.
- **Scoped context** — `using (log.BeginScope(new { requestId = "req_789" }))` merges context for the block; thread-safe snapshotting means concurrent `LogInfo` calls don't step on each other.
- **Forward to any `ILogger`** — set `ForwardTo = factory.CreateLogger(...)` and your structured entry flows through the rest of your logging pipeline unchanged.
- **Pretty in dev, JSON in prod** — auto-detects `IS_LOCAL` / `SST_DEV` / `GITHUB_ACTIONS`; force with `PrettyPrint = true/false`.

## Scopes and correlation

```csharp
using (log.BeginScope(new Dictionary<string, object?> { ["requestId"] = "req_789" }))
{
    log.LogWarning("Retrying upstream call", new { attempt = 2 });
    // every log inside the scope carries requestId=req_789 on top of the base context
}
```

## Forwarding to Microsoft.Extensions.Logging

```csharp
using Microsoft.Extensions.Logging;

var factory = LoggerFactory.Create(b => b.AddSerilog());
var log = new SmooLogger(new SmooLoggerOptions
{
    Name = "api",
    ForwardTo = factory.CreateLogger("SmooAI.Logger"),
});

log.LogError("Upstream timeout", new Exception("connect timed out"),
    new { upstream = "stripe", timeoutMs = 3000 });
```

The SmooLogger still emits JSON to stdout **and** forwards the structured payload as a scope to Serilog — downstream sinks receive every field as a first-class property, not a string blob.

## Environment

| Variable | Values | Default | Effect |
|----------|--------|---------|--------|
| `LOG_LEVEL` | `trace` `debug` `info` `warn` `error` `fatal` | `info` | Minimum level emitted |
| `IS_LOCAL`, `SST_DEV`, `GITHUB_ACTIONS` | `"true"` | — | Enables pretty-print |

## Related

- [`@smooai/logger`](https://www.npmjs.com/package/@smooai/logger) — TypeScript / Node
- [`smooai-logger`](https://crates.io/crates/smooai-logger) — Rust
- [`smooai-logger`](https://pypi.org/project/smooai-logger/) — Python
- [`github.com/SmooAI/logger/go`](https://github.com/SmooAI/logger/tree/main/go) — Go

## License

MIT — © SmooAI
