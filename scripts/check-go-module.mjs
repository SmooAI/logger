#!/usr/bin/env node
/**
 * Guard: the `/vN` major suffix on the Go module path must match the major of
 * `package.json`'s version, because release.yml mints the Go tag as
 * `go/v${package.json version}`.
 *
 * This is the check whose absence let `module github.com/SmooAI/logger/go/v3`
 * sit in the repo while every tag was `go/v4.x` — no v3 tag has ever existed,
 * so `go get` could not resolve a single tagged release from v4.0.0 onward.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const MODULE_BASE = "github.com/SmooAI/logger/go";

/**
 * @param {string} goModContent contents of go/go.mod
 * @param {string} packageVersion the version field from package.json
 * @returns {string[]} human-readable failures; empty means the guard passes
 */
export function checkGoModuleMajor(goModContent, packageVersion) {
  const errors = [];

  const moduleMatch = goModContent.match(/^module\s+(\S+)/m);
  if (!moduleMatch) {
    return [`go/go.mod has no \`module\` directive`];
  }
  const modulePath = moduleMatch[1];

  const majorMatch = packageVersion.match(/^(\d+)\./);
  if (!majorMatch) {
    return [`package.json version "${packageVersion}" is not a semver version`];
  }
  const major = Number(majorMatch[1]);

  // Go only requires (and only allows) a /vN suffix for major >= 2.
  const expected = major >= 2 ? `${MODULE_BASE}/v${major}` : MODULE_BASE;

  if (modulePath !== expected) {
    errors.push(
      `go/go.mod declares \`module ${modulePath}\` but package.json is at ${packageVersion}, ` +
        `so release.yml will mint the tag \`go/v${packageVersion}\`. ` +
        `Go resolves \`go/vN.x\` tags only for a module path ending in \`/v${major}\`, ` +
        `so that tag would resolve nothing. Expected \`module ${expected}\`.`,
    );
  }

  return errors;
}

// ponytail: no CLI arg parsing — the two paths are fixed by the repo layout.
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const goMod = readFileSync(resolve(root, "go", "go.mod"), "utf8");

  const errors = checkGoModuleMajor(goMod, pkg.version);
  if (errors.length > 0) {
    console.error("check-go-module: FAILED");
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log(`check-go-module: OK (package.json ${pkg.version} matches the Go module path)`);
}
