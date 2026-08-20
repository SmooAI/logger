#!/usr/bin/env node
/**
 * Guard: every version-bearing manifest must equal `package.json`'s version.
 *
 * Fails, never warns. Before this existed the repo shipped package.json 4.3.0
 * alongside python 3.2.3, rust 3.1.2, go 3.2.3 and dotnet 4.1.0 — every consumer
 * of a non-npm port was reading a version constant from a different release.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { GO_MOD, VERSIONED_FILES, goModulePathFor, readVersion } from "./versioned-files.mjs";

/**
 * @param {(path: string) => string} read reads a repo-relative path
 * @param {string} packageVersion
 * @returns {string[]} human-readable failures; empty means the guard passes
 */
export function checkVersions(read, packageVersion) {
  const errors = [];

  for (const file of VERSIONED_FILES) {
    let found;
    try {
      found = readVersion(file, read(file.path));
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (found !== packageVersion) {
      errors.push(`${file.path} is at ${found}, expected ${packageVersion} (package.json)`);
    }
  }

  const goMod = read(GO_MOD.path);
  const moduleMatch = goMod.match(GO_MOD.pattern);
  if (!moduleMatch) {
    errors.push(`${GO_MOD.path} has no \`module\` directive`);
  } else {
    const expected = goModulePathFor(packageVersion);
    if (moduleMatch[2] !== expected) {
      errors.push(
        `${GO_MOD.path} declares \`module ${moduleMatch[2]}\` but package.json is at ` +
          `${packageVersion}, so the release mints tag \`go/v${packageVersion}\`, which Go ` +
          `resolves only for \`${expected}\``,
      );
    }
  }

  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const { version } = JSON.parse(read("package.json"));

  const errors = checkVersions(read, version);
  if (errors.length > 0) {
    console.error(`check-versions: FAILED — manifests disagree with package.json (${version})`);
    for (const error of errors) console.error(`  - ${error}`);
    console.error("\nRun `pnpm version:sync` and commit the result.");
    process.exit(1);
  }
  console.log(`check-versions: OK (all manifests at ${version})`);
}
