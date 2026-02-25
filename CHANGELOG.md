# @smooai/logger

## 4.0.1

### Patch Changes

- 7fe43eb: Upgrade duckdb from 0.9.2 to 1.4 to fix macOS build, replace deprecated macos-13 CI runner with macos-15-intel

## 4.0.0

### Major Changes

- 05cb4d7: Add context config filtering, Lambda adapter, and caller tracking to Go logger
  - Port ContextConfig system from Rust (AllowAll/Deny/OnlyKeys/Nested recursive filtering)
  - Add PresetConfigMinimal and PresetConfigFull presets
  - Add CallerInfo with runtime.Caller for file/line/function tracking
  - Add LambdaLogger with AWS Lambda context, SQS, and API Gateway integration
  - Add error cause chain walking via errors.Unwrap in ErrorDetail

## 3.3.0

### Minor Changes

- 72f29c0: Add context config filtering, Lambda adapter, and caller tracking to Go logger
  - Port ContextConfig system from Rust (AllowAll/Deny/OnlyKeys/Nested recursive filtering)
  - Add PresetConfigMinimal and PresetConfigFull presets
  - Add CallerInfo with runtime.Caller for file/line/function tracking
  - Add LambdaLogger with AWS Lambda context, SQS, and API Gateway integration
  - Add error cause chain walking via errors.Unwrap in ErrorDetail

## 3.2.3

### Patch Changes

- 3758f86: Update README Built With section to include Python, Rust, Go implementations and the Log Viewer desktop application.

## 3.2.2

### Patch Changes

- 2aae163: Fixed publishing versions and added scripts for rust/logger.

## 3.2.1

### Patch Changes

- 4405339: Fixed publishing versions and added scripts for rust/logger.

## 3.2.0

### Minor Changes

- 4f89541: ## Multi-Language Logger Ecosystem

  This release transforms `@smooai/logger` into a comprehensive multi-language logging ecosystem:

  ### 🐍 Python Package (`smooai-logger`)

  - Available on PyPI as `smooai-logger`
  - Full Python implementation with identical API to TypeScript version
  - Synchronized versioning with npm package

  ### 🦀 Rust Crate (`smooai-logger`)

  - Available on crates.io as `smooai-logger`
  - Native Rust logging implementation
  - Synchronized versioning with npm package

  ### 📊 Log Viewer CLI (`smooai-log-viewer`)

  - Interactive GUI application for viewing `.smooai-logs` files
  - Available as CLI command when installing npm package: `smooai-log-viewer`
  - Cross-platform native binaries bundled with package
  - Features filtering, searching, JSON expansion, and context viewing

  ### 🔄 Automated Publishing Pipeline

  - Single changesets release now publishes to npm, PyPI, and crates.io
  - Automatic version synchronization across all packages
  - Enhanced CI/CD workflow for multi-language support

  This creates a unified logging solution across JavaScript/TypeScript, Python, and Rust ecosystems, all with consistent APIs and synchronized versions.

## 3.1.2

### Patch Changes

- ab25cc4: Fixed error handling in context objects so error values are captured and added to error / errorDetails.

## 3.1.1

### Patch Changes

- c421af4: Update @smooai dependencies.

## 3.1.0

### Minor Changes

- 51296f1: Upgrade from zod 3 to zod 4.

## 3.0.8

### Patch Changes

- 37e2c86: Fix response body handling.

## 3.0.7

### Patch Changes

- 9cadf35: Fix issue with cloneAndAddResponseContext.

## 3.0.6

### Patch Changes

- 3188183: Add proper response logging.

## 3.0.5

### Patch Changes

- d577148: Remove some automatically added log context in addLambdaContext.

## 3.0.4

### Patch Changes

- 2c37200: Improved namespace handling.

## 3.0.3

### Patch Changes

- 2310c54: Improved README.md to tell a better story about the tool.

## 3.0.2

### Patch Changes

- a8be379: Update readme.
- a8be379: Updated dependencies.

## 3.0.1

### Patch Changes

- ae928d2: Update readme.

## 3.0.0

### Major Changes

