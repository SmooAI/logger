using System.Text.Json;
using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;
using Amazon.Lambda.SQSEvents;
using SmooAI.Logger;

namespace SmooAI.Logger.Tests;

public class AwsServerLoggerTests
{
    private static (AwsServerLogger Logger, StringWriter Out) Build(Action<SmooLoggerOptions>? configure = null)
    {
        var writer = new StringWriter();
        var opts = new SmooLoggerOptions { Output = writer, PrettyPrint = false, Name = "aws-test" };
        configure?.Invoke(opts);
        return (new AwsServerLogger(opts), writer);
    }

    private static JsonElement ParseSingle(string captured)
    {
        var line = captured.Split('\n', StringSplitOptions.RemoveEmptyEntries)[0];
        return JsonDocument.Parse(line).RootElement;
    }

    [Fact]
    public void AddECSContext_Reads_Env_Vars_Into_Ecs_Bag()
    {
        Environment.SetEnvironmentVariable("ECS_CONTAINER_METADATA_URI_V4", "http://169.254.170.2/v4/abc");
        Environment.SetEnvironmentVariable("AWS_EXECUTION_ENV", "AWS_ECS_FARGATE");
        Environment.SetEnvironmentVariable("AWS_REGION", "us-east-1");
        try
        {
            var (logger, writer) = Build();
            logger.AddECSContext();
            logger.LogInfo("running");
            var entry = ParseSingle(writer.ToString());

            var ecs = entry.GetProperty("ecs");
            Assert.Equal("http://169.254.170.2/v4/abc", ecs.GetProperty("containerMetadataUriV4").GetString());
            Assert.Equal("AWS_ECS_FARGATE", ecs.GetProperty("executionEnv").GetString());
            Assert.Equal("us-east-1", ecs.GetProperty("region").GetString());
        }
        finally
        {
            Environment.SetEnvironmentVariable("ECS_CONTAINER_METADATA_URI_V4", null);
            Environment.SetEnvironmentVariable("AWS_EXECUTION_ENV", null);
            Environment.SetEnvironmentVariable("AWS_REGION", null);
        }
    }

    [Fact]
    public void AddLambdaEnvironmentContext_Reads_Lambda_Env()
    {
        Environment.SetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME", "test-fn");
        Environment.SetEnvironmentVariable("AWS_LAMBDA_FUNCTION_VERSION", "$LATEST");
        Environment.SetEnvironmentVariable("AWS_LAMBDA_LOG_GROUP_NAME", "/aws/lambda/test-fn");
        Environment.SetEnvironmentVariable("AWS_REGION", "us-west-2");
        try
        {
            var (logger, writer) = Build();
            logger.AddLambdaEnvironmentContext();
            logger.LogInfo("hi");
            var entry = ParseSingle(writer.ToString());

            var lambda = entry.GetProperty("awsLambda");
            Assert.Equal("test-fn", lambda.GetProperty("functionName").GetString());
            Assert.Equal("$LATEST", lambda.GetProperty("functionVersion").GetString());
            Assert.Equal("/aws/lambda/test-fn", lambda.GetProperty("logGroupName").GetString());
            Assert.Equal("us-west-2", entry.GetProperty("region").GetString());
        }
        finally
        {
            Environment.SetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME", null);
            Environment.SetEnvironmentVariable("AWS_LAMBDA_FUNCTION_VERSION", null);
            Environment.SetEnvironmentVariable("AWS_LAMBDA_LOG_GROUP_NAME", null);
            Environment.SetEnvironmentVariable("AWS_REGION", null);
        }
    }

    [Fact]
    public void AddLambdaContext_Captures_Invocation_Metadata_And_Correlation_Id()
    {
        var (logger, writer) = Build();
        var lambdaContext = new TestLambdaContext
        {
            AwsRequestId = "req-abc-123",
            FunctionName = "fn-x",
            FunctionVersion = "42",
            InvokedFunctionArn = "arn:aws:lambda:us-east-1:1234:function:fn-x",
            LogGroupName = "/aws/lambda/fn-x",
            LogStreamName = "stream-1",
            MemoryLimitInMB = 256,
            RemainingTime = TimeSpan.FromSeconds(30),
        };
        logger.AddLambdaContext(lambdaContext);
        logger.LogInfo("invoked");
        var entry = ParseSingle(writer.ToString());

        var lambda = entry.GetProperty("awsLambda");
        Assert.Equal("req-abc-123", lambda.GetProperty("requestId").GetString());
        Assert.Equal("fn-x", lambda.GetProperty("functionName").GetString());
        Assert.Equal("arn:aws:lambda:us-east-1:1234:function:fn-x", lambda.GetProperty("functionArn").GetString());
        Assert.Equal("req-abc-123", entry.GetProperty("correlationId").GetString());
    }

