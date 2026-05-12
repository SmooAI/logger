---
"@smooai/logger": patch
---

Fix `ReferenceError: Cannot access '__filename' before initialization` (TDZ) when `AwsServerLogger` is loaded under tsx CJS interop. The old code destructured `import.meta.url` into locals named `__dirname` / `__filename` — when bundlers compile this to CJS they rewrite `import.meta.url` to a shim that reads the module-scope `__filename`, and a same-named `const` on the LHS creates a TDZ for that reference. Use a differently-named holder (`esmPaths`) so the compiled CJS doesn't self-reference a not-yet-initialized binding. This bit any tsx-run script that transitively imported `@smooai/fetch` → `@smooai/logger` (SMOODEV-908 inspect-runs, SMOODEV-918 ghl-import).
