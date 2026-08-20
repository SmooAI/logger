import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs guard script, no types
import { checkVersions } from "./check-versions.mjs";
// @ts-expect-error -- plain .mjs guard script, no types
import { GO_MOD, VERSIONED_FILES } from "./versioned-files.mjs";

const root = resolve(__dirname, "..");
const readFromRepo = (path: string) => readFileSync(resolve(root, path), "utf8");

/** An in-memory repo where everything is at `version` unless `overrides` says otherwise. */
function fakeRepo(version: string, overrides: Record<string, string> = {}) {
  const files: Record<string, string> = {
    [GO_MOD.path]: `module github.com/SmooAI/logger/go/v${version.split(".")[0]}\n\ngo 1.25.0\n`,
  };
  for (const file of VERSIONED_FILES) {
    // Reuse each real file and rewrite only its version, so the fixtures stay
    // shaped like the files the guard actually parses.
    files[file.path] = readFromRepo(file.path).replace(file.pattern, `$1${version}$3`);
  }
  return (path: string) => {
    const content = { ...files, ...overrides }[path];
    if (content === undefined) throw new Error(`no fixture for ${path}`);
    return content;
  };
}

describe("checkVersions", () => {
  it("passes for the real repo state", () => {
    const { version } = JSON.parse(readFromRepo("package.json"));
    expect(checkVersions(readFromRepo, version)).toEqual([]);
  });

  it("catches the exact skew that shipped: package.json 4.3.0 vs python 3.2.3", () => {
    const python = VERSIONED_FILES.find(
      (f: { path: string }) => f.path === "python/pyproject.toml",
    );
    const read = fakeRepo("4.3.0", {
      "python/pyproject.toml": readFromRepo("python/pyproject.toml").replace(
        python.pattern,
        "$13.2.3$3",
      ),
    });
    const errors = checkVersions(read, "4.3.0");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("python/pyproject.toml is at 3.2.3");
  });

  it("fails once per drifted manifest", () => {
    const read = fakeRepo("3.0.0");
    const errors = checkVersions(read, "4.3.0");
    expect(errors).toHaveLength(VERSIONED_FILES.length + 1); // +1 for go.mod's major
  });

  it("fails on the /v3-module-vs-v4-tag mismatch that shipped for months", () => {
    const read = fakeRepo("4.3.0", {
      [GO_MOD.path]: "module github.com/SmooAI/logger/go/v3\n\ngo 1.25.0\n",
    });
    const errors = checkVersions(read, "4.3.0");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("github.com/SmooAI/logger/go/v4");
  });

  it("requires a bare Go module path below v2", () => {
    const bare = "module github.com/SmooAI/logger/go\n\ngo 1.25.0\n";
    expect(checkVersions(fakeRepo("1.2.3", { [GO_MOD.path]: bare }), "1.2.3")).toEqual([]);
    expect(checkVersions(fakeRepo("1.2.3"), "1.2.3")).toHaveLength(1);
  });

  it("fails when a major bump leaves the Go module path behind", () => {
    const read = fakeRepo("5.0.0", {
      [GO_MOD.path]: "module github.com/SmooAI/logger/go/v4\n\ngo 1.25.0\n",
    });
    expect(checkVersions(read, "5.0.0")).toHaveLength(1);
  });

  it("fails loudly on a missing module directive", () => {
    const read = fakeRepo("4.3.0", { [GO_MOD.path]: "go 1.25.0\n" });
    expect(checkVersions(read, "4.3.0")).toHaveLength(1);
  });

  it("fails loudly when a manifest loses its version line entirely", () => {
    const read = fakeRepo("4.3.0", { "go/version.go": "package logger\n" });
    const errors = checkVersions(read, "4.3.0");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("go/version.go");
  });
});
