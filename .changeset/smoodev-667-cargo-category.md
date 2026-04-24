---
'@smooai/logger': patch
---

SMOODEV-667: Drop invalid `logging` crates.io category slug that was aborting the release pipeline before it could reach the NuGet publish step. crates.io only accepts categories from its fixed list (`development-tools::debugging` stays). This unblocks `SmooAI.Logger` NuGet publishes for the first time since the .NET port landed — NuGet was stuck on the 0.1.0 placeholder while npm had advanced to 4.1.2.
