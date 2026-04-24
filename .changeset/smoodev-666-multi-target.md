---
'@smooai/logger': patch
---

SMOODEV-666: Multi-target the SmooAI.Logger NuGet package to `net8.0;net9.0;net10.0` so consumers on every current .NET LTS + STS release get a native framework match in the `lib/` folder. Microsoft.Extensions.Logging.Abstractions 8.0.2 resolves cleanly on all three — no per-TFM conditionals needed.
