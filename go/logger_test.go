package logger

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

func TestLevelString(t *testing.T) {
	tests := []struct {
		level Level
		want  string
	}{
		{LevelTrace, "trace"},
		{LevelDebug, "debug"},
		{LevelInfo, "info"},
		{LevelWarn, "warn"},
		{LevelError, "error"},
		{LevelFatal, "fatal"},
	}
	for _, tt := range tests {
		if got := tt.level.String(); got != tt.want {
			t.Errorf("Level(%d).String() = %q, want %q", tt.level, got, tt.want)
		}
	}
}

func TestParseLevel(t *testing.T) {
	tests := []struct {
		input string
		want  Level
	}{
		{"trace", LevelTrace},
		{"TRACE", LevelTrace},
		{"debug", LevelDebug},
		{"info", LevelInfo},
		{"warn", LevelWarn},
		{"warning", LevelWarn},
		{"error", LevelError},
		{"fatal", LevelFatal},
		{"invalid", LevelInfo},
		{"", LevelInfo},
	}
	for _, tt := range tests {
		if got := ParseLevel(tt.input); got != tt.want {
			t.Errorf("ParseLevel(%q) = %d, want %d", tt.input, got, tt.want)
		}
	}
}

func TestDefaultLogger(t *testing.T) {
	resetGlobalContext()
	l := Default()
	if l.Name() != "Logger" {
		t.Errorf("Default name = %q, want %q", l.Name(), "Logger")
	}
	if l.GetLevel() != LevelInfo {
		t.Errorf("Default level = %d, want %d", l.GetLevel(), LevelInfo)
	}
}

func TestLoggerLevelFiltering(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false

	_ = l.Debug("should not appear")
	if buf.Len() > 0 {
		t.Error("Debug message should not appear when level is Info")
	}

	_ = l.Info("should appear")
	if buf.Len() == 0 {
		t.Error("Info message should appear when level is Info")
	}
}

func TestLogOutput(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false

	_ = l.Info("test message", Map{"key": "value"})

	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("Failed to parse log output: %v", err)
	}

	if payload[KeyMessage] != "test message" {
		t.Errorf("msg = %v, want %q", payload[KeyMessage], "test message")
	}
	if payload[KeyLogLevel] != "info" {
		t.Errorf("LogLevel = %v, want %q", payload[KeyLogLevel], "info")
	}
	if payload[KeyName] != "Logger" {
		t.Errorf("name = %v, want %q", payload[KeyName], "Logger")
	}
	if _, ok := payload[KeyTime]; !ok {
		t.Error("time field is missing")
	}
	if _, ok := payload[KeyCorrelationID]; !ok {
		t.Error("correlationId field is missing")
	}

	ctx, ok := payload[KeyContext].(map[string]any)
	if !ok {
		t.Fatal("context field is missing or wrong type")
	}
	if ctx["key"] != "value" {
		t.Errorf("context.key = %v, want %q", ctx["key"], "value")
	}
}

func TestLogWithError(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false

	testErr := fmt.Errorf("something went wrong")
	_ = l.Error("operation failed", testErr)

	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("Failed to parse log output: %v", err)
	}

	if payload[KeyError] != "something went wrong" {
		t.Errorf("error = %v, want %q", payload[KeyError], "something went wrong")
	}
	if payload[KeyMessage] != "operation failed" {
		t.Errorf("msg = %v, want %q", payload[KeyMessage], "operation failed")
	}
	details, ok := payload[KeyErrorDetails].([]any)
	if !ok || len(details) == 0 {
		t.Fatal("errorDetails field is missing or empty")
	}
	detail, ok := details[0].(map[string]any)
	if !ok {
		t.Fatal("errorDetails[0] is wrong type")
	}
	if detail["message"] != "something went wrong" {
		t.Errorf("errorDetails[0].message = %v, want %q", detail["message"], "something went wrong")
	}
}

func TestCorrelationID(t *testing.T) {
	resetGlobalContext()
	l := Default()

	id := l.CorrelationID()
	if id == "" {
		t.Error("initial correlationId should not be empty")
	}

	l.SetCorrelationID("test-id-123")
	if got := l.CorrelationID(); got != "test-id-123" {
		t.Errorf("correlationId = %q, want %q", got, "test-id-123")
	}

	ctx := l.Context()
	if ctx[KeyRequestID] != "test-id-123" {
		t.Errorf("requestId = %v, want %q", ctx[KeyRequestID], "test-id-123")
	}
	if ctx[KeyTraceID] != "test-id-123" {
		t.Errorf("traceId = %v, want %q", ctx[KeyTraceID], "test-id-123")
	}
}

