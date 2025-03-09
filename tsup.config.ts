import { defineConfig, type Options } from 'tsup';

export default defineConfig((options: Options) => ({
    entry: ['src/index.ts', 'src/env.ts', 'src/Logger.ts', 'src/BrowserLogger.ts', 'src/AwsLambdaLogger.ts', 'src/scripts/createEntryPoints.ts'],
    clean: true,
    dts: false, // Turned off due to issues with @supabase/supabase-js/lib/types because of tyepof fetch and an error about it being private.
    format: ['cjs'],
    sourcemap: true,
    target: 'es2022',
    treeShaking: true,
    ...options,
}));