- ab4347d: Changed how browser was exported so it's in @smooai/logger/browser.

  Prior BrowserLogger was at @smooai/logger/BrowserLogger.

  This seemed to lead to some issues when building downstream where node based utilities would get picked up from this package when building in browser land.

## 2.3.0

### Minor Changes

- ec16cbd: Switched to using .ansi as log extension for ansi colors iliazeus.vscode-ansi.

### Patch Changes

- ec16cbd: Fix build issue.
- ec16cbd: Fix minor issue with log output.

## 2.2.0

### Minor Changes

- 4b9d54a: Switched to using .ansi as log extension for ansi colors iliazeus.vscode-ansi.

### Patch Changes

- 4b9d54a: Fix minor issue with log output.

## 2.1.0

### Minor Changes

- 598a83b: Switched to using .ansi as log extension for ansi colors iliazeus.vscode-ansi.

## 2.0.1

### Patch Changes

- a060fc7: Fix readme issue.

## 2.0.0

### Major Changes

- c9d9ad3: Breaking Change: Changed AwsLambdaLogger to AwsServerLogger.

  AwsServerLogger is growing to have functionality beyond just Lambda (to soon include ECS) so it makes sense to change it now to AwsServerLogger.

  Fixed ANSI colors in all places.

  Added file log output and log rotation enabled by default when running on server locally.

## 1.2.4

### Patch Changes

- 1710c6f: Fix false local environment.

## 1.2.3

### Patch Changes

- 2681743: Fix treeshaking.

## 1.2.2

### Patch Changes

- 4b028b8: Fix BrowserLogger build.
- 4b028b8: Fixed build issue with .d.ts files.

## 1.2.1

### Patch Changes

- f2c5c5e: Fixed build issue with .d.ts files.

## 1.2.0

### Minor Changes

- 46b8c91: Fix the BrowserLogger build and replace chalk with picocolors to fix issue with using BrowserLogger.

## 1.1.0

### Minor Changes

- deee649: Fix package exports.

## 1.0.24

### Patch Changes

- 880cf11: Fix local logging.

## 1.0.23

### Patch Changes

- 0e2da13: Update readme.

## 1.0.22

### Patch Changes

- 7101205: Update prettier plugins.

## 1.0.21

### Patch Changes

- 7caf010: Updated all vite dependencies.

## 1.0.20

### Patch Changes

- be42715: Added browser logs for error and or message after context object.

## 1.0.19

### Patch Changes

- 5d85b5c: Update @smooai/utils.

## 1.0.18

### Patch Changes

- aed2567: Upgrade node types to v22.
- 3d6ab6b: Change from lodash to lodash.merge.

## 1.0.17

### Patch Changes

- 20bdb04: Upgraded to Node 22.

## 1.0.16

### Patch Changes

- 0fdb32d: Fix exports.

## 1.0.15

### Patch Changes

- ac6a1fd: Fix publish for Github releases.

## 1.0.14

### Patch Changes

- 6bf4674: Update author / bugs / homepage.

## 1.0.13

### Patch Changes

- 1c05cca: Use pnpm create-entry-points from @smooai/utils.

## 1.0.12

### Patch Changes

- 3086ea5: Fix package exports.
- 3086ea5: Add default to package exports.

## 1.0.11

### Patch Changes

- dfc62be: Fix package exports.

## 1.0.10

### Patch Changes

- fb07588: Fix local env.

## 1.0.9

### Patch Changes

- 017ac94: Add build to git hooks.

## 1.0.8

### Patch Changes

- c6c993d: Make sure typings are included.
- c6c993d: Add license to package.

## 1.0.7

### Patch Changes

- f645b67: Fix release CI.

## 1.0.6

### Patch Changes

- 167aff5: Add checks to CI.

## 1.0.5

### Patch Changes

- f0d7f95: Add badges.

## 1.0.4

### Patch Changes

- b6f7cd1: Made improvements to the readme.

## 1.0.3

### Patch Changes

- e0a3076: Remove cross-fetch dependency.

## 1.0.2

### Patch Changes

- 9b46780: Added ci:publish.

## 1.0.1

### Patch Changes

- b10956f: Fix issue with @vercel/style-guid.
- e0d719f: Moved into its own package.
