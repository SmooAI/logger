/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import stableStringify from 'json-stable-stringify';
import merge from 'lodash.merge';
import picocolors from 'picocolors';
import { ErrorObject, serializeError } from 'serialize-error';
import { v4 as uuidv4 } from 'uuid';
import { isBuild, isLocal } from './env';
import './decycle.cjs';

export const global = (globalThis ?? ({} as any)) as any;

if (!global?.process) {
    global.process = {
        env: {} as any,
    } as any;
}

// json-decycle.d.ts
declare global {
    interface JSON {
        /**
         * Removes circular references from an object so that it can be serialized
         * using JSON.stringify. Circular references are replaced with a placeholder.
         *
         * @param obj The object to be decycled.
         * @param replacer An optional function that alters the behavior of the
         * stringification process.
         * @returns The decycled object.
         */
        decycle(obj: any, replacer?: (key: string, value: any) => any): any;
    }
}

// Export to make sure it works as a module augmentation
export {};

type Request = globalThis.Request;
export { type Request };

if (!global?.process) {
    global.process = {
        env: {} as any,
    } as any;
}

export type User = {
    id?: string;
    email?: string;
    phone?: string;
    role?: string;
    fullName?: string;
    firstName?: string;
    lastName?: string;
    context?: any;
};

export type HttpRequest = {
    protocol?: string;
    hostname?: string;
    path?: string;
    method?: string;
    queryString?: string;
    sourceIp?: string;
    userAgent?: string;
    headers?: Record<string, string>;
    body?: any;
};

export type HttpResponse = {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
};

export type TelemetryFields = {
    requestId?: string;
    duration?: number;
    traceId?: string;
    namespace?: string;
    service?: string;
    error?: string;
};

export enum ContextKey {
    // Set by the logger
    Level = 'level',
    LogLevel = 'LogLevel',
    Time = 'time',
    Message = 'msg',
    ErrorDetails = 'errorDetails',

    Name = 'name',
    CorrelationId = 'correlationId',
    User = 'user',
    Http = 'http',
    Context = 'context',

    // Telemetry fields
    RequestId = 'requestId',
    Duration = 'duration',
    TraceId = 'traceId',
    Error = 'error',
    Namespace = 'namespace',
    Service = 'service',
}

export enum ContextKeyUser {
    Id = 'id',
    Email = 'email',
    Phone = 'phone',
    Role = 'role',
    FullName = 'fullName',
    FirstName = 'firstName',
    LastName = 'lastName',
    Context = 'context',
}

export enum ContextKeyHttp {
    Request = 'request',
    Response = 'response',
}

export enum ContextKeyHttpRequest {
    Protocol = 'protocol',
    Host = 'hostname',
    Path = 'path',
    Method = 'method',
    QueryString = 'queryString',
    SourceIp = 'sourceIp',
    UserAgent = 'userAgent',
    Headers = 'headers',
    Body = 'body',
}

export enum ContextKeyHttpResponse {
    StatusCode = 'statusCode',
    Body = 'body',
    Headers = 'headers',
}

export enum ContextHeader {
    CorrelationId = 'X-Correlation-Id',
    UserAgent = 'User-Agent',
}

export enum Level {
    Trace = 'trace',
    Debug = 'debug',
    Info = 'info',
    Warn = 'warn',
    Error = 'error',
    Fatal = 'fatal',
}

export type Context<CustomConfig extends Record<string, any> = never> =
    | {
          [ContextKey.Level]?: string;
          [ContextKey.Time]?: string; // ISO 8601
          [ContextKey.Message]?: string;
          [ContextKey.Name]?: string;
          [ContextKey.CorrelationId]?: string;
          [ContextKey.User]?: User;
          [ContextKey.Http]?: {
              [ContextKeyHttp.Request]?: HttpRequest;
              [ContextKeyHttp.Response]?: HttpResponse;
          };
          [ContextKey.ErrorDetails]?: ErrorObject[];

          // Telemetry fields
          [ContextKey.RequestId]?: string;
          [ContextKey.Duration]?: number;
          [ContextKey.TraceId]?: string;
          [ContextKey.Namespace]?: string;
          [ContextKey.Service]?: string;
          [ContextKey.Error]?: string;
          [key: string]: any;
      }
    | CustomConfig;

const CORRELATION_ID = uuidv4();
// Singleton context object
export let CONTEXT = {
    [ContextKey.CorrelationId]: CORRELATION_ID,
    [ContextKey.RequestId]: CORRELATION_ID,
    [ContextKey.TraceId]: CORRELATION_ID,
} as Context;

type ContextKeys = ContextKey | ContextKeyUser | ContextKeyHttp | ContextKeyHttpRequest | ContextKeyHttpResponse | string;

