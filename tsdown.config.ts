import path from "path";
import { fileURLToPath } from "url";
import alias from "@rollup/plugin-alias";
import { defineConfig, type Options } from "tsdown";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const coreConfig: Options = {
  entry: ["src/index.ts", "src/env.ts", "src/Logger.ts", "src/AwsServerLogger.ts"],
  clean: true,
  dts: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  target: "es2022",
  treeshake: true,
  // `src/decycle.cjs` patches global JSON for side effects and is shipped
  // as-is via `cp src/decycle.cjs dist/` post-build. Mark it external so
  // rolldown doesn't try to parse the CJS file as ESM.
  external: [/decycle\.cjs$/],
} satisfies Options;

const browserConfig: Options = {
  ...coreConfig,
  clean: false,
  outDir: "dist/browser",
  entry: ["src/index.ts", "src/env.ts", "src/Logger.ts", "src/BrowserLogger.ts"],
  platform: "browser",
  fixedExtension: true,
  dts: true,
  // `rotating-file-stream` is Node-only — alias to a no-op stub for the browser build
  deps: {
    alwaysBundle: ["rotating-file-stream"],
  },
  plugins: [
    alias({
      entries: [
        {
          find: "rotating-file-stream",
          replacement: path.resolve(__dirname, "src/utils/rotating-file-stream.stub.ts"),
        },
      ],
    }),
  ],
} satisfies Options;

const cliConfig: Options = {
  entry: ["src/cli/log-viewer.ts"],
  outDir: "dist/cli",
  clean: false,
  format: ["cjs"],
  platform: "node",
  target: "node18",
  sourcemap: false,
  dts: false,
  treeshake: false,
  shims: false,
} satisfies Options;

export default defineConfig([coreConfig, browserConfig, cliConfig]);
