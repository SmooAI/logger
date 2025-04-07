/* eslint-disable @typescript-eslint/no-explicit-any */

import type { MessageAttributeValue } from '@aws-sdk/client-sqs';
import * as api from '@opentelemetry/api';
import { APIGatewayProxyEventV2, Context as LambdaContext, SQSRecord } from 'aws-lambda';
import createEsmUtils from 'esm-utils';
import merge from 'lodash.merge';
import * as sourceMapSupport from 'source-map-support';
import { isLocal } from './env';
import Logger, {
    CONFIG_MINIMAL as BASE_CONFIG_MINIMAL,
    CONTEXT as BASE_CONTEXT,
    Context as BaseContext,
    ContextConfig as BaseContextConfig,
    ContextKey as BaseContextKey,
    ContextKeyConfig as BaseContextKeyConfig,
    ContextHeader,
    ContextKeyHttp,
    ContextKeyHttpRequest,
    ContextKeyUser,
    Level,
} from './Logger';

export * from './Logger';

export type SQSBatchMessageAttributes = Record<string, MessageAttributeValue>;

sourceMapSupport.install();

if (!global.__dirname || !global.__filename) {
    const { __dirname, __filename } = import.meta.url
        ? createEsmUtils({ url: import.meta.url, resolve: import.meta.resolve } as any)
        : { __dirname: '', __filename: '' };
    global.__dirname = global.__dirname ? global.__dirname : __dirname;
    global.__filename = global.__filename ? global.__filename : __filename;
}

type AnyFunction = (...args: any[]) => any;

export interface CallSite {
    /**
	Returns the value of `this`.
	*/
    getThis(): unknown | undefined;

    /**
	Returns the type of `this` as a string. This is the name of the function stored in the constructor field of `this`, if available, otherwise the object's `[[Class]]` internal property.
	*/
    getTypeName(): string | null;

    /**
	Returns the current function.
	*/
    getFunction(): AnyFunction | undefined;

    /**
	Returns the name of the current function, typically its `name` property. If a name property is not available an attempt will be made to try to infer a name from the function's context.
	*/
    getFunctionName(): string | null;

    /**
	Returns the name of the property of `this` or one of its prototypes that holds the current function.
	*/
    getMethodName(): string | null;

    /**
	Returns the name of the script if this function was defined in a script.
	*/
    getFileName(): string | null;

    /**
	Returns the current line number if this function was defined in a script.
	*/
    getLineNumber(): number | null;

    /**
	Returns the current column number if this function was defined in a script.
	*/
    getColumnNumber(): number | null;

    /**
	Returns a string representing the location where `eval` was called if this function was created using a call to `eval`.
	*/
    getEvalOrigin(): string | undefined;

    /**
	Returns `true` if this is a top-level invocation, that is, if it's a global object.
	*/
    isToplevel(): boolean;

    /**
	Returns `true` if this call takes place in code defined by a call to `eval`.
	*/
    isEval(): boolean;

    /**
	Returns `true` if this call is in native V8 code.
	*/
    isNative(): boolean;

    /**
	Returns `true` if this is a constructor call.
	*/
    isConstructor(): boolean;
}

function callsites(): CallSite[] {
    const _prepareStackTrace = Error.prepareStackTrace;
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack?.slice(1);
    Error.prepareStackTrace = _prepareStackTrace;
    return stack as unknown as CallSite[];
}

export enum ServerContextKey {
    CallerContext = 'callerContext',
    Lambda = 'lambda',
    Region = 'region',
    NodeEnv = 'nodeEnv',
    NodeConfigEnv = 'nodeConfigEnv',
    OrganizationId = 'organizationId',
    Queue = 'queue',
    LambdaRequestId = '@requestId',
    LambdaTimestamp = '@timestamp',
    LambdaMessage = '@message',
    LambdaDuration = '@duration',
}

type ContextKey = ServerContextKey | BaseContextKey;
const ContextKey = { ...ServerContextKey, ...BaseContextKey } as const;

export enum ContextKeyCaller {
    LoggerName = 'loggerName',
    Stack = 'stack',
}

export enum ContextKeyLambda {
    FunctionName = 'functionName',
    ExecutionEnvironment = 'executionEnvironment',
    FunctionMemorySize = 'functionMemorySize',
    FunctionVersion = 'functionVersion',
    LogGroupName = 'logGroupName',
    LogStreamName = 'logStreamName',
    RemainingTimeMs = 'remainingTimeMs',
    Identity = 'identity',
    RequestId = 'requestId',
}

