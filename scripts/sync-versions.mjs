#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = process.cwd();

const packageJsonPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
const version = pkg.version;

if (!version) {
    console.error('Unable to read version from package.json');
    process.exit(1);
}

const updates = [
    {
        path: 'python/pyproject.toml',
        apply(content) {
            const pattern = /^(version\s*=\s*")([^\"]+)(")/m;
            if (!pattern.test(content)) {
                throw new Error('Version line not found in python/pyproject.toml');
            }
            return content.replace(pattern, `$1${version}$3`);
        },
    },
    {
        path: 'rust/logger/Cargo.toml',
        apply(content) {
            const pattern = /^(version\s*=\s*")([^\"]+)(")/m;
            if (!pattern.test(content)) {
                throw new Error('Version line not found in rust/logger/Cargo.toml');
            }
            return content.replace(pattern, `$1${version}$3`);
        },
    },
    {
        path: 'rust/logger/Cargo.lock',
        apply(content) {
            const pattern = /(name\s*=\s*"smooai-logger"\s*\nversion\s*=\s*")([^\"]+)(")/;
            if (!pattern.test(content)) {
                throw new Error('Version block not found in rust/logger/Cargo.lock');
            }
            return content.replace(pattern, `$1${version}$3`);
        },
    },
    {
        path: 'log-viewer/Cargo.toml',
        apply(content) {
            const pattern = /^(version\s*=\s*")([^\"]+)(")/m;
            if (!pattern.test(content)) {
                throw new Error('Version line not found in log-viewer/Cargo.toml');
            }
            return content.replace(pattern, `$1${version}$3`);
        },
    },
    {
        path: 'log-viewer/Cargo.lock',
        apply(content) {
            const pattern = /(name\s*=\s*"smooai-log-viewer"\s*\nversion\s*=\s*")([^\"]+)(")/;
            if (!pattern.test(content)) {
                throw new Error('Version block not found in log-viewer/Cargo.lock');
            }
            return content.replace(pattern, `$1${version}$3`);
        },
    },
];

let touched = 0;

for (const { path, apply } of updates) {
    const absolutePath = resolve(root, path);
    let content;
    try {
        content = readFileSync(absolutePath, 'utf8');
    } catch (error) {
        if (error && error.code === 'ENOENT') {
            console.warn(`Skipping ${path} (not found)`);
            continue;
        }
        throw error;
    }
    const next = apply(content);
    if (next !== content) {
        writeFileSync(absolutePath, next);
        touched += 1;
        console.log(`Updated version in ${path}`);
    }
}

if (touched === 0) {
    console.warn('No files were updated by sync-versions.');
}