func TestAddHTTPRequest(t *testing.T) {
	resetGlobalContext()
	l := Default()

	l.AddHTTPRequest(HTTPRequest{
		Method: "GET",
		Path:   "/api/users",
		Headers: map[string]string{
			"X-Correlation-Id": "http-corr-123",
		},
	})

	ctx := l.Context()
	if ctx[KeyNamespace] != "GET /api/users" {
		t.Errorf("namespace = %v, want %q", ctx[KeyNamespace], "GET /api/users")
	}
	if ctx[KeyCorrelationID] != "http-corr-123" {
		t.Errorf("correlationId = %v, want %q", ctx[KeyCorrelationID], "http-corr-123")
	}
}

func TestAddUserContext(t *testing.T) {
	resetGlobalContext()
	l := Default()

	l.AddUserContext(User{
		ID:   "user-456",
		Role: "admin",
	})

	ctx := l.Context()
	user, ok := ctx[KeyUser].(Map)
	if !ok {
		t.Fatal("user context is missing or wrong type")
	}
	if user["id"] != "user-456" {
		t.Errorf("user.id = %v, want %q", user["id"], "user-456")
	}
	if user["role"] != "admin" {
		t.Errorf("user.role = %v, want %q", user["role"], "admin")
	}
}

func TestContextSharing(t *testing.T) {
	resetGlobalContext()
	l1 := Default()
	l2 := Default()

	l1.AddContext(Map{"shared": "value"})

	ctx2 := l2.Context()
	nested, ok := ctx2[KeyContext].(Map)
	if !ok {
		t.Fatal("context field is missing from second logger")
	}
	if nested["shared"] != "value" {
		t.Errorf("shared context = %v, want %q", nested["shared"], "value")
	}
}

func TestAllLogLevels(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false
	l.level = LevelTrace

	methods := []struct {
		fn    func(string, ...any) error
		level string
	}{
		{l.Trace, "trace"},
		{l.Debug, "debug"},
		{l.Info, "info"},
		{l.Warn, "warn"},
		{l.Error, "error"},
		{l.Fatal, "fatal"},
	}

	for _, m := range methods {
		buf.Reset()
		resetGlobalContext()
		_ = m.fn("test")
		var payload map[string]any
		if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
			t.Fatalf("Failed to parse %s log output: %v", m.level, err)
		}
		if payload[KeyLogLevel] != m.level {
			t.Errorf("level = %v, want %q", payload[KeyLogLevel], m.level)
		}
	}
}

func TestPrettyOutput(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = true

	_ = l.Info("pretty test")
	output := buf.String()

	if !strings.Contains(output, "pretty test") {
		t.Error("pretty output should contain the message")
	}
	if !strings.Contains(output, separator) {
		t.Error("pretty output should contain separator lines")
	}
}

func TestEnvFunctions(t *testing.T) {
	os.Setenv("SST_DEV", "true")
	if !IsLocal() {
		t.Error("IsLocal should return true when SST_DEV is set")
	}
	os.Unsetenv("SST_DEV")

	os.Setenv("GITHUB_ACTIONS", "true")
	if !IsBuild() {
		t.Error("IsBuild should return true when GITHUB_ACTIONS is set")
	}
	os.Unsetenv("GITHUB_ACTIONS")
}

func TestMergeMaps(t *testing.T) {
	dst := Map{
		"a": "1",
		"nested": Map{
			"x": "original",
		},
	}
	src := Map{
		"b": "2",
		"nested": Map{
			"y": "added",
		},
	}

	mergeMaps(dst, src)

	if dst["a"] != "1" {
		t.Errorf("dst[a] = %v, want %q", dst["a"], "1")
	}
	if dst["b"] != "2" {
		t.Errorf("dst[b] = %v, want %q", dst["b"], "2")
	}
	nested := dst["nested"].(Map)
	if nested["x"] != "original" {
		t.Errorf("dst.nested.x = %v, want %q", nested["x"], "original")
	}
	if nested["y"] != "added" {
		t.Errorf("dst.nested.y = %v, want %q", nested["y"], "added")
	}
}

func TestRemoveNils(t *testing.T) {
	m := Map{
		"a": "keep",
		"b": nil,
		"c": Map{
			"x": nil,
			"y": "keep",
		},
	}
	removeNils(m)

	if _, ok := m["b"]; ok {
		t.Error("nil key 'b' should be removed")
	}
	nested := m["c"].(Map)
	if _, ok := nested["x"]; ok {
		t.Error("nil nested key 'x' should be removed")
	}
	if nested["y"] != "keep" {
		t.Errorf("nested.y = %v, want %q", nested["y"], "keep")
	}
}

func TestParseSize(t *testing.T) {
	tests := []struct {
		input string
		want  int64
	}{
		{"1K", 1024},
		{"1M", 1024 * 1024},
		{"1G", 1024 * 1024 * 1024},
		{"100", 100},
		{"", 0},
	}
	for _, tt := range tests {
		if got := parseSize(tt.input); got != tt.want {
			t.Errorf("parseSize(%q) = %d, want %d", tt.input, got, tt.want)
		}
	}
}

