"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/env.ts
var env_exports = {};
__export(env_exports, {
  Level: () => Level,
  MAIN_ENVIRONMENTS: () => MAIN_ENVIRONMENTS,
  getEnvironment: () => getEnvironment,
  isBuild: () => isBuild,
  isDevelopment: () => isDevelopment,
  isGithubActions: () => isGithubActions,
  isLocal: () => isLocal,
  isLogLevelEnabled: () => isLogLevelEnabled,
  isProduction: () => isProduction,
  isStaging: () => isStaging
});
module.exports = __toCommonJS(env_exports);
var Level = /* @__PURE__ */ ((Level2) => {
  Level2["Trace"] = "trace";
  Level2["Debug"] = "debug";
  Level2["Info"] = "info";
  Level2["Warn"] = "warn";
  Level2["Error"] = "error";
  Level2["Fatal"] = "fatal";
  return Level2;
})(Level || {});
var MAIN_ENVIRONMENTS = ["development", "staging", "production"];
function getEnvironment(stage = process.env.SST_STAGE ?? "local") {
  if (process.env.IS_LOCAL) {
    return "local";
  } else {
    return stage;
  }
}
function isBuild() {
  return Boolean(process.env.GITHUB_ACTIONS || process.env.SEED_SERVICE_FULLPATH);
}
function isGithubActions() {
  return Boolean(process.env.GITHUB_ACTIONS);
}
function isLocal(stage = process.env.SST_STAGE ?? "local") {
  return getEnvironment(stage) === "local";
}
function isDevelopment(stage = process.env.SST_STAGE ?? "local") {
  return getEnvironment(stage) === "development";
}
function isStaging(stage = process.env.SST_STAGE ?? "local") {
  return getEnvironment(stage) === "staging";
}
function isProduction(stage = process.env.SST_STAGE ?? "local") {
  return getEnvironment(stage) === "production";
}
function levelToCode(level) {
  switch (level) {
    case "trace" /* Trace */:
      return 10;
    case "debug" /* Debug */:
      return 20;
    case "info" /* Info */:
      return 30;
    case "warn" /* Warn */:
      return 40;
    case "error" /* Error */:
      return 50;
    case "fatal" /* Fatal */:
      return 60;
    default:
      return Number.POSITIVE_INFINITY;
  }
}
function isLogLevelEnabled(limit) {
  return levelToCode(limit) >= levelToCode(process.env.LOG_LEVEL ?? "info" /* Info */);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Level,
  MAIN_ENVIRONMENTS,
  getEnvironment,
  isBuild,
  isDevelopment,
  isGithubActions,
  isLocal,
  isLogLevelEnabled,
  isProduction,
  isStaging
});
//# sourceMappingURL=env.js.map