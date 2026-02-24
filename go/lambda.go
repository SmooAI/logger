package logger

import (
	"context"
	"os"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambdacontext"
)

// LambdaLogger wraps Logger with Lambda-specific context helpers.
type LambdaLogger struct {
	*Logger
}

// NewLambdaLogger creates a LambdaLogger from an existing Logger.
func NewLambdaLogger(logger *Logger) *LambdaLogger {
	return &LambdaLogger{Logger: logger}
}

// AddLambdaContext extracts Lambda invocation context from the context.Context
// and adds it to the logger's base context. This includes the request ID,
// function name, function ARN, and memory limit.
func (l *LambdaLogger) AddLambdaContext(ctx context.Context) {
	lc, ok := lambdacontext.FromContext(ctx)
	if !ok {
		return
	}

	lambdaCtx := Map{
		"requestId":   lc.AwsRequestID,
		"functionArn": lc.InvokedFunctionArn,
	}

	if lc.Identity.CognitoIdentityID != "" {
		lambdaCtx["cognitoIdentityId"] = lc.Identity.CognitoIdentityID
	}

	l.AddBaseContext(Map{
		"lambda": lambdaCtx,
	})

	// Set correlation ID from Lambda request ID if not already set
	if l.CorrelationID() == "" || l.CorrelationID() == l.Context()[KeyRequestID] {
		l.SetCorrelationID(lc.AwsRequestID)
	}
}

// GetLambdaEnvironmentContext returns Lambda environment variables as a context map.
// This captures function name, version, region, memory size, and log group.
func GetLambdaEnvironmentContext() Map {
	ctx := make(Map)

	envVars := map[string]string{
		"functionName":    "AWS_LAMBDA_FUNCTION_NAME",
		"functionVersion": "AWS_LAMBDA_FUNCTION_VERSION",
		"region":          "AWS_REGION",
		"memorySize":      "AWS_LAMBDA_FUNCTION_MEMORY_SIZE",
		"logGroup":        "AWS_LAMBDA_LOG_GROUP_NAME",
		"logStream":       "AWS_LAMBDA_LOG_STREAM_NAME",
		"runtime":         "AWS_EXECUTION_ENV",
	}

	for key, envVar := range envVars {
		if val := os.Getenv(envVar); val != "" {
			ctx[key] = val
		}
	}

	return ctx
}

// AddLambdaEnvironmentContext adds Lambda environment variables to the logger context.
func (l *LambdaLogger) AddLambdaEnvironmentContext() {
	envCtx := GetLambdaEnvironmentContext()
	if len(envCtx) > 0 {
		l.AddBaseContext(Map{
			"lambdaEnvironment": envCtx,
		})
	}
}

// AddSQSRecordContext adds SQS message context to the logger, including
// message ID, event source, event source ARN, and receipt handle.
func (l *LambdaLogger) AddSQSRecordContext(record events.SQSMessage) {
	sqsCtx := Map{
		"messageId":     record.MessageId,
		"eventSource":   record.EventSource,
		"eventSourceArn": record.EventSourceARN,
	}

	if record.ReceiptHandle != "" {
		sqsCtx["receiptHandle"] = record.ReceiptHandle
	}

	for key, attr := range record.MessageAttributes {
		if attr.StringValue != nil {
			if _, ok := sqsCtx["attributes"]; !ok {
				sqsCtx["attributes"] = make(Map)
			}
			sqsCtx["attributes"].(Map)[key] = *attr.StringValue
		}
	}

	l.AddBaseContext(Map{
		"sqs": sqsCtx,
	})

	// Use SQS message ID as correlation ID
	if record.MessageId != "" {
		l.SetCorrelationID(record.MessageId)
	}
}

// AddAPIGatewayContext adds API Gateway request context to the logger.
func (l *LambdaLogger) AddAPIGatewayContext(request events.APIGatewayProxyRequest) {
	headers := make(map[string]string)
	for k, v := range request.Headers {
		headers[k] = v
	}

	l.AddHTTPRequest(HTTPRequest{
		Method:      request.HTTPMethod,
		Path:        request.Path,
		QueryString: request.QueryStringParameters["q"],
		SourceIP:    request.RequestContext.Identity.SourceIP,
		UserAgent:   request.RequestContext.Identity.UserAgent,
		Headers:     headers,
		Body:        request.Body,
	})

	apiCtx := Map{
		"requestId": request.RequestContext.RequestID,
		"stage":     request.RequestContext.Stage,
		"apiId":     request.RequestContext.APIID,
	}

	l.AddBaseContext(Map{
		"apiGateway": apiCtx,
	})

	if request.RequestContext.RequestID != "" {
		l.SetCorrelationID(request.RequestContext.RequestID)
	}
}

// SlimDownLocally removes verbose context when running locally (IS_LOCAL env).
// This keeps log output readable during local development by stripping
// Lambda environment details, API Gateway metadata, and SQS receipt handles.
func (l *LambdaLogger) SlimDownLocally() {
	if !IsLocal() {
		return
	}

	ctx := l.Context()

	// Remove verbose Lambda environment context
	delete(ctx, "lambdaEnvironment")

	// Slim down SQS context
	if sqs, ok := ctx["sqs"].(Map); ok {
		delete(sqs, "receiptHandle")
		delete(sqs, "eventSourceArn")
	}

	// Slim down API Gateway context
	delete(ctx, "apiGateway")

	l.SetContext(ctx)
}
