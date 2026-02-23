#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const GITHUB_REPO = "SmooAI/logger";
const root = process.cwd();

const binaryName = process.platform === "win32" ? "smooai-log-viewer.exe" : "smooai-log-viewer";
const destinationDir = resolve(root, "dist", "log-viewer", `${process.platform}-${process.arch}`);
mkdirSync(destinationDir, { recursive: true });
const destinationBinary = resolve(destinationDir, binaryName);

// Try to download pre-built binary first
const downloaded = await tryDownload();
if (downloaded) {
  console.log(`bundle-log-viewer: downloaded pre-built binary to ${destinationBinary}`);
  process.exit(0);
}

// Fall back to cargo build
const manifestPath = resolve(root, "log-viewer", "Cargo.toml");

if (!existsSync(manifestPath)) {
  console.warn("bundle-log-viewer: manifest not found and no pre-built binary available, skipping");
  process.exit(0);
}

const cargoCheck = spawnSync("cargo", ["--version"], { stdio: "ignore" });
if (cargoCheck.status !== 0) {
  console.warn("bundle-log-viewer: cargo not detected and no pre-built binary available, skipping");
  process.exit(0);
}

console.log("bundle-log-viewer: no pre-built binary found, building from source...");
const build = spawnSync("cargo", ["build", "--release", "--manifest-path", manifestPath], {
  stdio: "inherit",
  cwd: root,
});

if (build.status !== 0) {
  console.error("bundle-log-viewer: cargo build failed");
  process.exit(build.status ?? 1);
}

const sourceBinary = resolve(root, "log-viewer", "target", "release", binaryName);

if (!existsSync(sourceBinary)) {
  console.error(`bundle-log-viewer: expected binary at ${sourceBinary} but none was found`);
  process.exit(1);
}

copyFileSync(sourceBinary, destinationBinary);
if (process.platform !== "win32") {
  chmodSync(destinationBinary, 0o755);
}

console.log(`bundle-log-viewer: built and packaged ${destinationBinary}`);

async function tryDownload() {
  try {
    const ext = process.platform === "win32" ? ".exe" : "";
    const assetName = `smooai-log-viewer-${process.platform}-${process.arch}${ext}`;
    const url = `https://github.com/${GITHUB_REPO}/releases/latest/download/${assetName}`;

    console.log(`bundle-log-viewer: attempting to download pre-built binary from ${url}`);
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) {
      console.log(
        `bundle-log-viewer: download returned ${response.status}, falling back to cargo build`,
      );
      return false;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destinationBinary, buffer);
    if (process.platform !== "win32") {
      chmodSync(destinationBinary, 0o755);
    }
    return true;
  } catch (error) {
    console.log(
      `bundle-log-viewer: download failed (${error.message}), falling back to cargo build`,
    );
    return false;
  }
}
