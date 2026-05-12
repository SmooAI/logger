using System.Collections.Generic;
using System.Linq;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;

namespace SmooAI.Logger;

/// <summary>
/// Lambda / ECS / SQS / API Gateway context helpers on top of <see cref="SmooLogger"/>.
/// Mirrors the TS <c>AwsServerLogger</c>, Python <c>AwsServerLogger</c>, and Go
/// <c>LambdaLogger</c> ports — call the appropriate <c>Add*Context</c> method
/// inside your Lambda handler and the invocation/event metadata lands on every
/// log entry until the context is reset.
/// </summary>
public class AwsServerLogger : SmooLogger
{
    public AwsServerLogger() : this(new SmooLoggerOptions { Name = "AwsServerLogger" }) { }

    public AwsServerLogger(SmooLoggerOptions options) : base(options) { }

    /// <summary>
    /// Capture Lambda environment variables (function name, version, log group,
    /// memory size, region, NODE_ENV) into the logger's base context.
    /// </summary>
    public void AddLambdaEnvironmentContext()
    {
        var lambdaBag = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        AddIfPresent(lambdaBag, "functionName", "AWS_LAMBDA_FUNCTION_NAME");
        AddIfPresent(lambdaBag, "functionVersion", "AWS_LAMBDA_FUNCTION_VERSION");
        AddIfPresent(lambdaBag, "executionEnv", "AWS_EXECUTION_ENV");
        AddIfPresent(lambdaBag, "logGroupName", "AWS_LAMBDA_LOG_GROUP_NAME");
        AddIfPresent(lambdaBag, "logStreamName", "AWS_LAMBDA_LOG_STREAM_NAME");
        AddIfPresent(lambdaBag, "memorySizeMB", "AWS_LAMBDA_FUNCTION_MEMORY_SIZE");

        var root = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        if (lambdaBag.Count > 0)
        {
            root["awsLambda"] = lambdaBag;
        }
        var region = System.Environment.GetEnvironmentVariable("AWS_DEFAULT_REGION")
                     ?? System.Environment.GetEnvironmentVariable("AWS_REGION");
        if (!string.IsNullOrEmpty(region)) root["region"] = region;
        var nodeEnv = System.Environment.GetEnvironmentVariable("NODE_ENV");
        if (!string.IsNullOrEmpty(nodeEnv)) root["nodeEnv"] = nodeEnv;

        if (root.Count > 0)
        {
            AddBaseContext(root);
        }
    }

    /// <summary>
    /// Capture ECS / Fargate task metadata env vars under the <c>ecs</c> key.
    /// Always safe to call — values absent in non-ECS environments are skipped.
    /// </summary>
    public void AddECSContext()
    {
        var ecs = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        AddIfPresent(ecs, "containerCredentialsRelativeUri", "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI");
        AddIfPresent(ecs, "containerMetadataUriV4", "ECS_CONTAINER_METADATA_URI_V4");
        AddIfPresent(ecs, "containerMetadataUri", "ECS_CONTAINER_METADATA_URI");
        AddIfPresent(ecs, "agentUri", "ECS_AGENT_URI");
        AddIfPresent(ecs, "executionEnv", "AWS_EXECUTION_ENV");
        AddIfPresent(ecs, "defaultRegion", "AWS_DEFAULT_REGION");
        AddIfPresent(ecs, "region", "AWS_REGION");

        if (ecs.Count > 0)
        {
            AddBaseContext(new Dictionary<string, object?>(System.StringComparer.Ordinal)
            {
                ["ecs"] = ecs,
            });
        }
    }

    /// <summary>
    /// Attach Lambda invocation context (AWS request ID, function ARN, remaining
    /// time, identity) plus the environment context to the logger. Also sets
    /// the correlation ID to the AWS request ID.
    /// </summary>
    public void AddLambdaContext(ILambdaContext context)
    {
        System.ArgumentNullException.ThrowIfNull(context);

        var lambdaBag = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        if (!string.IsNullOrEmpty(context.AwsRequestId))
            lambdaBag["requestId"] = context.AwsRequestId;
        if (!string.IsNullOrEmpty(context.FunctionName))
            lambdaBag["functionName"] = context.FunctionName;
        if (!string.IsNullOrEmpty(context.FunctionVersion))
            lambdaBag["functionVersion"] = context.FunctionVersion;
        if (!string.IsNullOrEmpty(context.InvokedFunctionArn))
            lambdaBag["functionArn"] = context.InvokedFunctionArn;
        if (!string.IsNullOrEmpty(context.LogGroupName))
            lambdaBag["logGroupName"] = context.LogGroupName;
        if (!string.IsNullOrEmpty(context.LogStreamName))
            lambdaBag["logStreamName"] = context.LogStreamName;
        if (context.MemoryLimitInMB > 0)
            lambdaBag["memorySizeMB"] = context.MemoryLimitInMB;
        lambdaBag["remainingTimeMs"] = (long)context.RemainingTime.TotalMilliseconds;

        AddBaseContext(new Dictionary<string, object?>(System.StringComparer.Ordinal)
        {
            ["awsLambda"] = lambdaBag,
        });

        AddLambdaEnvironmentContext();

        if (!string.IsNullOrEmpty(context.AwsRequestId))
        {
            SetCorrelationId(context.AwsRequestId);
        }
    }

