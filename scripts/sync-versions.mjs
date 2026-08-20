#!/usr/bin/env node
/**
 * Rewrite every non-npm manifest to match `package.json`'s version.
 *
 * Runs from the changesets `version` lifecycle (`pnpm run version`), NOT from
 * `ci:publish`. The changesets action commits the working tree after `version`,
 * so the synced manifests land in the release commit. Running it after publish
 * — as this repo did until now — mutated manifests that were never committed,
 * which is why every git tag shipped stale version constants and why
 * `cargo publish` needed `--allow-dirty`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { GO_MOD, VERSIONED_FILES, goModulePathFor, writeVersion } from "./versioned-files.mjs";

const root = process.cwd();

const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const version = pkg.version;

if (!version) {
  console.error("Unable to read version from package.json");
  process.exit(1);
}

let touched = 0;

for (const file of VERSIONED_FILES) {
  const absolutePath = resolve(root, file.path);
  const content = readFileSync(absolutePath, "utf8");
  const next = writeVersion(file, content, version);
  if (next !== content) {
    writeFileSync(absolutePath, next);
    touched += 1;
    console.log(`Updated version in ${file.path} -> ${version}`);
  }
}

const goModPath = resolve(root, GO_MOD.path);
const goMod = readFileSync(goModPath, "utf8");
const expectedModule = goModulePathFor(version);
const nextGoMod = goMod.replace(GO_MOD.pattern, `$1${expectedModule}`);
if (nextGoMod !== goMod) {
  writeFileSync(goModPath, nextGoMod);
  touched += 1;
  console.log(`Updated module path in ${GO_MOD.path} -> ${expectedModule}`);
  console.warn(
    "NOTE: a Go major bump also requires updating every `github.com/SmooAI/logger/go/...` import " +
      "in READMEs and any consumer. This repo's Go package is flat and imports nothing of its own.",
  );
}

console.log(
  touched === 0 ? "sync-versions: already in sync" : `sync-versions: ${touched} file(s) updated`,
);