export enum ContextKeyQueue {
    Name = 'name',
    MessageId = 'messageId',
    MessageGroupId = 'messageGroupId',
    MessageApproximateReceiveCount = 'messageApproximateReceiveCount',
}

export let CONTEXT = merge({}, BASE_CONTEXT);

type ContextKeys = ContextKeyCaller | ContextKeyLambda | ContextKeyQueue | string;

type ContextKeyConfig = BaseContextKeyConfig<
    ContextKeyCaller[] | ContextKeyLambda[] | ContextKeyQueue[] | Partial<{ [key in ContextKeys]: ContextKeyConfig }> | boolean
>;

export type ContextConfig = BaseContextConfig<ContextKey, ContextKeyConfig>;

export const CONFIG_MINIMAL: ContextConfig = merge(
    {
        [ContextKey.CallerContext]: true,
        [ContextKey.Lambda]: [ContextKeyLambda.FunctionName, ContextKeyLambda.LogGroupName],
        [ContextKey.Region]: false,
        [ContextKey.NodeEnv]: false,
        [ContextKey.Queue]: [ContextKeyQueue.Name, ContextKeyQueue.MessageId],
    },
    BASE_CONFIG_MINIMAL,
);

export const CONFIG_FULL: ContextConfig = null;

const FULL_CONFIG_MINIMAL = merge(CONFIG_MINIMAL, BASE_CONFIG_MINIMAL);

const CONFIG_SETTINGS: Record<string, ContextConfig> = {
    DEFAULT: FULL_CONFIG_MINIMAL,
    MINIMAL: FULL_CONFIG_MINIMAL,
    FULL: CONFIG_FULL,
};

export type Context = BaseContext<{
    [ContextKey.CallerContext]?: Partial<Record<ContextKeyCaller | string, any>>;
    [ContextKey.Lambda]?: Partial<Record<ContextKeyLambda | string, any>>;
    [ContextKey.Queue]?: Partial<Record<ContextKeyQueue | string, any>>;
}>;

type CallerContext = {
    [ContextKeyCaller.LoggerName]?: string;
    [ContextKeyCaller.Stack]?: string[];
};

export default class AwsLambdaLogger extends Logger {
    private _serverName = 'AwsLambdaLogger';
    private _serverContextConfig!: ContextConfig;
    private _serverConfigSettings: Record<string, ContextConfig> = CONFIG_SETTINGS;

    public get context(): Context {
        return CONTEXT;
    }

    public set context(context: Context) {
        CONTEXT = context;
    }

    public get name(): string {
        return this._serverName;
    }

    public set name(name: string) {
        this._serverName = name;
    }

    public get contextConfig(): ContextConfig {
        return this._serverContextConfig;
    }

    public set contextConfig(contextConfig: ContextConfig) {
        this._serverContextConfig = contextConfig;
    }

    public get configSettings(): Record<string, ContextConfig> {
        return this._serverConfigSettings;
    }

    public set configSettings(configSettings: Record<string, ContextConfig>) {
        this._serverConfigSettings = configSettings;
    }

    private getCaller(level: number): CallerContext {
        const frames = callsites();
        if (frames.length <= level) {
            return {};
        }
        const wrappedFrames: CallSite[] = frames.map((frame) => sourceMapSupport.wrapCallSite(frame as any));

        const stack = wrappedFrames.slice(level);

        return {
            [ContextKeyCaller.Stack]: stack.map((frame) => frame.toString()),
        };
    }

    constructor(options?: { name?: string; context?: Context; level?: Level; contextConfig?: ContextConfig; prettyPrint?: boolean }) {
        super(options);
    }

    public getLambdaEnvironmentContext() {
        return {
            [ContextKey.Lambda]: {
                [ContextKeyLambda.FunctionName]: process.env.AWS_LAMBDA_FUNCTION_NAME,
                [ContextKeyLambda.FunctionVersion]: process.env.AWS_LAMBDA_FUNCTION_VERSION,
                [ContextKeyLambda.ExecutionEnvironment]: process.env.AWS_EXECUTION_ENV,
                [ContextKeyLambda.LogGroupName]: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
                [ContextKeyLambda.LogStreamName]: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
                [ContextKeyLambda.FunctionMemorySize]: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
            },
            [ContextKey.Region]: process.env.AWS_DEFAULT_REGION,
            [ContextKey.NodeEnv]: process.env.NODE_ENV,
            [ContextKey.NodeConfigEnv]: process.env.NODE_CONFIG_ENV,
        };
    }

