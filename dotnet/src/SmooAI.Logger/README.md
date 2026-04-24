# SmooAI.Logger

[![NuGet](https://img.shields.io/nuget/v/SmooAI.Logger.svg)](https://www.nuget.org/packages/SmooAI.Logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Structured logs for .NET that carry the full story — correlation IDs, request + response, user, and caller location on every line.**

.NET port of [`@smooai/logger`](https://github.com/SmooAI/logger). Drop it into a Lambda, ECS service, or worker and every log entry tells you *where* it fired, *who* triggered it, and *which request* it belonged to — without threading context through every method. JSON lines that land in CloudWatch, Datadog, or any `ILogger` sink, and wire-compatible with the TypeScript, Python, Go, and Rust ports.

## Install

```bash
dotnet add package SmooAI.Logger
```

## What you get

- **Correlation across services** — a single `correlationId` flows through HTTP calls, SQS records, and background tasks so you can grep one ID and see the whole request.
- **Typed user + request + response fields** — no more stringly-typed `["user_id"] = user.Id`. Push a `User`, `HttpRequest`, or `HttpResponse` and the logger serializes every relevant field.
- **Exact caller location** — every line carries file + method + line number. No more hunting for which service logged what.
- **Structured by default** — strict JSON lines in production, ANSI pretty-print locally.
- **Wire-compatible with every other SmooAI.Logger port** — the schema is the same in TS, Python, Go, and Rust, so distributed traces stitch together across language boundaries.
- **Works with `Microsoft.Extensions.Logging`** — forward to Serilog, AWS.Logger, or any `ILogger` sink without losing structure.

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

## Track a request end-to-end

```csharp
// Correlation IDs thread through your system automatically
log.SetCorrelationId(Request.Headers["X-Correlation-Id"]);
log.SetUser(new User { Id = user.Id, Role = user.Role });
log.SetRequestContext(Request);

try
{
    var order = await CreateOrderAsync(dto);
    log.LogInfo("Order created", new { orderId = order.Id });
    return Ok(order);
}
catch (Exception ex)
{
    // Error logs carry the full context: correlation ID, user, request, stack
    log.LogError("Order creation failed", ex);
    throw;
}
```

## Scopes and correlation

```csharp
using (log.BeginScope(new Dictionary<string, object?> { ["requestId"] = "req_789" }))
{
    log.LogWarning("Retrying upstream call", new { attempt = 2 });
    // every log inside the scope carries requestId=req_789 on top of the base context
}
```

`BeginScope` is thread-safe — concurrent `LogInfo` calls inside the same scope don't step on each other.

## Forwarding to `Microsoft.Extensions.Logging`

Wire the SmooLogger to an upstream `ILogger` (Serilog, AWS.Logger, or whatever your org is standardized on) and every structured field rides through as a scope so downstream sinks still see the full story.

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
- [`smooai-logger`](https://pypi.org/project/smooai-logger/) — Python
- [`smooai-logger`](https://crates.io/crates/smooai-logger) — Rust
- [`github.com/SmooAI/logger/go`](https://github.com/SmooAI/logger/tree/main/go) — Go

## License

MIT — © SmooAI