func TestParseDuration(t *testing.T) {
	tests := []struct {
		input string
		want  time.Duration
	}{
		{"30s", 30 * time.Second},
		{"5m", 5 * time.Minute},
		{"2h", 2 * time.Hour},
		{"1d", 24 * time.Hour},
		{"1w", 7 * 24 * time.Hour},
		{"", 0},
	}
	for _, tt := range tests {
		if got := parseDuration(tt.input); got != tt.want {
			t.Errorf("parseDuration(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestResetContext(t *testing.T) {
	resetGlobalContext()
	l := Default()

	l.AddBaseContext(Map{"custom": "value"})
	l.ResetContext()

	ctx := l.Context()
	if _, ok := ctx["custom"]; ok {
		t.Error("custom key should be removed after reset")
	}
	if ctx[KeyCorrelationID] == nil || ctx[KeyCorrelationID] == "" {
		t.Error("correlationId should be regenerated after reset")
	}
}

func TestFileRotation(t *testing.T) {
	dir := t.TempDir()
	opts := RotationOptions{
		Path:           dir,
		FilenamePrefix: "test",
		Extension:      "log",
		Size:           "100",
		Interval:       "1d",
		MaxFiles:       5,
		MaxTotalSize:   "1K",
	}

	w, err := newRotatingWriter(opts)
	if err != nil {
		t.Fatalf("newRotatingWriter failed: %v", err)
	}
	defer w.close()

	// Write enough to trigger rotation
	data := []byte(strings.Repeat("x", 50) + "\n")
	for i := 0; i < 5; i++ {
		if err := w.write(data); err != nil {
			t.Fatalf("write %d failed: %v", i, err)
		}
	}
}

func TestLogToFile(t *testing.T) {
	dir := t.TempDir()
	resetGlobalContext()

	logToFile := true
	prettyPrint := false
	l, err := New(Options{
		Name:        "FileTest",
		Level:       LevelInfo,
		PrettyPrint: &prettyPrint,
		LogToFile:   &logToFile,
		Rotation: &RotationOptions{
			Path: dir,
		},
	})
	if err != nil {
		t.Fatalf("New failed: %v", err)
	}
	defer l.Close()

	var buf bytes.Buffer
	l.output = &buf

	_ = l.Info("file test message")

	if buf.Len() == 0 {
		t.Error("stdout output should not be empty")
	}

	// Verify JSON was written to stdout
	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("Failed to parse stdout output: %v", err)
	}
	if payload[KeyMessage] != "file test message" {
		t.Errorf("msg = %v, want %q", payload[KeyMessage], "file test message")
	}
}

func TestSilentMethod(t *testing.T) {
	l := Default()
	err := l.Silent("this should do nothing")
	if err != nil {
		t.Errorf("Silent should return nil, got: %v", err)
	}
}

func TestCloneMap(t *testing.T) {
	original := Map{
		"a": "1",
		"nested": Map{
			"b": "2",
		},
	}

	cloned := cloneMap(original)

	// Modify clone should not affect original
	cloned["a"] = "modified"
	nested := cloned["nested"].(Map)
	nested["b"] = "modified"

	if original["a"] != "1" {
		t.Error("original should not be modified")
	}
	origNested := original["nested"].(Map)
	if origNested["b"] != "2" {
		t.Error("original nested should not be modified")
	}
}

func TestCloneMapNil(t *testing.T) {
	result := cloneMap(nil)
	if result != nil {
		t.Error("cloneMap(nil) should return nil")
	}
}

func TestSetAndGetLevel(t *testing.T) {
	l := Default()
	l.SetLevel(LevelDebug)
	if l.GetLevel() != LevelDebug {
		t.Errorf("GetLevel() = %d, want %d", l.GetLevel(), LevelDebug)
	}
}

func TestSetName(t *testing.T) {
	l := Default()
	l.SetName("CustomName")
	if l.Name() != "CustomName" {
		t.Errorf("Name() = %q, want %q", l.Name(), "CustomName")
	}
}

func TestAddHTTPResponse(t *testing.T) {
	resetGlobalContext()
	l := Default()

	l.AddHTTPResponse(HTTPResponse{
		StatusCode: 200,
		Headers:    map[string]string{"Content-Type": "application/json"},
	})

	ctx := l.Context()
	http, ok := ctx[KeyHTTP].(Map)
	if !ok {
		t.Fatal("http context is missing")
	}
	resp, ok := http["response"].(Map)
	if !ok {
		t.Fatal("http.response is missing")
	}
	if resp["statusCode"] != 200 {
		t.Errorf("statusCode = %v, want 200", resp["statusCode"])
	}
}

func TestErrorWithoutMessage(t *testing.T) {
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false

	testErr := fmt.Errorf("standalone error")
	_ = l.Error("", testErr)

	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("Failed to parse log output: %v", err)
	}

	// When message is empty, should fall back to error message
	if payload[KeyMessage] != "standalone error" {
		t.Errorf("msg = %v, want %q", payload[KeyMessage], "standalone error")
	}
}