    public addLambdaContext(event?: APIGatewayProxyEventV2, context?: LambdaContext) {
        this.resetContext();
        const correlationId = event?.headers?.[ContextHeader.CorrelationId];
        if (correlationId) {
            this.setCorrelationId(correlationId);
        }

        this.addBaseContext(
            merge(
                {
                    [ContextKey.Lambda]: {
                        [ContextKeyLambda.RequestId]: context?.awsRequestId,
                        [ContextKeyLambda.FunctionName]: context?.functionName,
                        [ContextKeyLambda.FunctionVersion]: context?.functionVersion,
                        [ContextKeyLambda.LogGroupName]: context?.logGroupName,
                        [ContextKeyLambda.LogStreamName]: context?.logStreamName,
                        [ContextKeyLambda.FunctionMemorySize]: context?.memoryLimitInMB,
                        [ContextKeyLambda.RemainingTimeMs]: context?.getRemainingTimeInMillis?.(),
                        [ContextKeyLambda.Identity]: context?.identity,
                    },
                    [ContextKey.Http]: {
                        [ContextKeyHttp.Request]: {
                            [ContextKeyHttpRequest.Protocol]: event?.requestContext?.http?.protocol,
                            [ContextKeyHttpRequest.Host]: event?.requestContext?.domainName,
                            [ContextKeyHttpRequest.Path]: event?.rawPath,
                            [ContextKeyHttpRequest.Method]: event?.requestContext?.http?.method,
                            [ContextKeyHttpRequest.QueryString]: event?.rawQueryString,
                            [ContextKeyHttpRequest.SourceIp]: event?.requestContext?.http?.sourceIp,
                            [ContextKeyHttpRequest.UserAgent]: event?.requestContext?.http?.userAgent || event?.headers?.[ContextHeader.UserAgent],
                            [ContextKeyHttpRequest.Headers]: event?.headers as any,
                        },
                    },
                },
                this.getLambdaEnvironmentContext(),
            ),
        );

        this.info({ event }, 'lambda:trigger');
    }

    private parseSQSMessageAttributes(messageAttributes: SQSBatchMessageAttributes) {
        return {
            ...Object.entries(messageAttributes).reduce((result, attribute) => {
                let value: any;

                switch (attribute[1].DataType) {
                    case 'Number':
                        value = parseInt(attribute[1].StringValue || 'NaN');
                        break;
                    case 'Binary':
                        value = attribute[1].BinaryValue;
                        break;
                    case 'String':
                    default:
                        value = attribute[1].StringValue;
                        break;
                }

                const key = attribute[0];
                if ([ContextKey.Lambda, ContextKey.Http, ContextKey.Queue].includes(key as ContextKey)) {
                    result[key] = JSON.parse(value);
                } else {
                    result[key] = value;
                }

                return result;
            }, {} as any),
        };
    }

    public addSQSRecordContext(record: SQSRecord) {
        this.addBaseContext({
            [ContextKey.Queue]: {
                [ContextKeyQueue.Name]: process.env.QUEUE_NAME,
                [ContextKeyQueue.MessageId]: record?.messageId,
                [ContextKeyQueue.MessageGroupId]: record?.attributes?.MessageGroupId,
                [ContextKeyQueue.MessageApproximateReceiveCount]: record?.attributes?.ApproximateReceiveCount,
            },
            ...this.parseSQSMessageAttributes(this.sqsRecordMessageAttributesToBatchMessageAttributes(record?.messageAttributes)),
        });
    }

    protected sqsRecordMessageAttributesToBatchMessageAttributes(messageAttributes: SQSRecord['messageAttributes']): SQSBatchMessageAttributes {
        return Object.entries(messageAttributes).reduce((result, [key, sqsValue]) => {
            const value: MessageAttributeValue = {} as any;

            value.StringValue = sqsValue.stringValue;
            value.BinaryValue = sqsValue.binaryValue ? Uint8Array.from(Buffer.from(sqsValue.binaryValue)) : undefined;
            value.DataType = sqsValue.dataType;
            value.StringListValues = sqsValue.stringListValues;
            value.BinaryListValues = sqsValue.binaryListValues ? sqsValue.binaryListValues.map((value) => Uint8Array.from(Buffer.from(value))) : undefined;

            result[key] = value;
            return result;
        }, {} as SQSBatchMessageAttributes);
    }

