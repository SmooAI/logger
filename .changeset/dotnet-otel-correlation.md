---
'@smooai/logger': patch
---

.NET: log records now carry the active OTel span's real W3C `traceId`/`spanId`
via `Activity.Current`, falling back to the correlation uuid when no valid
activity is in scope.

The version bump for the .NET package is driven from `package.json` by
`scripts/sync-versions.mjs`, so this file exists to make sure the release
CHANGELOG actually mentions the change — without it the NuGet package still
republishes (any changeset in the release triggers every language), just with no
record of what changed.
