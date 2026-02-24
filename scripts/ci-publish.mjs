#!/usr/bin/env node
/**
 * CI publish script that handles idempotent npm publishing.
 *
 * Runs the build, attempts changeset publish (which publishes to npm),
 * and gracefully handles the case where the version already exists on npm.
 * Then syncs versions to other language packages.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

function runSafe(cmd, opts = {}) {
  try {
    run(cmd, opts);
    return true;
  } catch {
    return false;
  }
}

// Step 1: Build
run("pnpm build");

// Step 2: Attempt changeset publish (npm)
// If the version already exists on npm, changeset publish will fail.
// We check for this case and proceed gracefully.
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const { name, version } = pkg;

let npmPublished = false;
try {
  // Check if this version already exists on npm
  const existing = execSync(`npm view ${name}@${version} version 2>/dev/null`, {
    encoding: "utf8",
    cwd: root,
  }).trim();

  if (existing === version) {
    console.log(`\n${name}@${version} already exists on npm, skipping publish.`);
    npmPublished = true;
  }
} catch {
  // Version doesn't exist yet, proceed with publish
}

if (!npmPublished) {
  if (!runSafe("pnpm changeset publish")) {
    // Check again if it was a "version already exists" error
    try {
      const existing = execSync(`npm view ${name}@${version} version 2>/dev/null`, {
        encoding: "utf8",
        cwd: root,
      }).trim();

      if (existing === version) {
        console.log(
          `\n${name}@${version} was published concurrently or already exists. Continuing.`,
        );
      } else {
        console.error("\nchangeset publish failed for an unknown reason.");
        process.exit(1);
      }
    } catch {
      console.error("\nchangeset publish failed and version is not on npm.");
      process.exit(1);
    }
  }
}

// Step 3: Sync versions to other language packages
run("pnpm version:sync");