    public writePartialContextToSQSMessageAttributes(): SQSBatchMessageAttributes {
        const httpContext = this.baseContextKey(ContextKey.Http);
        return {
            [ContextKey.CorrelationId]: {
                StringValue: this.correlationId(),
                DataType: 'String',
            },
            [ContextKey.Http]: {
                StringValue: httpContext
                    ? JSON.stringify({
                          [ContextKeyHttp.Request]: {
                              ...{
                                  ...httpContext[ContextKeyHttp.Request],
                                  [ContextKeyHttpRequest.Body]: undefined,
                                  [ContextKeyHttpRequest.Headers]: {
                                      origin: httpContext[ContextKeyHttp.Request][ContextKeyHttpRequest.Headers]?.origin,
                                      referer: httpContext[ContextKeyHttp.Request][ContextKeyHttpRequest.Headers]?.referer,
                                  },
                              },
                          },
                      })
                    : '{}',
                DataType: 'String',
            },
        };
    }

    public writePartialContextToBatchSQSMessageAttributes(): SQSBatchMessageAttributes {
        const httpContext = this.baseContextKey(ContextKey.Http);
        return {
            [ContextKey.CorrelationId]: {
                StringValue: this.correlationId(),
                DataType: 'String',
            },
            [ContextKey.Http]: {
                StringValue:
                    httpContext &&
                    JSON.stringify({
                        [ContextKeyHttp.Request]: {
                            [ContextKeyHttpRequest.UserAgent]: httpContext[ContextKeyHttpRequest.UserAgent],
                            [ContextKeyHttpRequest.SourceIp]: httpContext[ContextKeyHttpRequest.SourceIp],
                        },
                    }),
                DataType: 'String',
            },
        };
    }

    private addCallerContext() {
        this.addBaseContext({
            [ContextKey.CallerContext]: {
                ...this.getCaller(5),
                [ContextKeyCaller.LoggerName]: this.name,
            },
        });
    }

    private addTraceContext() {
        const span = api.trace.getActiveSpan();
        if (span && span.spanContext) {
            const { traceId } = span.spanContext();
            this.addTelemetryFields({
                traceId,
            });
        }
    }

    protected slimDownLocally(object: any): any {
        if (ContextKey.User in object && ContextKeyUser.Context in object[ContextKey.User]) {
            delete object[ContextKey.User][ContextKeyUser.Context];
        }
        if (
            ContextKey.Http in object &&
            ContextKeyHttp.Request in object[ContextKey.Http] &&
            ContextKeyHttpRequest.Headers in object[ContextKey.Http][ContextKeyHttp.Request]
        ) {
            delete object[ContextKey.Http][ContextKeyHttp.Request][ContextKeyHttpRequest.Headers];
        }
        if (
            ContextKey.CallerContext in object &&
            ContextKeyCaller.Stack in object[ContextKey.CallerContext] &&
            object[ContextKey.CallerContext][ContextKeyCaller.Stack].length > 2
        ) {
            object[ContextKey.CallerContext][ContextKeyCaller.Stack] = object[ContextKey.CallerContext][ContextKeyCaller.Stack].slice(0, 2);
        }
    }

    private levelToLogLevel(level: Level): string {
        switch (level) {
            case Level.Trace:
                return 'DEBUG';
            case Level.Debug:
                return 'DEBUG';
            case Level.Info:
                return 'INFO';
            case Level.Warn:
                return 'WARN';
            case Level.Error:
                return 'ERROR';
            case Level.Fatal:
                return 'ERROR';
            default:
                return 'DEBUG';
        }
    }

    private addLambdaKeys(level: Level, obj: BaseContext) {
        if (obj[ContextKey.Duration]) obj[ContextKey.LambdaDuration] = obj[ContextKey.Duration];
        if (obj[ContextKey.Message]) obj[ContextKey.LambdaMessage] = obj[ContextKey.Message];
        if (obj[ContextKey.Lambda]?.[ContextKeyLambda.RequestId]) obj[ContextKey.LambdaRequestId] = obj[ContextKey.Lambda]?.[ContextKeyLambda.RequestId];
        if (obj[ContextKey.Time]) obj[ContextKey.LambdaTimestamp] = obj[ContextKey.Time];
        return obj;
    }

    protected buildLogObject(level: Level, args: any[]): any {
        this.addCallerContext();
        this.addTraceContext();
        const obj = super.buildLogObject(level, args);
        this.addLambdaKeys(level, obj);
        if (isLocal()) this.slimDownLocally(obj);
        return obj;
    }
}
