/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import stableStringify from 'json-stable-stringify';
import { merge } from 'merge-anything';
import { createColors } from 'picocolors';
import { ErrorObject, serializeError } from 'serialize-error';
import { v4 as uuidv4 } from 'uuid';
import { isBuild, isLocal } from './env';
import './decycle.cjs';
import { logToFile, type RotationOptions } from './utils/rotation';

const picocolors = createColors(true);

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
type Response = globalThis.Response;
type Headers = globalThis.Headers;
export { type Request, type Response, type Headers };

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
    private rotation!: RotationOptions;
    private logToFile = false;

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
                return {};
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
            logToFile?: boolean;
            rotation?: RotationOptions;
        } = {},
    ) {
        options.name = options.name ?? this.name;
        options.level = options.level ?? this.parseLevel(process.env.LOG_LEVEL);
        this.level = options.level;
        options.prettyPrint = options.prettyPrint ?? (isLocal() || isBuild());
        this.prettyPrint = options.prettyPrint;
        this.rotation = merge(
            {
                path: '.smooai-logs',
                filenamePrefix: 'output',
                extension: 'ansi',
                size: '1M',
                interval: '1d',
                maxSize: '100M',
            },
            options.rotation ?? {},
        );
        this.logToFile = options.logToFile ?? isLocal();
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

    /**
     * Retrieves a value from the base context by key
     * @param {ContextKey | string} key - The context key to retrieve
     * @returns {any | undefined} The value associated with the key, or undefined if not found
     */
    public baseContextKey(key: ContextKey | string): any | undefined {
        return this.context[key];
    }

    /**
     * Adds a key-value pair to the base context
     * @param {ContextKey | string} key - The context key to add
     * @param {any} value - The value to associate with the key
     * @returns {void}
     */
    public addBaseContextKey(key: ContextKey | string, value: any) {
        this.context[key] = value;
    }

    /**
     * Resets the context to an empty state and generates a new correlation ID
     * @returns {void}
     */
    public resetContext() {
        this.context = {};
        this.resetCorrelationId();
    }

    /**
     * Adds context to the nested context['context'] object
     * @param {Context} context - The context object to merge into the nested context
     * @returns {void}
     */
    public addContext(context: Context) {
        this.context[ContextKey.Context] = merge(this.context[ContextKey.Context] ?? {}, context);
    }

    /**
     * Adds context directly to the base context object
     * @param {Context} context - The context object to merge into the base context
     * @returns {void}
     */
    public addBaseContext(context: Context) {
        this.context = merge(this.context, context);
    }

    /**
     * Retrieves the current correlation ID from the context
     * @returns {string} The correlation ID
     */
    public correlationId(): string {
        return this.baseContextKey(ContextKey.CorrelationId);
    }

    /**
     * Generates and sets a new correlation ID
     * @returns {void}
     */
    public resetCorrelationId() {
        this.setCorrelationId(uuidv4());
    }

    /**
     * Sets the correlation ID and related tracking IDs
     * @param {string} correlationId - The correlation ID to set
     * @returns {void}
     */
    public setCorrelationId(correlationId: string) {
        this.addBaseContextKey(ContextKey.CorrelationId, correlationId);
        this.addBaseContextKey(ContextKey.RequestId, correlationId);
        this.addBaseContextKey(ContextKey.TraceId, correlationId);
    }

    /**
     * Adds user context to the logger
     * @param {User | null} user - The user object containing user details
     * @returns {void}
     */
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

    /**
     * Sets the namespace for the current logging context
     * @param {string} namespace - The namespace to set
     * @returns {void}
     */
    public setNamespace(namespace: string) {
        this.addBaseContextKey(ContextKey.Namespace, namespace);
    }

    /**
     * Adds HTTP request context to the logger
     * @param {Partial<Request>} request - The request object containing HTTP request details
     * @returns {void}
     */
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
        });
        this.setNamespace(`${request.method?.toUpperCase() ?? ''} ${url?.pathname}`);

        const correlationIdHeader = this.getHeaderValue(request.headers, ContextHeader.CorrelationId);
        if (correlationIdHeader) {
            this.setCorrelationId(correlationIdHeader);
        }
    }

    private getHeadersObject(headers: Headers) {
        const headersObject: Record<string, string> = {};
        headers.forEach((value: string, key: string) => {
            headersObject[key] = value;
        });
        return headersObject;
    }

    /**
     * Clones and adds HTTP response context to the logger, including response body
     * @param {Partial<Response>} context - The response object
     * @returns {Promise<void>}
     */
    public async cloneAndAddResponseContext(context: Partial<Response>) {
        if (!context.clone) {
            this.addResponseContext(context);
            return;
        }
        const response = await context.clone();
        const body = await response.text();
        let bodyJson: any;
        try {
            bodyJson = JSON.parse(body);
        } catch (error) {
            /* empty */
        } finally {
            if (!bodyJson) {
                bodyJson = body;
            }
        }
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Response]: {
                    [ContextKeyHttpResponse.StatusCode]: response.status,
                    [ContextKeyHttpResponse.Headers]: response.headers ? this.getHeadersObject(response.headers) : {},
                    [ContextKeyHttpResponse.Body]: bodyJson,
                },
            },
        });
    }

    /**
     * Adds HTTP response context to the logger without including the response body
     *
     * NOTE: This method does not log the response body. If you want to log the response body,
     * use the async cloneAndAddResponseContext method instead.
     * @param {Partial<Response>} context - The response object containing HTTP response details
     * @returns {void}
     */
    public addResponseContext(context: Partial<Response>) {
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Response]: {
                    [ContextKeyHttpResponse.StatusCode]: context.status ?? undefined,
                    [ContextKeyHttpResponse.Headers]: context.headers ? this.getHeadersObject(context.headers) : {},
                },
            },
        });
    }

    /**
     * Adds HTTP request details to the context
     * @param {HttpRequest} httpRequest - The HTTP request details object
     * @returns {void}
     */
    public addHttpRequest(httpRequest: HttpRequest) {
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Request]: httpRequest,
            },
        });
    }

    /**
     * Retrieves the origin domain from the HTTP request headers
     * @returns {string | undefined} The origin domain hostname, or undefined if not found
     */
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

    /**
     * Adds HTTP response details to the context
     * @param {HttpResponse} httpResponse - The HTTP response details object
     * @returns {void}
     */
    public addHttpResponse(httpResponse: HttpResponse) {
        this.addBaseContext({
            [ContextKey.Http]: {
                [ContextKeyHttp.Response]: httpResponse,
            },
        });
    }

    /**
     * Adds telemetry fields to the base context
     * @param {TelemetryFields} fields - The telemetry fields to add
     * @returns {void}
     */
    public addTelemetryFields(fields: TelemetryFields) {
        this.addBaseContext(fields);
    }

    private handleError(arg: any, object: any) {
        if (arg instanceof Error) {
            object[ContextKey.Error] = object[ContextKey.Error] ? `${object[ContextKey.Error]}; ${arg.message}` : arg.message;
            object[ContextKey.ErrorDetails] = [...(object[ContextKey.ErrorDetails] ?? []), serializeError(arg)];
            this.addTelemetryFields({
                error: arg.message,
            });
        }
    }

    protected buildLogObject(level: Level, args: any[]): any[] {
        const object = this.cloneDeep(this.context);
        for (const arg of args) {
            if (arg instanceof Error) {
                this.handleError(arg, object);
            } else if (typeof arg === 'object') {
                for (const value of Object.values(arg)) {
                    if (value instanceof Error) {
                        this.handleError(value, object);
                    }
                }

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
        return [this.removeUndefinedValuesRecursively(this.applyContextConfig(object))];
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

        str = str.replace(/"msg": "(.*?)",\n/g, (_, msg) => `"msg": "${picocolors.bold(picocolors.green(msg))}",\n`);
        str = str.replace(/"time": "(.*?)",\n/g, (_, time) => `"time": "${picocolors.blue(time)}",\n`);
        return str;
    }

    private stringify(object: any): string {
        if (this.prettyPrint) {
            return this.prettyStringify(object);
        }
        return JSON.stringify(JSON.decycle(object));
    }

    protected logFunc = (args: any[]) => {
        if (typeof global.window === 'undefined' || isLocal()) {
            for (const arg of args) {
                const toWrite =
                    `${this.stringify(arg)}\n` +
                    (this.prettyPrint ? '----------------------------------------------------------------------------------------------------\n' : '') +
                    (this.prettyPrint ? '----------------------------------------------------------------------------------------------------\n' : '') +
                    (this.prettyPrint ? '----------------------------------------------------------------------------------------------------\n' : '');
                process.stdout.write(toWrite);
                if (this.logToFile) {
                    logToFile(this.rotation, toWrite);
                }
            }
        } else {
            for (const arg of args) {
                console.log(arg);
            }
        }
    };

    private doLog(level: Level, args: any[]): void {
        this.logFunc(this.buildLogObject(level, args));
    }

    /**
     * Logs a trace level message
     * @param {...any} args - The arguments to log (strings, objects, or errors)
     * @returns {void}
     */
    public trace(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Trace)) this.doLog(Level.Trace, args);
    }
    /**
     * Logs a debug level message
     * @param {...any} args - The arguments to log (strings, objects, or errors)
     * @returns {void}
     */
    public debug(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Debug)) this.doLog(Level.Debug, args);
    }
    /**
     * Logs an info level message
     * @param {...any} args - The arguments to log (strings, objects, or errors)
     * @returns {void}
     */
    public info(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Info)) this.doLog(Level.Info, args);
    }
    /**
     * Logs a warning level message
     * @param {...any} args - The arguments to log (strings, objects, or errors)
     * @returns {void}
     */
    public warn(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Warn)) this.doLog(Level.Warn, args);
    }
    /**
     * Logs an error level message
     * @param {...any} args - The arguments to log (strings, objects, or errors)
     * @returns {void}
     */
    public error(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Error)) this.doLog(Level.Error, args);
    }
    /**
     * Logs a fatal level message
     * @param {...any} args - The arguments to log (strings, objects, or errors)
     * @returns {void}
     */
    public fatal(...args: any[]): void {
        if (this.isLogLevelEnabled(Level.Fatal)) this.doLog(Level.Fatal, args);
    }
    /**
     * Silent logging method that does not output anything
     * @param {...any} _args - Arguments are accepted but not processed
     * @returns {void}
     */
    public silent(..._args: any[]): void {
        // No console equivalent for silent
    }
}
