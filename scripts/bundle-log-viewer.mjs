#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();
const manifestPath = resolve(root, 'log-viewer', 'Cargo.toml');

if (!existsSync(manifestPath)) {
    console.warn('bundle-log-viewer: manifest not found, skipping build');
    process.exit(0);
}

const cargoCheck = spawnSync('cargo', ['--version'], { stdio: 'ignore' });
if (cargoCheck.status !== 0) {
    console.warn('bundle-log-viewer: cargo not detected on PATH, skipping build');
    process.exit(0);
}

const build = spawnSync('cargo', ['build', '--release', '--manifest-path', manifestPath], {
    stdio: 'inherit',
    cwd: root,
});

if (build.status !== 0) {
    console.error('bundle-log-viewer: cargo build failed');
    process.exit(build.status ?? 1);
}

const binaryName = process.platform === 'win32' ? 'smooai-log-viewer.exe' : 'smooai-log-viewer';
const sourceBinary = resolve(root, 'log-viewer', 'target', 'release', binaryName);

if (!existsSync(sourceBinary)) {
    console.error(`bundle-log-viewer: expected binary at ${sourceBinary} but none was found`);
    process.exit(1);
}

const destinationDir = resolve(root, 'dist', 'log-viewer', `${process.platform}-${process.arch}`);
mkdirSync(destinationDir, { recursive: true });

const destinationBinary = resolve(destinationDir, binaryName);
copyFileSync(sourceBinary, destinationBinary);
if (process.platform !== 'win32') {
    chmodSync(destinationBinary, 0o755);
}

console.log(`bundle-log-viewer: packaged ${destinationBinary}`);
