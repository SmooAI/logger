package logger

import (
	"context"
	"os"
	"testing"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambdacontext"
)

func TestNewLambdaLogger(t *testing.T) {
	resetGlobalContext()
	l := Default()
	ll := NewLambdaLogger(l)

	if ll.Logger != l {
		t.Error("LambdaLogger should wrap the provided Logger")
	}
	if ll.Name() != l.Name() {
		t.Errorf("LambdaLogger name = %q, want %q", ll.Name(), l.Name())
	}
}

func TestAddLambdaContext(t *testing.T) {
	resetGlobalContext()
	l := Default()
	ll := NewLambdaLogger(l)

	ctx := lambdacontext.NewContext(context.Background(), &lambdacontext.LambdaContext{
		AwsRequestID:       "req-123",
		InvokedFunctionArn: "arn:aws:lambda:us-east-1:123:function:test",
	})

	ll.AddLambdaContext(ctx)

	logCtx := ll.Context()
	lambdaMap, ok := logCtx["lambda"].(Map)
	if !ok {
		t.Fatal("lambda context should be present")
	}
	if lambdaMap["requestId"] != "req-123" {
		t.Errorf("lambda.requestId = %v, want %q", lambdaMap["requestId"], "req-123")
	}
	if lambdaMap["functionArn"] != "arn:aws:lambda:us-east-1:123:function:test" {
		t.Errorf("lambda.functionArn = %v, want ARN", lambdaMap["functionArn"])
	}
}

func TestAddLambdaContextNoContext(t *testing.T) {
	resetGlobalContext()
	l := Default()
	ll := NewLambdaLogger(l)

	// Plain context without Lambda context should not panic
	ll.AddLambdaContext(context.Background())

	logCtx := ll.Context()
	if _, ok := logCtx["lambda"]; ok {
		t.Error("lambda context should not be present without Lambda context")
	}
}

func TestGetLambdaEnvironmentContext(t *testing.T) {
	os.Setenv("AWS_LAMBDA_FUNCTION_NAME", "test-function")
	os.Setenv("AWS_REGION", "us-east-1")
	os.Setenv("AWS_LAMBDA_FUNCTION_MEMORY_SIZE", "128")
	defer func() {
		os.Unsetenv("AWS_LAMBDA_FUNCTION_NAME")
		os.Unsetenv("AWS_REGION")
		os.Unsetenv("AWS_LAMBDA_FUNCTION_MEMORY_SIZE")
	}()

	envCtx := GetLambdaEnvironmentContext()

	if envCtx["functionName"] != "test-function" {
		t.Errorf("functionName = %v, want %q", envCtx["functionName"], "test-function")
	}
	if envCtx["region"] != "us-east-1" {
		t.Errorf("region = %v, want %q", envCtx["region"], "us-east-1")
	}
	if envCtx["memorySize"] != "128" {
		t.Errorf("memorySize = %v, want %q", envCtx["memorySize"], "128")
	}
}

func TestAddLambdaEnvironmentContext(t *testing.T) {
	resetGlobalContext()
	os.Setenv("AWS_LAMBDA_FUNCTION_NAME", "my-func")
	defer os.Unsetenv("AWS_LAMBDA_FUNCTION_NAME")

	l := Default()
	ll := NewLambdaLogger(l)
	ll.AddLambdaEnvironmentContext()

	logCtx := ll.Context()
	envMap, ok := logCtx["lambdaEnvironment"].(Map)
	if !ok {
		t.Fatal("lambdaEnvironment context should be present")
	}
	if envMap["functionName"] != "my-func" {
		t.Errorf("functionName = %v, want %q", envMap["functionName"], "my-func")
	}
}

func TestAddSQSRecordContext(t *testing.T) {
	resetGlobalContext()
	l := Default()
	ll := NewLambdaLogger(l)

	strVal := "test-value"
	record := events.SQSMessage{
		MessageId:      "msg-456",
		EventSource:    "aws:sqs",
		EventSourceARN: "arn:aws:sqs:us-east-1:123:my-queue",
		ReceiptHandle:  "receipt-handle-abc",
		MessageAttributes: map[string]events.SQSMessageAttribute{
			"customKey": {
				DataType:    "String",
				StringValue: &strVal,
			},
		},
	}

	ll.AddSQSRecordContext(record)

	logCtx := ll.Context()
	sqsMap, ok := logCtx["sqs"].(Map)
	if !ok {
		t.Fatal("sqs context should be present")
	}
	if sqsMap["messageId"] != "msg-456" {
		t.Errorf("sqs.messageId = %v, want %q", sqsMap["messageId"], "msg-456")
	}
	if sqsMap["eventSource"] != "aws:sqs" {
		t.Errorf("sqs.eventSource = %v, want %q", sqsMap["eventSource"], "aws:sqs")
	}

	// Check correlation ID was set from message ID
	if ll.CorrelationID() != "msg-456" {
		t.Errorf("correlationId = %q, want %q", ll.CorrelationID(), "msg-456")
	}

	// Check message attributes
	attrs, ok := sqsMap["attributes"].(Map)
	if !ok {
		t.Fatal("sqs.attributes should be present")
	}
	if attrs["customKey"] != "test-value" {
		t.Errorf("sqs.attributes.customKey = %v, want %q", attrs["customKey"], "test-value")
	}
}