export type ContextKeyConfig<CustomKeyConfig> =
    | ContextKeyUser[]
    | ContextKeyHttpRequest[]
    | ContextKeyHttpResponse[]
    | Partial<{ [key in ContextKeys]: ContextKeyConfig<never> }>
    | boolean
    | CustomKeyConfig;

export type ContextConfig<CustomKeys extends string = never, CustomKeyConfig = never> = Partial<
    Record<ContextKeys | CustomKeys, ContextKeyConfig<any> | CustomKeyConfig>
> | null;

export const CONFIG_MINIMAL: ContextConfig = {
    [ContextKey.Http]: {
        [ContextKeyHttp.Request]: [
            ContextKeyHttpRequest.Method,
            ContextKeyHttpRequest.Host,
            ContextKeyHttpRequest.Path,
            ContextKeyHttpRequest.QueryString,
            ContextKeyHttpRequest.Headers,
            ContextKeyHttpRequest.SourceIp,
            ContextKeyHttpRequest.UserAgent,
        ],
        [ContextKeyHttp.Response]: [ContextKeyHttpResponse.StatusCode, ContextKeyHttpResponse.Headers],
    },
};

export const CONFIG_FULL: ContextConfig = null;

export default class Logger {
    private _name = 'Logger';
    private _level: Level = Level.Info;
    private _contextConfig!: ContextConfig;
    private _configSettings: Record<string, ContextConfig> = {
        DEFAULT: CONFIG_MINIMAL,
        MINIMAL: CONFIG_MINIMAL,
        FULL: CONFIG_FULL,
    };
    private prettyPrint = false;

    public get name(): string {
        return this._name;
    }

    public set name(name: string) {
        this._name = name;
    }

    public get context(): Context {
        return CONTEXT;
    }

    public set context(context: Context) {
        CONTEXT = context;
    }

    public set level(level: Level) {
        this._level = level;
    }

    public get level(): Level {
        return this._level as string as Level;
    }

    public get contextConfig(): ContextConfig {
        return this._contextConfig;
    }

    public set contextConfig(contextConfig: ContextConfig) {
        this._contextConfig = contextConfig;
    }

    public get configSettings(): Record<string, ContextConfig> {
        return this._configSettings;
    }

    public set configSettings(configSettings: Record<string, ContextConfig>) {
        this._configSettings = configSettings;
    }

    protected cloneDeep(obj: any) {
        return JSON.parse(JSON.stringify(JSON.decycle(obj)));
    }

    private parseLevel(level: string | undefined): Level {
        if (!level) return Level.Info;
        if (Object.values(Level).includes(level as Level)) {
            return level as Level;
        } else {
            return Level.Info;
        }
    }

    private levelToCode(level: Level): number {
        switch (level) {
            case Level.Trace:
                return 10;
            case Level.Debug:
                return 20;
            case Level.Info:
                return 30;
            case Level.Warn:
                return 40;
            case Level.Error:
                return 50;
            case Level.Fatal:
                return 60;
            default:
                return Number.POSITIVE_INFINITY;
        }
    }

    protected isLogLevelEnabled(limit: Level): boolean {
        return this.levelToCode(limit) >= this.levelToCode(this.level);
    }

    protected removeUndefinedValuesRecursively(obj: any): any {
        if (!obj) return obj;

        if (Array.isArray(obj)) {
            return obj.map((value) => this.removeUndefinedValuesRecursively(value));
        } else if (typeof obj === 'object' && !Array.isArray(obj)) {
            const newObj: any = {};
            for (const [key, value] of Object.entries(JSON.parse(JSON.stringify(JSON.decycle(obj))))) {
                const newValue = this.removeUndefinedValuesRecursively(value);
                if (newValue !== undefined) {
                    newObj[key] = newValue;
                }
            }
            if (Object.keys(newObj).length === 0) {
                return undefined;
            }
            return newObj;
        } else {
            return obj;
        }
    }

    constructor(
        options: {
            name?: string;
            context?: Context;
            level?: Level;
            contextConfig?: ContextConfig;
            prettyPrint?: boolean;
        } = {},
    ) {
        options.name = options.name ?? this.name;
        options.level = options.level ?? this.parseLevel(process.env.LOG_LEVEL);
        this.level = options.level;
        options.prettyPrint = options.prettyPrint ?? (isLocal() || isBuild());
        this.prettyPrint = options.prettyPrint;
        this.setContextConfig(options.contextConfig);
        if (options.context) {
            this.context = merge(this.context, this.removeUndefinedValuesRecursively(options.context));

            if (ContextKey.CorrelationId in options.context && options.context[ContextKey.CorrelationId]) {
                this.setCorrelationId(options.context[ContextKey.CorrelationId]);
            }
        }
        this.name = options?.name ? options.name : this.name;
    }