    /// <summary>
    /// Attach SQS record context (message ID, event source/ARN, receipt handle,
    /// and string-valued message attributes) under the <c>sqs</c> key. Also sets
    /// the correlation ID to the SQS message ID.
    /// </summary>
    public void AddSqsRecordContext(SQSEvent.SQSMessage record)
    {
        System.ArgumentNullException.ThrowIfNull(record);
        var sqs = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        if (!string.IsNullOrEmpty(record.MessageId)) sqs["messageId"] = record.MessageId;
        if (!string.IsNullOrEmpty(record.EventSource)) sqs["eventSource"] = record.EventSource;
        if (!string.IsNullOrEmpty(record.EventSourceArn)) sqs["eventSourceArn"] = record.EventSourceArn;
        if (!string.IsNullOrEmpty(record.ReceiptHandle)) sqs["receiptHandle"] = record.ReceiptHandle;

        if (record.MessageAttributes != null && record.MessageAttributes.Count > 0)
        {
            var attrs = new Dictionary<string, object?>(System.StringComparer.Ordinal);
            foreach (var (key, attr) in record.MessageAttributes)
            {
                if (attr == null) continue;
                if (!string.IsNullOrEmpty(attr.StringValue))
                {
                    attrs[key] = attr.StringValue;
                }
            }
            if (attrs.Count > 0)
            {
                sqs["attributes"] = attrs;
            }
        }

        AddBaseContext(new Dictionary<string, object?>(System.StringComparer.Ordinal)
        {
            ["sqs"] = sqs,
        });

        if (!string.IsNullOrEmpty(record.MessageId))
        {
            SetCorrelationId(record.MessageId);
        }
    }

    /// <summary>
    /// Attach API Gateway proxy request context (method, path, query string,
    /// headers, source IP, user agent) and the API Gateway stage/requestId/apiId
    /// to the logger. Also sets the correlation ID to the API Gateway request ID.
    /// </summary>
    public void AddApiGatewayContext(APIGatewayProxyRequest request)
    {
        System.ArgumentNullException.ThrowIfNull(request);
        var http = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        if (!string.IsNullOrEmpty(request.HttpMethod)) http["method"] = request.HttpMethod;
        if (!string.IsNullOrEmpty(request.Path)) http["path"] = request.Path;
        if (request.RequestContext?.Identity != null)
        {
            if (!string.IsNullOrEmpty(request.RequestContext.Identity.SourceIp))
                http["sourceIp"] = request.RequestContext.Identity.SourceIp;
            if (!string.IsNullOrEmpty(request.RequestContext.Identity.UserAgent))
                http["userAgent"] = request.RequestContext.Identity.UserAgent;
        }
        if (request.Headers != null && request.Headers.Count > 0)
        {
            http["headers"] = request.Headers.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
        }
        if (request.QueryStringParameters != null && request.QueryStringParameters.Count > 0)
        {
            var qs = string.Join("&", request.QueryStringParameters.Select(kv => $"{kv.Key}={kv.Value}"));
            if (!string.IsNullOrEmpty(qs)) http["queryString"] = qs;
        }
        if (!string.IsNullOrEmpty(request.Body)) http["body"] = request.Body;

        var apiGateway = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        if (request.RequestContext != null)
        {
            if (!string.IsNullOrEmpty(request.RequestContext.RequestId))
                apiGateway["requestId"] = request.RequestContext.RequestId;
            if (!string.IsNullOrEmpty(request.RequestContext.Stage))
                apiGateway["stage"] = request.RequestContext.Stage;
            if (!string.IsNullOrEmpty(request.RequestContext.ApiId))
                apiGateway["apiId"] = request.RequestContext.ApiId;
            if (!string.IsNullOrEmpty(request.RequestContext.ResourcePath))
                apiGateway["resourcePath"] = request.RequestContext.ResourcePath;
        }

        var root = new Dictionary<string, object?>(System.StringComparer.Ordinal);
        if (http.Count > 0)
        {
            root[ContextKey.Http] = new Dictionary<string, object?>(System.StringComparer.Ordinal)
            {
                ["request"] = http,
            };
        }
        if (apiGateway.Count > 0)
        {
            root["apiGateway"] = apiGateway;
        }
        if (root.Count > 0)
        {
            AddBaseContext(root);
        }

        var correlationId = request.RequestContext?.RequestId;
        if (!string.IsNullOrEmpty(correlationId))
        {
            SetCorrelationId(correlationId);
        }
    }

    private static void AddIfPresent(Dictionary<string, object?> bag, string key, string envVar)
    {
        var value = System.Environment.GetEnvironmentVariable(envVar);
        if (!string.IsNullOrEmpty(value))
        {
            bag[key] = value;
        }
    }
}
