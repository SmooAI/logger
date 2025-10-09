#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const platform = process.platform;
const arch = process.arch;
const binaryName = platform === 'win32' ? 'smooai-log-viewer.exe' : 'smooai-log-viewer';
const binaryPath = resolve(__dirname, '..', 'log-viewer', `${platform}-${arch}`, binaryName);

if (!existsSync(binaryPath)) {
    console.error(`[smooai-log-viewer] No binary found for ${platform}/${arch}. Expected to find:`, `\n  ${binaryPath}`);
    console.error('[smooai-log-viewer] Ensure Rust is installed and run "pnpm run log-viewer:bundle" to build the desktop viewer.');
    process.exit(1);
}

const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
});

child.on('exit', (code, signal) => {
    if (typeof code === 'number') {
        process.exit(code);
    }

    if (signal) {
        process.kill(process.pid, signal);
    } else {
        process.exit(0);
    }
});

child.on('error', (error) => {
    console.error('[smooai-log-viewer] Failed to launch the log viewer binary.');
    console.error(error);
    process.exit(1);
});
