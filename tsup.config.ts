import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
    entry: ['src/index.ts', 'src/env.ts', 'src/Logger.ts', 'src/BrowserLogger.ts', 'src/AwsLambdaLogger.ts', 'src/scripts/createEntryPoints.ts'],
    clean: true,
    dts: true,
    format: ['cjs'],
    sourcemap: true,
    target: 'es2022',
    treeShaking: true,
    ...options,
}));
