---
'@smooai/logger': major
---

Changed how browser was exported so it's in @smooai/logger/browser.

Prior BrowserLogger was at @smooai/logger/BrowserLogger.

This seemed to lead to some issues when building downstream where node based utilities would get picked up from this package when building in browser land.
