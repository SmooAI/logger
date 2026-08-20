/**
 * The single list of version-bearing files in this repo.
 *
 * `sync-versions.mjs` writes through it and `check-versions.mjs` reads through it,
 * so the guard can never drift from the syncer — a hand-copied second list is the
 * exact failure mode this file exists to prevent.
 *
 * Each `pattern` must have three capture groups: prefix, version, suffix.
 */
export const VERSIONED_FILES = [
  {
    path: "python/pyproject.toml",
    pattern: /^(version\s*=\s*")([^"]+)(")/m,
  },
  {
    // Missed by the old syncer, and not cosmetic: `poe install-dev` runs
    // `uv sync --locked`, which errors when the lock's version disagrees
    // with pyproject.toml.
    path: "python/uv.lock",
    pattern: /(name\s*=\s*"smooai-logger"\s*\nversion\s*=\s*")([^"]+)(")/,
  },
  {
    path: "rust/logger/Cargo.toml",
    pattern: /^(version\s*=\s*")([^"]+)(")/m,
  },
  {
    path: "rust/logger/Cargo.lock",
    pattern: /(name\s*=\s*"smooai-logger"\s*\nversion\s*=\s*")([^"]+)(")/,
  },
  {
    path: "go/version.go",
    pattern: /(const Version = ")([^"]+)(")/,
  },
  {
    path: "dotnet/src/SmooAI.Logger/SmooAI.Logger.csproj",
    pattern: /(<Version>)([^<]+)(<\/Version>)/,
  },
];

/** @returns {string} the version currently written in `content` */
export function readVersion({ path, pattern }, content) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Version not found in ${path}`);
  }
  return match[2];
}

/** @returns {string} `content` with its version replaced by `version` */
export function writeVersion({ path, pattern }, content, version) {
  if (!pattern.test(content)) {
    throw new Error(`Version not found in ${path}`);
  }
  return content.replace(pattern, `$1${version}$3`);
}

/**
 * Go demands a `/vN` module-path suffix for major >= 2 and forbids one below it.
 * A major bump therefore has to rewrite go.mod, or the release mints a `go/vN.x`
 * tag that resolves nothing — see `check-go-module.mjs`.
 *
 * Safe here only because the Go package is flat and never imports its own module
 * path. If a sub-package is ever added, this has to rewrite those imports too.
 */
export const GO_MOD = {
  path: "go/go.mod",
  base: "github.com/SmooAI/logger/go",
  pattern: /^(module\s+)(\S+)/m,
};

/** @returns {string} the module path `version` requires */
export function goModulePathFor(version) {
  const major = Number(version.split(".")[0]);
  if (!Number.isInteger(major)) {
    throw new Error(`"${version}" is not a semver version`);
  }
  return major >= 2 ? `${GO_MOD.base}/v${major}` : GO_MOD.base;
}
