---
"@smooai/logger": patch
---

SMOODEV-966: Add `RotatingFileOutput` to the .NET port — size-based rollover, gzip-compressed archives, configurable retention (`MaxArchivedFiles`), and a configurable filename pattern. Wired into `SmooLogger` via `SmooLoggerOptions.Rotation`, mirroring the TS `RotationOptions` and Rust `rotation.rs` surfaces.