    [Fact]
    public void AddSqsRecordContext_Captures_Message_Metadata_And_Sets_Correlation_Id()
    {
        var (logger, writer) = Build();
        var record = new SQSEvent.SQSMessage
        {
            MessageId = "msg-abc",
            EventSource = "aws:sqs",
            EventSourceArn = "arn:aws:sqs:us-east-1:1234:test-queue",
            ReceiptHandle = "rh-xxx",
            MessageAttributes = new Dictionary<string, SQSEvent.MessageAttribute>
            {
                ["CustomAttr"] = new SQSEvent.MessageAttribute { DataType = "String", StringValue = "value-1" },
            },
        };
        logger.AddSqsRecordContext(record);
        logger.LogInfo("sqs received");
        var entry = ParseSingle(writer.ToString());

        var sqs = entry.GetProperty("sqs");
        Assert.Equal("msg-abc", sqs.GetProperty("messageId").GetString());
        Assert.Equal("aws:sqs", sqs.GetProperty("eventSource").GetString());
        Assert.Equal("arn:aws:sqs:us-east-1:1234:test-queue", sqs.GetProperty("eventSourceArn").GetString());
        Assert.Equal("value-1", sqs.GetProperty("attributes").GetProperty("CustomAttr").GetString());
        Assert.Equal("msg-abc", entry.GetProperty("correlationId").GetString());
    }

    [Fact]
    public void AddApiGatewayContext_Captures_Http_Request_And_Sets_Correlation_Id()
    {
        var (logger, writer) = Build();
        var request = new APIGatewayProxyRequest
        {
            HttpMethod = "POST",
            Path = "/things/42",
            Headers = new Dictionary<string, string>
            {
                ["Authorization"] = "Bearer leak-me",
                ["User-Agent"] = "smoo/1.0",
            },
            QueryStringParameters = new Dictionary<string, string> { ["foo"] = "bar" },
            RequestContext = new APIGatewayProxyRequest.ProxyRequestContext
            {
                RequestId = "apigw-req-1",
                Stage = "prod",
                ApiId = "api123",
            },
        };
        logger.AddApiGatewayContext(request);
        logger.LogInfo("apigw");
        var entry = ParseSingle(writer.ToString());

        var http = entry.GetProperty("http").GetProperty("request");
        Assert.Equal("POST", http.GetProperty("method").GetString());
        Assert.Equal("/things/42", http.GetProperty("path").GetString());
        // SMOODEV-942 redaction is applied — Authorization should be redacted
        Assert.Equal(SmooLogger.RedactedValue, http.GetProperty("headers").GetProperty("Authorization").GetString());
        Assert.Equal("smoo/1.0", http.GetProperty("headers").GetProperty("User-Agent").GetString());

        var apigw = entry.GetProperty("apiGateway");
        Assert.Equal("apigw-req-1", apigw.GetProperty("requestId").GetString());
        Assert.Equal("prod", apigw.GetProperty("stage").GetString());
        Assert.Equal("api123", apigw.GetProperty("apiId").GetString());

        Assert.Equal("apigw-req-1", entry.GetProperty("correlationId").GetString());
    }

    /// <summary>
    /// Minimal ILambdaContext stub for unit tests. Amazon.Lambda.TestUtilities
    /// would add a test-only dep — easier to roll our own.
    /// </summary>
    private sealed class TestLambdaContext : ILambdaContext
    {
        public string AwsRequestId { get; set; } = string.Empty;
        public IClientContext ClientContext { get; set; } = null!;
        public string FunctionName { get; set; } = string.Empty;
        public string FunctionVersion { get; set; } = string.Empty;
        public ICognitoIdentity Identity { get; set; } = null!;
        public string InvokedFunctionArn { get; set; } = string.Empty;
        public ILambdaLogger Logger { get; set; } = null!;
        public string LogGroupName { get; set; } = string.Empty;
        public string LogStreamName { get; set; } = string.Empty;
        public int MemoryLimitInMB { get; set; }
        public TimeSpan RemainingTime { get; set; }
    }
}
