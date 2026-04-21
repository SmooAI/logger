---
"@smooai/logger": minor
---

**Add top-level `browser` export condition + bare `./browser` entry**

`@smooai/logger` already shipped a browser-safe build under `./browser` (exposing `BrowserLogger`, a browser-native `Logger`, and a full `index`), but the top-level `.` entry had no `browser` condition. Browser bundlers therefore resolved `import { Logger } from '@smooai/logger'` to the Node entry, pulling `rotating-file-stream`, `node:fs`, and related Node-only dependencies into the bundle.

Adding the `browser` condition on `.` means consumers can now do:

```ts
import { Logger } from "@smooai/logger";
```

…and the bundler automatically picks the browser-safe dist when building for a browser target. No aliasing or explicit `/browser` subpath import required.

Also added a bare `./browser` entry (in addition to the existing `./browser/*` subpath pattern) so `import X from '@smooai/logger/browser'` resolves to `dist/browser/index.*` without needing the explicit `/index` suffix.
