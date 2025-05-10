import { defineConfig, type Options } from 'tsup';

const coreConfig: Options = {
    entry: ['src/index.ts', 'src/env.ts', 'src/Logger.ts', 'src/AwsLambdaLogger.ts'],
    clean: true,
    dts: true,
    format: ['cjs', 'esm'],
    sourcemap: true,
    target: 'es2022',
};

const browserConfig: Options = {
    ...coreConfig,
    entry: ['src/BrowserLogger.ts'],
    platform: 'browser',
};

export default defineConfig([coreConfig, browserConfig]);
