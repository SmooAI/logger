---
"@smooai/logger": patch
---

**Drop deprecated `baseUrl` from tsconfig**

The previous attempt used `ignoreDeprecations: "5.0"` which works locally but CI expects `"6.0"` (depends on exact patch version of TypeScript). Nothing in the codebase relies on baseUrl (no `paths`, no imports start with `./src/...` from a module root), so the cleaner fix is to just remove it. This unblocks the Release workflow which has been red since TypeScript began flagging the deprecation.