    protected setContextConfig(config: ContextConfig | undefined) {
        this.contextConfig = config
            ? config
            : global?.process.env.LOGGER_CONTEXT_CONFIG && global?.process.env.LOGGER_CONTEXT_CONFIG in this._configSettings
              ? this._configSettings[global?.process.env.LOGGER_CONTEXT_CONFIG]
              : CONFIG_FULL;
    }

    private applyContextConfig(context: Context, contextConfig: ContextConfig = this.contextConfig): Context {
        if (!contextConfig) return context;
        const newContext: Context = this.cloneDeep(context);
        for (const [contextKey, value] of Object.entries(newContext)) {
            const contextConfigKey = !(contextKey in contextConfig) ? true : contextConfig[contextKey];
            const currentContext: Context = newContext[contextKey];
            if (!contextConfigKey) {
                delete newContext[contextKey];
                continue;
            } else if (contextConfigKey instanceof Array && currentContext instanceof Object) {
                for (const key of Object.keys(currentContext)) {
                    if (!(contextConfigKey as string[]).includes(key)) {
                        delete currentContext[key];
                    }
                }

                if (Object.keys(currentContext).length === 0) {
                    delete newContext[contextKey];
                }
            } else if (contextConfigKey instanceof Object) {
                newContext[contextKey] = this.applyContextConfig(value, contextConfigKey as ContextConfig);
            }
        }
        return newContext;
    }

    public baseContextKey(key: ContextKey | string): any | undefined {
        return this.context[key];
    }

    public addBaseContextKey(key: ContextKey | string, value: any) {
        this.context[key] = value;
    }

    public resetContext() {
        this.context = {};
        this.resetCorrelationId();
    }

    /**
     * Add context to the context['context'] object
     * @param context
     */
    public addContext(context: Context) {
        this.context[ContextKey.Context] = merge(this.context[ContextKey.Context] ?? {}, context);
    }

    public addBaseContext(context: Context) {
        this.context = merge(this.context, context);
    }

    public correlationId(): string {
        return this.baseContextKey(ContextKey.CorrelationId);
    }

    public resetCorrelationId() {
        this.setCorrelationId(uuidv4());
    }

    public setCorrelationId(correlationId: string) {
        this.addBaseContextKey(ContextKey.CorrelationId, correlationId);
        this.addBaseContextKey(ContextKey.RequestId, correlationId);
        this.addBaseContextKey(ContextKey.TraceId, correlationId);
    }

    public addUserContext(user: User | null) {
        if (user) {
            this.addBaseContext({
                [ContextKey.User]: user,
            });
        }
    }

    private getHeaderValue(headers: any, key: string) {
        if (headers && headers.has) {
            return headers.has(key) ? headers.get(key) : undefined;
        }
        return headers && key in headers ? headers[key] : undefined;
    }

    private getHeaders(headers: any) {
        if (headers && headers.has) {
            const headerObject: Record<string, string> = {};
            headers.forEach((value: string, key: string) => {
                headerObject[key] = value;
            });
            return headerObject;
        } else {
            return headers;
        }
    }

