import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error -- plain .mjs guard script, no types
import { checkGoModuleMajor } from "./check-go-module.mjs";

const root = resolve(__dirname, "..");
const goMod = (path: string) => `module ${path}\n\ngo 1.25.0\n`;

describe("checkGoModuleMajor", () => {
  it("passes for the real repo state", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    const content = readFileSync(resolve(root, "go", "go.mod"), "utf8");
    expect(checkGoModuleMajor(content, pkg.version)).toEqual([]);
  });

  it("fails on the /v3-module-vs-v4-tag mismatch that shipped for months", () => {
    const errors = checkGoModuleMajor(goMod("github.com/SmooAI/logger/go/v3"), "4.3.0");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("/v4");
  });

  it("fails when the module carries a suffix but the package is pre-v2", () => {
    expect(checkGoModuleMajor(goMod("github.com/SmooAI/logger/go/v4"), "1.2.3")).toHaveLength(1);
  });

  it("passes for a bare module path when the package is pre-v2", () => {
    expect(checkGoModuleMajor(goMod("github.com/SmooAI/logger/go"), "1.2.3")).toEqual([]);
  });

  it("fails when a major bump leaves the module path behind", () => {
    expect(checkGoModuleMajor(goMod("github.com/SmooAI/logger/go/v4"), "5.0.0")).toHaveLength(1);
  });

  it("fails loudly on a missing module directive", () => {
    expect(checkGoModuleMajor("go 1.25.0\n", "4.3.0")).toHaveLength(1);
  });
});
