"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/decycle.cjs
var require_decycle = __commonJS({
  "src/decycle.cjs"(exports, module) {
    "use strict";
    if (typeof JSON.decycle !== "function") {
      JSON.decycle = function decycle(object, replacer) {
        "use strict";
        var objects = /* @__PURE__ */ new WeakMap();
        return function derez(value2, path2) {
          var old_path;
          var nu;
          if (replacer !== void 0) {
            value2 = replacer(value2);
          }
          if (typeof value2 === "object" && value2 !== null && !(value2 instanceof Boolean) && !(value2 instanceof Date) && !(value2 instanceof Number) && !(value2 instanceof RegExp) && !(value2 instanceof String)) {
            old_path = objects.get(value2);
            if (old_path !== void 0) {
              return { $ref: old_path };
            }
            objects.set(value2, path2);
            if (Array.isArray(value2)) {
              nu = [];
              value2.forEach(function(element2, i2) {
                nu[i2] = derez(element2, path2 + "[" + i2 + "]");
              });
            } else {
              nu = {};
              Object.keys(value2).forEach(function(name2) {
                nu[name2] = derez(value2[name2], path2 + "[" + JSON.stringify(name2) + "]");
              });
            }
            return nu;
          }
          return value2;
        }(object, "$");
      };
    }
    if (typeof JSON.retrocycle !== "function") {
      JSON.retrocycle = function retrocycle($) {
        "use strict";
        var px = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\(?:[\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;
        (function rez(value) {
          if (value && typeof value === "object") {
            if (Array.isArray(value)) {
              value.forEach(function(element, i) {
                if (typeof element === "object" && element !== null) {
                  var path = element.$ref;
                  if (typeof path === "string" && px.test(path)) {
                    value[i] = eval(path);
                  } else {
                    rez(element);
                  }
                }
              });
            } else {
              Object.keys(value).forEach(function(name) {
                var item = value[name];
                if (typeof item === "object" && item !== null) {
                  var path = item.$ref;
                  if (typeof path === "string" && px.test(path)) {
                    value[name] = eval(path);
                  } else {
                    rez(item);
                  }
                }
              });
            }
          }
        })($);
        return $;
      };
    }
  }
});

// src/AwsLambdaLogger.ts
var AwsLambdaLogger_exports = {};
__export(AwsLambdaLogger_exports, {
  CONFIG_FULL: () => CONFIG_FULL2,
  CONFIG_MINIMAL: () => CONFIG_MINIMAL2,
  CONTEXT: () => CONTEXT2,
  ContextHeader: () => ContextHeader,
  ContextKey: () => ContextKey,
  ContextKeyCaller: () => ContextKeyCaller,
  ContextKeyHttp: () => ContextKeyHttp,
  ContextKeyHttpRequest: () => ContextKeyHttpRequest,
  ContextKeyHttpResponse: () => ContextKeyHttpResponse,
  ContextKeyLambda: () => ContextKeyLambda,
  ContextKeyQueue: () => ContextKeyQueue,
  ContextKeyUser: () => ContextKeyUser,
  Level: () => Level,
  ServerContextKey: () => ServerContextKey,
  default: () => AwsLambdaLogger,
  global: () => global2
});
module.exports = __toCommonJS(AwsLambdaLogger_exports);
var sourceMapSupport = __toESM(require("source-map-support"));

// src/Logger.ts
var import_uuid = require("uuid");
var import_merge = __toESM(require("lodash/merge"));
var import_serialize_error = require("serialize-error");
var import_json_stable_stringify = __toESM(require("json-stable-stringify"));

// ../../../node_modules/.pnpm/chalk@5.3.0/node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value2 = Math.max(red, green, blue) * 2;
        if (value2 === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value2 === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// ../../../node_modules/.pnpm/chalk@5.3.0/node_modules/chalk/source/vendor/supports-color/index.js
var import_node_process = __toESM(require("process"), 1);
var import_node_os = __toESM(require("os"), 1);
var import_node_tty = __toESM(require("tty"), 1);
function hasFlag(flag, argv = globalThis.Deno ? globalThis.Deno.args : import_node_process.default.argv) {
  const prefix = flag.startsWith("-") ? "" : flag.length === 1 ? "-" : "--";
  const position = argv.indexOf(prefix + flag);
  const terminatorPosition = argv.indexOf("--");
  return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
}
var { env } = import_node_process.default;
var flagForceColor;
if (hasFlag("no-color") || hasFlag("no-colors") || hasFlag("color=false") || hasFlag("color=never")) {
  flagForceColor = 0;
} else if (hasFlag("color") || hasFlag("colors") || hasFlag("color=true") || hasFlag("color=always")) {
  flagForceColor = 1;
}
function envForceColor() {
  if ("FORCE_COLOR" in env) {
    if (env.FORCE_COLOR === "true") {
      return 1;
    }
    if (env.FORCE_COLOR === "false") {
      return 0;
    }
    return env.FORCE_COLOR.length === 0 ? 1 : Math.min(Number.parseInt(env.FORCE_COLOR, 10), 3);
  }
}
function translateLevel(level) {
  if (level === 0) {
    return false;
  }
  return {
    level,
    hasBasic: true,
    has256: level >= 2,
    has16m: level >= 3
  };
}
function _supportsColor(haveStream, { streamIsTTY, sniffFlags = true } = {}) {
  const noFlagForceColor = envForceColor();
  if (noFlagForceColor !== void 0) {
    flagForceColor = noFlagForceColor;
  }
  const forceColor = sniffFlags ? flagForceColor : noFlagForceColor;
  if (forceColor === 0) {
    return 0;
  }
  if (sniffFlags) {
    if (hasFlag("color=16m") || hasFlag("color=full") || hasFlag("color=truecolor")) {
      return 3;
    }
    if (hasFlag("color=256")) {
      return 2;
    }
  }
  if ("TF_BUILD" in env && "AGENT_NAME" in env) {
    return 1;
  }
  if (haveStream && !streamIsTTY && forceColor === void 0) {
    return 0;
  }
  const min = forceColor || 0;
  if (env.TERM === "dumb") {
    return min;
  }
  if (import_node_process.default.platform === "win32") {
    const osRelease = import_node_os.default.release().split(".");
    if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10586) {
      return Number(osRelease[2]) >= 14931 ? 3 : 2;
    }
    return 1;
  }
  if ("CI" in env) {
    if ("GITHUB_ACTIONS" in env || "GITEA_ACTIONS" in env) {
      return 3;
    }
    if (["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in env) || env.CI_NAME === "codeship") {
      return 1;
    }
    return min;
  }
  if ("TEAMCITY_VERSION" in env) {
    return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
  }
  if (env.COLORTERM === "truecolor") {
    return 3;
  }
  if (env.TERM === "xterm-kitty") {
    return 3;
  }
  if ("TERM_PROGRAM" in env) {
    const version = Number.parseInt((env.TERM_PROGRAM_VERSION || "").split(".")[0], 10);
    switch (env.TERM_PROGRAM) {
      case "iTerm.app": {
        return version >= 3 ? 3 : 2;
      }
      case "Apple_Terminal": {
        return 2;
      }
    }
  }
  if (/-256(color)?$/i.test(env.TERM)) {
    return 2;
  }
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
    return 1;
  }
  if ("COLORTERM" in env) {
    return 1;
  }
  return min;
}
function createSupportsColor(stream, options = {}) {
  const level = _supportsColor(stream, {
    streamIsTTY: stream && stream.isTTY,
    ...options
  });
  return translateLevel(level);
}
var supportsColor = {
  stdout: createSupportsColor({ isTTY: import_node_tty.default.isatty(1) }),
  stderr: createSupportsColor({ isTTY: import_node_tty.default.isatty(2) })
};
var supports_color_default = supportsColor;

// ../../../node_modules/.pnpm/chalk@5.3.0/node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// ../../../node_modules/.pnpm/chalk@5.3.0/node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = supports_color_default;
var GENERATOR = Symbol("GENERATOR");
var STYLER = Symbol("STYLER");
var IS_EMPTY = Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model, level, type, ...arguments_) => {
  if (model === "rgb") {
    if (level === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {
}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level) {
      this[GENERATOR].level = level;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// src/Logger.ts
var import_dayjs = __toESM(require("dayjs"));

// src/env.ts
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
function isLocal(stage = process.env.SST_STAGE ?? "local") {
  return getEnvironment(stage) === "local";
}

// src/Logger.ts
var import_decycle = __toESM(require_decycle());
var global2 = globalThis ?? {};
if (!global2?.process) {
  global2.process = {
    env: {}
  };
}
if (!global2?.process) {
  global2.process = {
    env: {}
  };
}
var ContextKey = /* @__PURE__ */ ((ContextKey3) => {
  ContextKey3["Level"] = "level";
  ContextKey3["LogLevel"] = "LogLevel";
  ContextKey3["Time"] = "time";
  ContextKey3["Message"] = "msg";
  ContextKey3["ErrorDetails"] = "errorDetails";
  ContextKey3["Name"] = "name";
  ContextKey3["CorrelationId"] = "correlationId";
  ContextKey3["User"] = "user";
  ContextKey3["Http"] = "http";
  ContextKey3["Context"] = "context";
  ContextKey3["RequestId"] = "requestId";
  ContextKey3["Duration"] = "duration";
  ContextKey3["TraceId"] = "traceId";
  ContextKey3["Error"] = "error";
  ContextKey3["Namespace"] = "namespace";
  ContextKey3["Service"] = "service";
  return ContextKey3;
})(ContextKey || {});
var ContextKeyUser = /* @__PURE__ */ ((ContextKeyUser2) => {
  ContextKeyUser2["Id"] = "id";
  ContextKeyUser2["Email"] = "email";
  ContextKeyUser2["Phone"] = "phone";
  ContextKeyUser2["Role"] = "role";
  ContextKeyUser2["FullName"] = "fullName";
  ContextKeyUser2["FirstName"] = "firstName";
  ContextKeyUser2["LastName"] = "lastName";
  ContextKeyUser2["Context"] = "context";
  return ContextKeyUser2;
})(ContextKeyUser || {});
var ContextKeyHttp = /* @__PURE__ */ ((ContextKeyHttp2) => {
  ContextKeyHttp2["Request"] = "request";
  ContextKeyHttp2["Response"] = "response";
  return ContextKeyHttp2;
})(ContextKeyHttp || {});
var ContextKeyHttpRequest = /* @__PURE__ */ ((ContextKeyHttpRequest2) => {
  ContextKeyHttpRequest2["Protocol"] = "protocol";
  ContextKeyHttpRequest2["Host"] = "hostname";
  ContextKeyHttpRequest2["Path"] = "path";
  ContextKeyHttpRequest2["Method"] = "method";
  ContextKeyHttpRequest2["QueryString"] = "queryString";
  ContextKeyHttpRequest2["SourceIp"] = "sourceIp";
  ContextKeyHttpRequest2["UserAgent"] = "userAgent";
  ContextKeyHttpRequest2["Headers"] = "headers";
  ContextKeyHttpRequest2["Body"] = "body";
  return ContextKeyHttpRequest2;
})(ContextKeyHttpRequest || {});
var ContextKeyHttpResponse = /* @__PURE__ */ ((ContextKeyHttpResponse2) => {
  ContextKeyHttpResponse2["StatusCode"] = "statusCode";
  ContextKeyHttpResponse2["Body"] = "body";
  ContextKeyHttpResponse2["Headers"] = "headers";
  return ContextKeyHttpResponse2;
})(ContextKeyHttpResponse || {});
var ContextHeader = /* @__PURE__ */ ((ContextHeader2) => {
  ContextHeader2["CorrelationId"] = "X-Correlation-Id";
  ContextHeader2["UserAgent"] = "User-Agent";
  return ContextHeader2;
})(ContextHeader || {});
var Level = /* @__PURE__ */ ((Level2) => {
  Level2["Trace"] = "trace";
  Level2["Debug"] = "debug";
  Level2["Info"] = "info";
  Level2["Warn"] = "warn";
  Level2["Error"] = "error";
  Level2["Fatal"] = "fatal";
  return Level2;
})(Level || {});
var CORRELATION_ID = (0, import_uuid.v4)();
var CONTEXT = {
  ["correlationId" /* CorrelationId */]: CORRELATION_ID,
  ["requestId" /* RequestId */]: CORRELATION_ID,
  ["traceId" /* TraceId */]: CORRELATION_ID
};
var CONFIG_MINIMAL = {
  ["http" /* Http */]: {
    ["request" /* Request */]: [
      "method" /* Method */,
      "hostname" /* Host */,
      "path" /* Path */,
      "queryString" /* QueryString */,
      "headers" /* Headers */,
      "sourceIp" /* SourceIp */,
      "userAgent" /* UserAgent */
    ],
    ["response" /* Response */]: ["statusCode" /* StatusCode */, "headers" /* Headers */]
  }
};
var CONFIG_FULL = null;
var Logger = class {
  _name = "Logger";
  _level = "info" /* Info */;
  _contextConfig;
  _configSettings = {
    DEFAULT: CONFIG_MINIMAL,
    MINIMAL: CONFIG_MINIMAL,
    FULL: CONFIG_FULL
  };
  prettyPrint = false;
  get name() {
    return this._name;
  }
  set name(name2) {
    this._name = name2;
  }
  get context() {
    return CONTEXT;
  }
  set context(context) {
    CONTEXT = context;
  }
  set level(level) {
    this._level = level;
  }
  get level() {
    return this._level;
  }
  get contextConfig() {
    return this._contextConfig;
  }
  set contextConfig(contextConfig) {
    this._contextConfig = contextConfig;
  }
  get configSettings() {
    return this._configSettings;
  }
  set configSettings(configSettings) {
    this._configSettings = configSettings;
  }
  cloneDeep(obj) {
    return JSON.parse(JSON.stringify(JSON.decycle(obj)));
  }
  parseLevel(level) {
    if (!level) return "info" /* Info */;
    if (Object.values(Level).includes(level)) {
      return level;
    } else {
      return "info" /* Info */;
    }
  }
  levelToCode(level) {
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
  isLogLevelEnabled(limit) {
    return this.levelToCode(limit) >= this.levelToCode(this.level);
  }
  removeUndefinedValuesRecursively(obj) {
    if (!obj) return obj;
    if (Array.isArray(obj)) {
      return obj.map((value2) => this.removeUndefinedValuesRecursively(value2));
    } else if (typeof obj === "object" && !Array.isArray(obj)) {
      const newObj = {};
      for (const [key, value2] of Object.entries(JSON.parse(JSON.stringify(JSON.decycle(obj))))) {
        const newValue = this.removeUndefinedValuesRecursively(value2);
        if (newValue !== void 0) {
          newObj[key] = newValue;
        }
      }
      if (Object.keys(newObj).length === 0) {
        return void 0;
      }
      return newObj;
    } else {
      return obj;
    }
  }
  constructor(options = {}) {
    options.name = options.name ?? this.name;
    options.level = options.level ?? this.parseLevel(process.env.LOG_LEVEL);
    this.level = options.level;
    options.prettyPrint = options.prettyPrint ?? (isLocal() || isBuild());
    this.prettyPrint = options.prettyPrint;
    this.setContextConfig(options.contextConfig);
    if (options.context) {
      this.context = (0, import_merge.default)(this.context, this.removeUndefinedValuesRecursively(options.context));
      if ("correlationId" /* CorrelationId */ in options.context && options.context["correlationId" /* CorrelationId */]) {
        this.setCorrelationId(options.context["correlationId" /* CorrelationId */]);
      }
    }
    this.name = options?.name ? options.name : this.name;
  }
  setContextConfig(config) {
    this.contextConfig = config ? config : global2?.process.env.LOGGER_CONTEXT_CONFIG && global2?.process.env.LOGGER_CONTEXT_CONFIG in this._configSettings ? this._configSettings[global2?.process.env.LOGGER_CONTEXT_CONFIG] : CONFIG_FULL;
  }
  applyContextConfig(context, contextConfig = this.contextConfig) {
    if (!contextConfig) return context;
    const newContext = this.cloneDeep(context);
    for (const [contextKey, value2] of Object.entries(newContext)) {
      const contextConfigKey = !(contextKey in contextConfig) ? true : contextConfig[contextKey];
      const currentContext = newContext[contextKey];
      if (!contextConfigKey) {
        delete newContext[contextKey];
        continue;
      } else if (contextConfigKey instanceof Array && currentContext instanceof Object) {
        for (const key of Object.keys(currentContext)) {
          if (!contextConfigKey.includes(key)) {
            delete currentContext[key];
          }
        }
        if (Object.keys(currentContext).length === 0) {
          delete newContext[contextKey];
        }
      } else if (contextConfigKey instanceof Object) {
        newContext[contextKey] = this.applyContextConfig(value2, contextConfigKey);
      }
    }
    return newContext;
  }
  baseContextKey(key) {
    return this.context[key];
  }
  addBaseContextKey(key, value2) {
    this.context[key] = value2;
  }
  resetContext() {
    this.context = {};
    this.resetCorrelationId();
  }
  /**
   * Add context to the context['context'] object
   * @param context
   */
  addContext(context) {
    this.context["context" /* Context */] = (0, import_merge.default)(this.context["context" /* Context */] ?? {}, context);
  }
  addBaseContext(context) {
    this.context = (0, import_merge.default)(this.context, context);
  }
  correlationId() {
    return this.baseContextKey("correlationId" /* CorrelationId */);
  }
  resetCorrelationId() {
    this.setCorrelationId((0, import_uuid.v4)());
  }
  setCorrelationId(correlationId) {
    this.addBaseContextKey("correlationId" /* CorrelationId */, correlationId);
    this.addBaseContextKey("requestId" /* RequestId */, correlationId);
    this.addBaseContextKey("traceId" /* TraceId */, correlationId);
  }
  addUserContext(user) {
    if (user) {
      this.addBaseContext({
        ["user" /* User */]: user
      });
    }
  }
  getHeaderValue(headers, key) {
    if (headers && headers.has) {
      return headers.has(key) ? headers.get(key) : void 0;
    }
    return headers && key in headers ? headers[key] : void 0;
  }
  getHeaders(headers) {
    if (headers && headers.has) {
      const headerObject = {};
      headers.forEach((value2, key) => {
        headerObject[key] = value2;
      });
      return headerObject;
    } else {
      return headers;
    }
  }
  addRequestContext(request) {
    if (!request) return;
    const url = request.url ? new URL(request.url) : void 0;
    const headersObject = this.getHeaders(request.headers);
    this.addBaseContext({
      ["http" /* Http */]: {
        ["request" /* Request */]: {
          ["protocol" /* Protocol */]: url?.protocol,
          ["hostname" /* Host */]: url?.host,
          ["path" /* Path */]: url?.pathname,
          ["method" /* Method */]: request.method,
          ["queryString" /* QueryString */]: url?.search,
          ["userAgent" /* UserAgent */]: this.getHeaderValue(request.headers, "User-Agent" /* UserAgent */),
          ["body" /* Body */]: request.body,
          ["headers" /* Headers */]: headersObject
        }
      },
      ["namespace" /* Namespace */]: url?.pathname
    });
    const correlationIdHeader = this.getHeaderValue(request.headers, "X-Correlation-Id" /* CorrelationId */);
    if (correlationIdHeader) {
      this.setCorrelationId(correlationIdHeader);
    }
  }
  addResponseContext(context) {
    this.addBaseContext({
      ["http" /* Http */]: {
        ["response" /* Response */]: {
          ["statusCode" /* StatusCode */]: context.statusCode,
          ["body" /* Body */]: context.body,
          ["headers" /* Headers */]: context.headers
        }
      }
    });
  }
  addHttpRequest(httpRequest) {
    this.addBaseContext({
      ["http" /* Http */]: {
        ["request" /* Request */]: httpRequest
      }
    });
  }
  getHttpRequestOriginDomain() {
    const originUrl = this.baseContextKey("http" /* Http */)?.["request" /* Request */]?.["headers" /* Headers */]?.["origin"] || this.baseContextKey("http" /* Http */)?.["request" /* Request */]?.["headers" /* Headers */]?.["referrer"];
    let origin = void 0;
    if (originUrl) {
      try {
        const url = new URL(originUrl);
        origin = url.hostname;
      } catch (error) {
      }
    }
    return origin;
  }
  addHttpResponse(httpResponse) {
    this.addBaseContext({
      ["http" /* Http */]: {
        ["response" /* Response */]: httpResponse
      }
    });
  }
  addTelemetryFields(fields) {
    this.addBaseContext(fields);
  }
  buildLogObject(level, args) {
    const object = this.cloneDeep(this.context);
    for (const arg of args) {
      if (arg instanceof Error) {
        object["error" /* Error */] = object["error" /* Error */] ? `${object["error" /* Error */]}; ${arg.message}` : arg.message;
        object["errorDetails" /* ErrorDetails */] = [...object["errorDetails" /* ErrorDetails */] ?? [], (0, import_serialize_error.serializeError)(arg)];
        this.addTelemetryFields({
          error: arg.message
        });
      } else if (typeof arg === "object") {
        object["context" /* Context */] = (0, import_merge.default)(object["context" /* Context */] ?? {}, arg);
      } else if (typeof arg === "string") {
        object["msg" /* Message */] = object["msg" /* Message */] ? `${object["msg" /* Message */]}; ${arg}` : arg;
      }
    }
    if (!object["msg" /* Message */] && object["error" /* Error */]) {
      object["msg" /* Message */] = object["error" /* Error */];
    }
    object["level" /* Level */] = object["level" /* Level */] || this.levelToCode(level);
    object["LogLevel" /* LogLevel */] = level;
    object["time" /* Time */] = (0, import_dayjs.default)().toISOString();
    object["name" /* Name */] = this.name;
    return this.removeUndefinedValuesRecursively(this.applyContextConfig(object));
  }
  prettyStringify(object) {
    let str = (0, import_json_stable_stringify.default)(JSON.decycle(object), {
      space: "  ",
      cmp: (a, b) => {
        if (a.key === "msg" /* Message */ && b.key !== "msg" /* Message */) return -1;
        if (a.key !== "msg" /* Message */ && b.key === "msg" /* Message */) return 1;
        if (a.key === "time" /* Time */ && b.key !== "time" /* Time */) return -1;
        if (a.key !== "time" /* Time */ && b.key === "time" /* Time */) return 1;
        if (a.key === "error" /* Error */ && b.key !== "error" /* Error */) return -1;
        if (a.key !== "error" /* Error */ && b.key === "error" /* Error */) return 1;
        if (a.key === "errorDetails" /* ErrorDetails */ && b.key !== "errorDetails" /* ErrorDetails */) return -1;
        if (a.key !== "errorDetails" /* ErrorDetails */ && b.key === "errorDetails" /* ErrorDetails */) return 1;
        return a.key < b.key ? -1 : 1;
      }
    });
    str = str.replace(/"msg": "(.*?)",\n/g, `"msg": "${source_default.bold(source_default.green("$1"))}",
`);
    str = str.replace(/"time": "(.*?)",\n/g, `"time": "${source_default.blue("$1")}",
`);
    this.logFunc("----------------------------------------------------------------------------------------------------", true);
    this.logFunc("----------------------------------------------------------------------------------------------------", true);
    this.logFunc("----------------------------------------------------------------------------------------------------", true);
    return str;
  }
  stringify(object) {
    if (this.prettyPrint) {
      return this.prettyStringify(object);
    }
    return JSON.stringify(JSON.decycle(object));
  }
  logFunc = (arg, skipStringify = false) => {
    if (typeof global2.window === "undefined") {
      process.stdout.write(`${skipStringify ? arg : this.stringify(JSON.decycle(arg))}
`);
    } else {
      console.log(arg);
    }
  };
  doLog(level, args) {
    this.logFunc(this.buildLogObject(level, args));
  }
  trace(...args) {
    if (this.isLogLevelEnabled("trace" /* Trace */)) this.doLog("trace" /* Trace */, args);
  }
  debug(...args) {
    if (this.isLogLevelEnabled("debug" /* Debug */)) this.doLog("debug" /* Debug */, args);
  }
  info(...args) {
    if (this.isLogLevelEnabled("info" /* Info */)) this.doLog("info" /* Info */, args);
  }
  warn(...args) {
    if (this.isLogLevelEnabled("warn" /* Warn */)) this.doLog("warn" /* Warn */, args);
  }
  error(...args) {
    if (this.isLogLevelEnabled("error" /* Error */)) this.doLog("error" /* Error */, args);
  }
  fatal(...args) {
    if (this.isLogLevelEnabled("fatal" /* Fatal */)) this.doLog("fatal" /* Fatal */, args);
  }
  silent(..._args) {
  }
};

// src/AwsLambdaLogger.ts
var import_esm_utils = __toESM(require("esm-utils"));
var import_merge2 = __toESM(require("lodash/merge"));
var api = __toESM(require("@opentelemetry/api"));
var import_meta = {};
sourceMapSupport.install();
if (!global.__dirname || !global.__filename) {
  const { __dirname, __filename } = import_meta.url ? (0, import_esm_utils.default)({ url: import_meta.url, resolve: import_meta.resolve }) : { __dirname: "", __filename: "" };
  global.__dirname = global.__dirname ? global.__dirname : __dirname;
  global.__filename = global.__filename ? global.__filename : __filename;
}
function callsites() {
  const _prepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack2) => stack2;
  const stack = new Error().stack?.slice(1);
  Error.prepareStackTrace = _prepareStackTrace;
  return stack;
}
var ServerContextKey = /* @__PURE__ */ ((ServerContextKey2) => {
  ServerContextKey2["CallerContext"] = "callerContext";
  ServerContextKey2["Lambda"] = "lambda";
  ServerContextKey2["Region"] = "region";
  ServerContextKey2["NodeEnv"] = "nodeEnv";
  ServerContextKey2["NodeConfigEnv"] = "nodeConfigEnv";
  ServerContextKey2["OrganizationId"] = "organizationId";
  ServerContextKey2["Queue"] = "queue";
  ServerContextKey2["LambdaRequestId"] = "@requestId";
  ServerContextKey2["LambdaTimestamp"] = "@timestamp";
  ServerContextKey2["LambdaMessage"] = "@message";
  ServerContextKey2["LambdaDuration"] = "@duration";
  return ServerContextKey2;
})(ServerContextKey || {});
var ContextKey2 = { ...ServerContextKey, ...ContextKey };
var ContextKeyCaller = /* @__PURE__ */ ((ContextKeyCaller2) => {
  ContextKeyCaller2["LoggerName"] = "loggerName";
  ContextKeyCaller2["Stack"] = "stack";
  return ContextKeyCaller2;
})(ContextKeyCaller || {});
var ContextKeyLambda = /* @__PURE__ */ ((ContextKeyLambda2) => {
  ContextKeyLambda2["FunctionName"] = "functionName";
  ContextKeyLambda2["ExecutionEnvironment"] = "executionEnvironment";
  ContextKeyLambda2["FunctionMemorySize"] = "functionMemorySize";
  ContextKeyLambda2["FunctionVersion"] = "functionVersion";
  ContextKeyLambda2["LogGroupName"] = "logGroupName";
  ContextKeyLambda2["LogStreamName"] = "logStreamName";
  ContextKeyLambda2["RemainingTimeMs"] = "remainingTimeMs";
  ContextKeyLambda2["Identity"] = "identity";
  ContextKeyLambda2["RequestId"] = "requestId";
  return ContextKeyLambda2;
})(ContextKeyLambda || {});
var ContextKeyQueue = /* @__PURE__ */ ((ContextKeyQueue2) => {
  ContextKeyQueue2["Name"] = "name";
  ContextKeyQueue2["MessageId"] = "messageId";
  ContextKeyQueue2["MessageGroupId"] = "messageGroupId";
  ContextKeyQueue2["MessageApproximateReceiveCount"] = "messageApproximateReceiveCount";
  return ContextKeyQueue2;
})(ContextKeyQueue || {});
var CONTEXT2 = (0, import_merge2.default)({}, CONTEXT);
var CONFIG_MINIMAL2 = (0, import_merge2.default)(
  {
    [ContextKey2.CallerContext]: true,
    [ContextKey2.Lambda]: ["functionName" /* FunctionName */, "logGroupName" /* LogGroupName */],
    [ContextKey2.Region]: false,
    [ContextKey2.NodeEnv]: false,
    [ContextKey2.Queue]: ["name" /* Name */, "messageId" /* MessageId */]
  },
  CONFIG_MINIMAL
);
var CONFIG_FULL2 = null;
var FULL_CONFIG_MINIMAL = (0, import_merge2.default)(CONFIG_MINIMAL2, CONFIG_MINIMAL);
var CONFIG_SETTINGS = {
  DEFAULT: FULL_CONFIG_MINIMAL,
  MINIMAL: FULL_CONFIG_MINIMAL,
  FULL: CONFIG_FULL2
};
var AwsLambdaLogger = class extends Logger {
  _serverName = "AwsLambdaLogger";
  _serverContextConfig;
  _serverConfigSettings = CONFIG_SETTINGS;
  get context() {
    return CONTEXT2;
  }
  set context(context) {
    CONTEXT2 = context;
  }
  get name() {
    return this._serverName;
  }
  set name(name2) {
    this._serverName = name2;
  }
  get contextConfig() {
    return this._serverContextConfig;
  }
  set contextConfig(contextConfig) {
    this._serverContextConfig = contextConfig;
  }
  get configSettings() {
    return this._serverConfigSettings;
  }
  set configSettings(configSettings) {
    this._serverConfigSettings = configSettings;
  }
  getCaller(level) {
    const frames = callsites();
    if (frames.length <= level) {
      return {};
    }
    const wrappedFrames = frames.map((frame) => sourceMapSupport.wrapCallSite(frame));
    const stack = wrappedFrames.slice(level);
    return {
      ["stack" /* Stack */]: stack.map((frame) => frame.toString())
    };
  }
  constructor(options) {
    super(options);
  }
  getLambdaEnvironmentContext() {
    return {
      [ContextKey2.Lambda]: {
        ["functionName" /* FunctionName */]: process.env.AWS_LAMBDA_FUNCTION_NAME,
        ["functionVersion" /* FunctionVersion */]: process.env.AWS_LAMBDA_FUNCTION_VERSION,
        ["executionEnvironment" /* ExecutionEnvironment */]: process.env.AWS_EXECUTION_ENV,
        ["logGroupName" /* LogGroupName */]: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
        ["logStreamName" /* LogStreamName */]: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
        ["functionMemorySize" /* FunctionMemorySize */]: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE
      },
      [ContextKey2.Region]: process.env.AWS_DEFAULT_REGION,
      [ContextKey2.NodeEnv]: process.env.NODE_ENV,
      [ContextKey2.NodeConfigEnv]: process.env.NODE_CONFIG_ENV
    };
  }
  addLambdaContext(event, context) {
    this.resetContext();
    const correlationId = event?.headers?.["X-Correlation-Id" /* CorrelationId */];
    if (correlationId) {
      this.setCorrelationId(correlationId);
    }
    this.addBaseContext(
      (0, import_merge2.default)(
        {
          [ContextKey2.Lambda]: {
            ["requestId" /* RequestId */]: context?.awsRequestId,
            ["functionName" /* FunctionName */]: context?.functionName,
            ["functionVersion" /* FunctionVersion */]: context?.functionVersion,
            ["logGroupName" /* LogGroupName */]: context?.logGroupName,
            ["logStreamName" /* LogStreamName */]: context?.logStreamName,
            ["functionMemorySize" /* FunctionMemorySize */]: context?.memoryLimitInMB,
            ["remainingTimeMs" /* RemainingTimeMs */]: context?.getRemainingTimeInMillis?.(),
            ["identity" /* Identity */]: context?.identity
          },
          [ContextKey2.Http]: {
            ["request" /* Request */]: {
              ["protocol" /* Protocol */]: event?.requestContext?.http?.protocol,
              ["hostname" /* Host */]: event?.requestContext?.domainName,
              ["path" /* Path */]: event?.rawPath,
              ["method" /* Method */]: event?.requestContext?.http?.method,
              ["queryString" /* QueryString */]: event?.rawQueryString,
              ["sourceIp" /* SourceIp */]: event?.requestContext?.http?.sourceIp,
              ["userAgent" /* UserAgent */]: event?.requestContext?.http?.userAgent || event?.headers?.["User-Agent" /* UserAgent */],
              ["headers" /* Headers */]: event?.headers
            }
          }
        },
        this.getLambdaEnvironmentContext()
      )
    );
    this.info({ event }, "lambda:trigger");
  }
  parseSQSMessageAttributes(messageAttributes) {
    return {
      ...Object.entries(messageAttributes).reduce((result, attribute) => {
        let value2;
        switch (attribute[1].DataType) {
          case "Number":
            value2 = parseInt(attribute[1].StringValue || "NaN");
            break;
          case "Binary":
            value2 = attribute[1].BinaryValue;
            break;
          case "String":
          default:
            value2 = attribute[1].StringValue;
            break;
        }
        const key = attribute[0];
        if ([ContextKey2.Lambda, ContextKey2.Http, ContextKey2.Queue].includes(key)) {
          result[key] = JSON.parse(value2);
        } else {
          result[key] = value2;
        }
        return result;
      }, {})
    };
  }
  addSQSRecordContext(record) {
    this.addBaseContext({
      [ContextKey2.Queue]: {
        ["name" /* Name */]: process.env.QUEUE_NAME,
        ["messageId" /* MessageId */]: record?.messageId,
        ["messageGroupId" /* MessageGroupId */]: record?.attributes?.MessageGroupId,
        ["messageApproximateReceiveCount" /* MessageApproximateReceiveCount */]: record?.attributes?.ApproximateReceiveCount
      },
      ...this.parseSQSMessageAttributes(this.sqsRecordMessageAttributesToBatchMessageAttributes(record?.messageAttributes))
    });
  }
  sqsRecordMessageAttributesToBatchMessageAttributes(messageAttributes) {
    return Object.entries(messageAttributes).reduce((result, [key, sqsValue]) => {
      const value2 = {};
      value2.StringValue = sqsValue.stringValue;
      value2.BinaryValue = sqsValue.binaryValue ? Uint8Array.from(Buffer.from(sqsValue.binaryValue)) : void 0;
      value2.DataType = sqsValue.dataType;
      value2.StringListValues = sqsValue.stringListValues;
      value2.BinaryListValues = sqsValue.binaryListValues ? sqsValue.binaryListValues.map((value3) => Uint8Array.from(Buffer.from(value3))) : void 0;
      result[key] = value2;
      return result;
    }, {});
  }
  writePartialContextToSQSMessageAttributes() {
    const httpContext = this.baseContextKey(ContextKey2.Http);
    return {
      [ContextKey2.CorrelationId]: {
        StringValue: this.correlationId(),
        DataType: "String"
      },
      [ContextKey2.Http]: {
        StringValue: httpContext ? JSON.stringify({
          ["request" /* Request */]: {
            ...{
              ...httpContext["request" /* Request */],
              ["body" /* Body */]: void 0,
              ["headers" /* Headers */]: {
                origin: httpContext["request" /* Request */]["headers" /* Headers */]?.origin,
                referer: httpContext["request" /* Request */]["headers" /* Headers */]?.referer
              }
            }
          }
        }) : "{}",
        DataType: "String"
      }
    };
  }
  writePartialContextToBatchSQSMessageAttributes() {
    const httpContext = this.baseContextKey(ContextKey2.Http);
    return {
      [ContextKey2.CorrelationId]: {
        StringValue: this.correlationId(),
        DataType: "String"
      },
      [ContextKey2.Http]: {
        StringValue: httpContext && JSON.stringify({
          ["request" /* Request */]: {
            ["userAgent" /* UserAgent */]: httpContext["userAgent" /* UserAgent */],
            ["sourceIp" /* SourceIp */]: httpContext["sourceIp" /* SourceIp */]
          }
        }),
        DataType: "String"
      }
    };
  }
  addCallerContext() {
    this.addBaseContext({
      [ContextKey2.CallerContext]: {
        ...this.getCaller(5),
        ["loggerName" /* LoggerName */]: this.name
      }
    });
  }
  addTraceContext() {
    const span = api.trace.getActiveSpan();
    if (span && span.spanContext) {
      const { traceId } = span.spanContext();
      this.addTelemetryFields({
        traceId
      });
    }
  }
  slimDownLocally(object) {
    if (ContextKey2.User in object && "context" /* Context */ in object[ContextKey2.User]) {
      delete object[ContextKey2.User]["context" /* Context */];
    }
    if (ContextKey2.Http in object && "request" /* Request */ in object[ContextKey2.Http] && "headers" /* Headers */ in object[ContextKey2.Http]["request" /* Request */]) {
      delete object[ContextKey2.Http]["request" /* Request */]["headers" /* Headers */];
    }
    if (ContextKey2.CallerContext in object && "stack" /* Stack */ in object[ContextKey2.CallerContext] && object[ContextKey2.CallerContext]["stack" /* Stack */].length > 2) {
      object[ContextKey2.CallerContext]["stack" /* Stack */] = object[ContextKey2.CallerContext]["stack" /* Stack */].slice(0, 2);
    }
  }
  levelToLogLevel(level) {
    switch (level) {
      case "trace" /* Trace */:
        return "DEBUG";
      case "debug" /* Debug */:
        return "DEBUG";
      case "info" /* Info */:
        return "INFO";
      case "warn" /* Warn */:
        return "WARN";
      case "error" /* Error */:
        return "ERROR";
      case "fatal" /* Fatal */:
        return "ERROR";
      default:
        return "DEBUG";
    }
  }
  addLambdaKeys(level, obj) {
    if (obj[ContextKey2.Duration]) obj[ContextKey2.LambdaDuration] = obj[ContextKey2.Duration];
    if (obj[ContextKey2.Message]) obj[ContextKey2.LambdaMessage] = obj[ContextKey2.Message];
    if (obj[ContextKey2.Lambda]?.["requestId" /* RequestId */]) obj[ContextKey2.LambdaRequestId] = obj[ContextKey2.Lambda]?.["requestId" /* RequestId */];
    if (obj[ContextKey2.Time]) obj[ContextKey2.LambdaTimestamp] = obj[ContextKey2.Time];
    return obj;
  }
  buildLogObject(level, args) {
    this.addCallerContext();
    this.addTraceContext();
    const obj = super.buildLogObject(level, args);
    this.addLambdaKeys(level, obj);
    if (isLocal()) this.slimDownLocally(obj);
    return obj;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  CONFIG_FULL,
  CONFIG_MINIMAL,
  CONTEXT,
  ContextHeader,
  ContextKey,
  ContextKeyCaller,
  ContextKeyHttp,
  ContextKeyHttpRequest,
  ContextKeyHttpResponse,
  ContextKeyLambda,
  ContextKeyQueue,
  ContextKeyUser,
  Level,
  ServerContextKey,
  global
});
//# sourceMappingURL=AwsLambdaLogger.js.map