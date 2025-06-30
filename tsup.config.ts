import path from 'path';
import alias from 'esbuild-plugin-alias';
import { defineConfig, type Options } from 'tsup';

const coreConfig: Options = {
    entry: ['src/index.ts', 'src/env.ts', 'src/Logger.ts', 'src/AwsServerLogger.ts'],
    clean: true,
    dts: true,
    format: ['cjs', 'esm'],
    sourcemap: true,
    target: 'es2022',
    treeshake: true,
} satisfies Options;

const browserConfig: Options = {
    ...coreConfig,
    outDir: 'dist/browser',
    entry: ['src/index.ts', 'src/env.ts', 'src/Logger.ts', 'src/BrowserLogger.ts'],
    platform: 'browser',
    dts: true,
    noExternal: ['rotating-file-stream'],
    esbuildPlugins: [
        alias({
            // any import of "rotating-file-stream" → your stub
            'rotating-file-stream': path.resolve(__dirname, 'src/utils/rotating-file-stream.stub.ts'),
        }),
    ],
} satisfies Options;

export default defineConfig([coreConfig, browserConfig]);
