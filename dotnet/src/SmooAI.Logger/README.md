# SmooAI.Logger

Structured, contextual logger for AWS and .NET server environments. .NET port of `@smooai/logger`.

Captures execution context (correlation IDs, HTTP request/response, user, telemetry) and emits JSON lines wire-compatible with the TypeScript, Go, Rust, and Python ports.

## Install

```bash
dotnet add package SmooAI.Logger
```

## Quick start

```csharp
using SmooAI.Logger;

var logger = SmooLogger.Create<MyService>(opts =>
{
    opts.InitialContext = new Dictionary<string, object?>
    {
        ["service"] = "api",
        ["stage"] = "production",
    };
});

logger.LogInfo("Order placed", new { orderId = "ord_123", userId = "u_456" });

using (logger.BeginScope(new Dictionary<string, object?> { ["requestId"] = "req_789" }))
{
    logger.LogWarning("Retrying upstream call");
}
```

## Forwarding to `Microsoft.Extensions.Logging`

Wire the SmooLogger to an upstream `ILogger` (e.g. Serilog, AWS.Logger) — the structured entry is forwarded as a scope so downstream sinks receive every field.

```csharp
var factory = LoggerFactory.Create(b => b.AddSerilog());
var smoo = new SmooLogger(new SmooLoggerOptions
{
    Name = "api",
    ForwardTo = factory.CreateLogger("SmooAI.Logger"),
});
```

## Environment

- `LOG_LEVEL` — `trace` | `debug` | `info` | `warn` | `error` | `fatal` (default `info`)
- `IS_LOCAL`, `SST_DEV`, `GITHUB_ACTIONS` — enable pretty-print mode by default

## License

MIT