func TestAddAPIGatewayContext(t *testing.T) {
	resetGlobalContext()
	l := Default()
	ll := NewLambdaLogger(l)

	request := events.APIGatewayProxyRequest{
		HTTPMethod: "POST",
		Path:       "/api/users",
		Headers: map[string]string{
			"Content-Type": "application/json",
		},
		RequestContext: events.APIGatewayProxyRequestContext{
			RequestID: "gw-req-789",
			Stage:     "prod",
			APIID:     "api-123",
			Identity: events.APIGatewayRequestIdentity{
				SourceIP:  "10.0.0.1",
				UserAgent: "test-agent",
			},
		},
	}

	ll.AddAPIGatewayContext(request)

	logCtx := ll.Context()

	// Check namespace was set
	if logCtx[KeyNamespace] != "POST /api/users" {
		t.Errorf("namespace = %v, want %q", logCtx[KeyNamespace], "POST /api/users")
	}

	// Check API Gateway context
	apiCtx, ok := logCtx["apiGateway"].(Map)
	if !ok {
		t.Fatal("apiGateway context should be present")
	}
	if apiCtx["requestId"] != "gw-req-789" {
		t.Errorf("apiGateway.requestId = %v, want %q", apiCtx["requestId"], "gw-req-789")
	}
	if apiCtx["stage"] != "prod" {
		t.Errorf("apiGateway.stage = %v, want %q", apiCtx["stage"], "prod")
	}

	// Check correlation ID was set
	if ll.CorrelationID() != "gw-req-789" {
		t.Errorf("correlationId = %q, want %q", ll.CorrelationID(), "gw-req-789")
	}
}

func TestSlimDownLocally(t *testing.T) {
	resetGlobalContext()
	os.Setenv("IS_LOCAL", "true")
	defer os.Unsetenv("IS_LOCAL")

	l := Default()
	ll := NewLambdaLogger(l)

	// Add verbose context
	ll.AddBaseContext(Map{
		"lambdaEnvironment": Map{"functionName": "test"},
		"apiGateway":        Map{"stage": "dev"},
		"sqs": Map{
			"messageId":      "msg-1",
			"receiptHandle":  "long-handle",
			"eventSourceArn": "arn:long",
		},
		KeyNamespace: "POST /api",
	})

	ll.SlimDownLocally()

	logCtx := ll.Context()

	if _, ok := logCtx["lambdaEnvironment"]; ok {
		t.Error("lambdaEnvironment should be removed locally")
	}
	if _, ok := logCtx["apiGateway"]; ok {
		t.Error("apiGateway should be removed locally")
	}

	if sqs, ok := logCtx["sqs"].(Map); ok {
		if _, ok := sqs["receiptHandle"]; ok {
			t.Error("sqs.receiptHandle should be removed locally")
		}
		if sqs["messageId"] != "msg-1" {
			t.Error("sqs.messageId should be kept")
		}
	}
}

func TestSlimDownLocallyNoOpInProduction(t *testing.T) {
	resetGlobalContext()
	os.Unsetenv("IS_LOCAL")
	os.Unsetenv("SST_DEV")
	os.Setenv("IS_DEPLOYED_STAGE", "true")
	defer os.Unsetenv("IS_DEPLOYED_STAGE")

	l := Default()
	ll := NewLambdaLogger(l)
	ll.AddBaseContext(Map{
		"lambdaEnvironment": Map{"functionName": "test"},
	})

	ll.SlimDownLocally()

	logCtx := ll.Context()
	if _, ok := logCtx["lambdaEnvironment"]; !ok {
		t.Error("lambdaEnvironment should NOT be removed in production")
	}
}

func TestLambdaLoggerChainsWithBaseLogger(t *testing.T) {
	resetGlobalContext()
	l := Default()
	ll := NewLambdaLogger(l)

	// Should be able to use all base Logger methods
	ll.SetName("LambdaTest")
	ll.AddContext(Map{"key": "value"})

	if ll.Name() != "LambdaTest" {
		t.Errorf("Name() = %q, want %q", ll.Name(), "LambdaTest")
	}

	logCtx := ll.Context()
	nested, ok := logCtx[KeyContext].(Map)
	if !ok {
		t.Fatal("context should have nested map")
	}
	if nested["key"] != "value" {
		t.Errorf("context.key = %v, want %q", nested["key"], "value")
	}
}