    public addRequestContext(request: Partial<Request>) {
        if (!request) return;
        const url = request.url ? new URL(request.url) : undefined;
        const headersObject = this.getHeaders(request.headers);
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Request]: {
                    [ContextKeyHttpRequest.Protocol]: url?.protocol,
                    [ContextKeyHttpRequest.Host]: url?.host,
                    [ContextKeyHttpRequest.Path]: url?.pathname,
                    [ContextKeyHttpRequest.Method]: request.method,
                    [ContextKeyHttpRequest.QueryString]: url?.search,
                    [ContextKeyHttpRequest.UserAgent]: this.getHeaderValue(request.headers, ContextHeader.UserAgent),
                    [ContextKeyHttpRequest.Body]: request.body,
                    [ContextKeyHttpRequest.Headers]: headersObject,
                },
            },
            [ContextKey.Namespace]: url?.pathname,
        });

        const correlationIdHeader = this.getHeaderValue(request.headers, ContextHeader.CorrelationId);
        if (correlationIdHeader) {
            this.setCorrelationId(correlationIdHeader);
        }
    }

    public addResponseContext(context: Partial<HttpResponse>) {
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Response]: {
                    [ContextKeyHttpResponse.StatusCode]: context.statusCode,
                    [ContextKeyHttpResponse.Body]: context.body,
                    [ContextKeyHttpResponse.Headers]: context.headers,
                },
            },
        });
    }

    public addHttpRequest(httpRequest: HttpRequest) {
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Request]: httpRequest,
            },
        });
    }

    public getHttpRequestOriginDomain(): string | undefined {
        const originUrl =
            this.baseContextKey(ContextKey.Http)?.[ContextKeyHttp.Request]?.[ContextKeyHttpRequest.Headers]?.['origin'] ||
            this.baseContextKey(ContextKey.Http)?.[ContextKeyHttp.Request]?.[ContextKeyHttpRequest.Headers]?.['referrer'];
        let origin = undefined;

        if (originUrl) {
            try {
                const url = new URL(originUrl);
                origin = url.hostname;
            } catch (error) {
                /* empty */
            }
        }

        return origin;
    }

    public addHttpResponse(httpResponse: HttpResponse) {
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Response]: httpResponse,
            },
        });
    }

    public addTelemetryFields(fields: TelemetryFields) {
        this.addBaseContext(fields);
    }

    protected buildLogObject(level: Level, args: any[]): any {
        const object = this.cloneDeep(this.context);
        for (const arg of args) {
            if (arg instanceof Error) {
                object[ContextKey.Error] = object[ContextKey.Error] ? `${object[ContextKey.Error]}; ${arg.message}` : arg.message;
                object[ContextKey.ErrorDetails] = [...(object[ContextKey.ErrorDetails] ?? []), serializeError(arg)];
                this.addTelemetryFields({
                    error: arg.message,
                });
            } else if (typeof arg === 'object') {
                object[ContextKey.Context] = merge(object[ContextKey.Context] ?? {}, arg);
            } else if (typeof arg === 'string') {
                object[ContextKey.Message] = object[ContextKey.Message] ? `${object[ContextKey.Message]}; ${arg}` : arg;
            }
        }

        if (!object[ContextKey.Message] && object[ContextKey.Error]) {
            object[ContextKey.Message] = object[ContextKey.Error];
        }
        object[ContextKey.Level] = object[ContextKey.Level] || this.levelToCode(level);
        object[ContextKey.LogLevel] = level;
        object[ContextKey.Time] = dayjs().toISOString();
        object[ContextKey.Name] = this.name;
        return this.removeUndefinedValuesRecursively(this.applyContextConfig(object));
    }

    private prettyStringify(object: any): string {
        let str =
            stableStringify(JSON.decycle(object), {
                space: '  ',
                cmp: (a, b) => {
                    if (a.key === ContextKey.Message && b.key !== ContextKey.Message) return -1;
                    if (a.key !== ContextKey.Message && b.key === ContextKey.Message) return 1;
                    if (a.key === ContextKey.Time && b.key !== ContextKey.Time) return -1;
                    if (a.key !== ContextKey.Time && b.key === ContextKey.Time) return 1;
                    if (a.key === ContextKey.Error && b.key !== ContextKey.Error) return -1;
                    if (a.key !== ContextKey.Error && b.key === ContextKey.Error) return 1;
                    if (a.key === ContextKey.ErrorDetails && b.key !== ContextKey.ErrorDetails) return -1;
                    if (a.key !== ContextKey.ErrorDetails && b.key === ContextKey.ErrorDetails) return 1;
                    return a.key < b.key ? -1 : 1;
                },
            }) ?? '{}';
        str = str.replace(/"msg": "(.*?)",\n/g, `"msg": "${picocolors.bold(picocolors.green('$1'))}",\n`);
        str = str.replace(/"time": "(.*?)",\n/g, `"time": "${picocolors.blue('$1')}",\n`);
        this.logFunc('----------------------------------------------------------------------------------------------------', true);
        this.logFunc('----------------------------------------------------------------------------------------------------', true);
        this.logFunc('----------------------------------------------------------------------------------------------------', true);
        return str;
    }

    private stringify(object: any): string {
        if (this.prettyPrint) {
            return this.prettyStringify(object);
        }
        return JSON.stringify(JSON.decycle(object));
    }

    protected logFunc = (arg: any, skipStringify = false) => {
        if (typeof global.window === 'undefined') {
            process.stdout.write(`${skipStringify ? arg : this.stringify(JSON.decycle(arg))}\n`);
        } else {
            console.log(arg);
            // If the log contains an error, log it directly for better browser debugging
            if (typeof arg === 'object' && arg !== null && ContextKey.Error in arg) {
                console.error(arg[ContextKey.Error]);
            }

            // If the log contains a message, log it directly for better browser debugging
            if (typeof arg === 'object' && arg !== null && ContextKey.Message in arg) {
                console.log(arg[ContextKey.Message]);
            }
        }
    };

    private doLog(level: Level, args: any[]): void {
        this.logFunc(this.buildLogObject(level, args));
    }

    public trace(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Trace)) this.doLog(Level.Trace, args);
    }
    public debug(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Debug)) this.doLog(Level.Debug, args);
    }
    public info(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Info)) this.doLog(Level.Info, args);
    }
    public warn(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Warn)) this.doLog(Level.Warn, args);
    }
    public error(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Error)) this.doLog(Level.Error, args);
    }
    public fatal(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Fatal)) this.doLog(Level.Fatal, args);
    }
    public silent(..._args: any[]): void {
        // No console equivalent for silent
    }
}
