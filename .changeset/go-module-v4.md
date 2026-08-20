---
"@smooai/logger": patch
---

Fix the Go module path so the Go port is installable again.

`go/go.mod` declared `module github.com/SmooAI/logger/go/v3`, but every Go tag this repo has
ever pushed is `go/v4.x` (`go/v4.1.3` … `go/v4.3.0`) — no `go/v3.*` tag has ever existed. Go
resolves a `go/vN.x` tag only for a module path ending in `/vN`, so
`go get github.com/SmooAI/logger/go/v3@v4.3.0` resolved nothing and the only thing that worked
was a `main` pseudo-version. The Go port has been un-`go get`-able at a real version since v4.0.0.

The module path is now `github.com/SmooAI/logger/go/v4`, matching the tags. A new
`check:go-module` guard asserts the `/vN` suffix equals `package.json`'s major and **fails** on
mismatch; it runs in PR checks and again inside the release tagging step, after changesets has
bumped the version — the only point where the version that becomes the tag can be compared to
the module path.
