---
"@smooai/logger": patch
---

**Silence TS5101 deprecation warning for `baseUrl` in tsconfig**

TypeScript 5.0+ flags the `baseUrl` compiler option as deprecated (to be removed in TS 7.0). The repo's `tsconfig.json` still uses `baseUrl: "./"`; recent Release workflow runs failed during typecheck with:

```
tsconfig.json: error TS5101: Option 'baseUrl' is deprecated
```

Adds `"ignoreDeprecations": "5.0"` to quiet the warning until we do a wider tsconfig modernisation. No behavioural change.
