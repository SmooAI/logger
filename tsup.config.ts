import { defineConfig, type Options } from 'tsup';

const coreConfig: Options = {
    entry: ['src/index.ts', 'src/env.ts', 'src/Logger.ts', 'src/AwsServerLogger.ts', 'src/BrowserLogger.ts'],
    clean: true,
    dts: true,
    format: ['cjs', 'esm'],
    sourcemap: true,
    target: 'es2022',
    treeshake: true,
};

const browserConfig: Options = {
    ...coreConfig,
    entry: ['src/BrowserLogger.ts'],
    platform: 'browser',
    dts: true,
};

export default defineConfig([coreConfig, browserConfig]);
