# Repository Guidelines

## Project Structure & Module Organization

Core TypeScript sources live in `src/`, organized by runtime (`AwsServerLogger.ts`, `BrowserLogger.ts`, `Logger.ts`) with shared helpers inside `src/utils/`. Vitest specs sit beside their subjects as `.spec.ts` files to keep behavior in context. Build artifacts emit to `dist/`; regenerate them instead of editing by hand. Repository-level configs (`tsconfig.json`, `tsup.config.ts`, `vite.config.mts`, `vitest.config.mts`, `eslint.config.mjs`, `prettier.config.cjs`) control bundling, testing, and formatting. Static documentation assets belong in `images/`, and the `python/` folder is reserved for parity examples that mirror the TypeScript API.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies; use pnpm 10+ with Node 20 or newer.
- `pnpm build` bundles to `dist/` via tsup and copies `decycle.cjs`.
- `pnpm watch` runs tsup in watch mode for quick iteration.
- `pnpm lint` checks the codebase with the shared `@smooai/config-eslint` rules.
- `pnpm typecheck` executes `tsc --noEmit` to validate typing contracts.
- `pnpm test` runs the Vitest suite (`--passWithNoTests` allows targeted runs).
- `pnpm check-all` chains typecheck, lint, test, and build for pre-release confidence.
- `pnpm format` applies Prettier with our repository plugins.

## Coding Style & Naming Conventions

Follow the TypeScript-first style enforced by ESLint and Prettier. Prettier is configured for 4-space indentation, 160-character lines, semicolons, trailing commas, and sorted imports; always run `pnpm format` on touched files. Loggers, contexts, and utilities should use PascalCase for classes, camelCase for functions and variables, and SCREAMING_SNAKE_CASE for constants or environment flags. Align module exports with existing index barrels to keep public surface predictable.

## Testing Guidelines

Write or update `.spec.ts` neighbors whenever behavior changes. Prefer descriptive `describe` blocks keyed to the public method (`describe('setContext', ...)`) and keep scenario names action-oriented. Use Vitest snapshots sparingly; structured assertions keep logs readable. Run `pnpm test` locally before pushing, and pair it with `pnpm typecheck` for structural regressions. For coverage, run `pnpm test -- --coverage` and include the report when fixing critical bugs.

## Commit & Pull Request Guidelines

Model commit messages after the existing history: optional leading emoji, concise summary in sentence case, and reference the tracking issue or PR number in parentheses (e.g., `🦋 Add browser context fallbacks (#123)`). Squash small fixups before opening a PR. Each pull request should explain the change rationale, list validation commands (`pnpm test`, `pnpm check-all`), and attach screenshots or logs when altering output formatting. Link to related issues and call out breaking changes in bold at the top of the description.
