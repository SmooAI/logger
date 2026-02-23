// Package logger provides a structured JSON logging library for Go,
// matching the log format and feature set of the TypeScript (@smooai/logger),
// Python (smooai-logger), and Rust (smooai-logger) SDKs.
//
// It supports multiple log levels, structured context, correlation tracking,
// ANSI-formatted file output, and automatic log rotation.
package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Options configures a new Logger.
type Options struct {
	Name        string
	Level       Level
	PrettyPrint *bool
	LogToFile   *bool
	Rotation    *RotationOptions
	Context     Map
}

// Logger is a structured JSON logger that writes to stdout and optionally
// to rotating log files, matching the smooai logging format.
type Logger struct {
	name        string
	level       Level
	prettyPrint bool
	logToFile   bool
	rotation    RotationOptions
	writer      *rotatingWriter
	output      io.Writer
}

// New creates a new Logger with the given options.
func New(opts Options) (*Logger, error) {
	name := opts.Name
	if name == "" {
		name = "Logger"
	}

	level := opts.Level
	if level == 0 {
		envLevel := os.Getenv("LOG_LEVEL")
		if envLevel != "" {
			level = ParseLevel(envLevel)
		} else {
			level = LevelInfo
		}
	}

	prettyPrint := IsLocal() || IsBuild()
	if opts.PrettyPrint != nil {
		prettyPrint = *opts.PrettyPrint
	}

	logToFile := IsLocal()
	if opts.LogToFile != nil {
		logToFile = *opts.LogToFile
	}

	rotation := DefaultRotationOptions()
	if opts.Rotation != nil {
		r := *opts.Rotation
		if r.Path != "" {
			rotation.Path = r.Path
		}
		if r.FilenamePrefix != "" {
			rotation.FilenamePrefix = r.FilenamePrefix
		}
		if r.Extension != "" {
			rotation.Extension = r.Extension
		}
		if r.Size != "" {
			rotation.Size = r.Size
		}
		if r.Interval != "" {
			rotation.Interval = r.Interval
		}
		if r.MaxFiles > 0 {
			rotation.MaxFiles = r.MaxFiles
		}
		if r.MaxTotalSize != "" {
			rotation.MaxTotalSize = r.MaxTotalSize
		}
	}

	if opts.Context != nil {
		removeNils(opts.Context)
		addBaseContext(opts.Context)
		if corrID, ok := opts.Context[KeyCorrelationID].(string); ok && corrID != "" {
			setCorrelationID(corrID)
		}
	}

	var rw *rotatingWriter
	if logToFile {
		var err error
		rw, err = newRotatingWriter(rotation)
		if err != nil {
			return nil, fmt.Errorf("init file writer: %w", err)
		}
	}

	return &Logger{
		name:        name,
		level:       level,
		prettyPrint: prettyPrint,
		logToFile:   logToFile,
		rotation:    rotation,
		writer:      rw,
		output:      os.Stdout,
	}, nil
}

// Default creates a Logger with default settings.
func Default() *Logger {
	l, _ := New(Options{})
	return l
}

// Name returns the logger's name.
func (l *Logger) Name() string { return l.name }

// SetName sets the logger's name.
func (l *Logger) SetName(name string) { l.name = name }

// GetLevel returns the current log level.
func (l *Logger) GetLevel() Level { return l.level }

// SetLevel sets the minimum log level.
func (l *Logger) SetLevel(level Level) { l.level = level }

// Context returns a copy of the global context.
func (l *Logger) Context() Map { return getGlobalContext() }

// SetContext replaces the global context.
func (l *Logger) SetContext(ctx Map) { setGlobalContext(ctx) }

// ResetContext clears the global context and generates new correlation IDs.
func (l *Logger) ResetContext() { resetGlobalContext() }

// CorrelationID returns the current correlation ID.
func (l *Logger) CorrelationID() string {
	v, ok := baseContextKey(KeyCorrelationID)
	if !ok {
		return ""
	}
	s, _ := v.(string)
	return s
}

// ResetCorrelationID generates a new correlation ID.
func (l *Logger) ResetCorrelationID() {
	setCorrelationID(uuid.New().String())
}

// SetCorrelationID sets the correlation ID (also sets requestId and traceId).
func (l *Logger) SetCorrelationID(id string) {
	setCorrelationID(id)
}

// SetNamespace sets the namespace in the base context.
func (l *Logger) SetNamespace(namespace string) {
	l.AddBaseContextKey(KeyNamespace, namespace)
}

// AddBaseContextKey adds a single key-value pair to the base context.
func (l *Logger) AddBaseContextKey(key string, value any) {
	addBaseContext(Map{key: value})
}

// AddBaseContext merges the given map into the base context.
func (l *Logger) AddBaseContext(ctx Map) {
	addBaseContext(ctx)
}

// AddContext merges the given map into the nested "context" field.
func (l *Logger) AddContext(ctx Map) {
	contextMu.Lock()
	defer contextMu.Unlock()
	nested, ok := globalContext[KeyContext].(Map)
	if !ok {
		nested = make(Map)
		globalContext[KeyContext] = nested
	}
	mergeMaps(nested, ctx)
}

// AddUserContext adds user identity context.
func (l *Logger) AddUserContext(user User) {
	addBaseContext(Map{KeyUser: structToMap(user)})
}

// AddHTTPRequest adds HTTP request context and sets the namespace.
func (l *Logger) AddHTTPRequest(req HTTPRequest) {
	if req.Method != "" && req.Path != "" {
		l.SetNamespace(strings.ToUpper(req.Method) + " " + req.Path)
	}
	if req.Headers != nil {
		if corrID, ok := req.Headers["X-Correlation-Id"]; ok {
			l.SetCorrelationID(corrID)
		} else if corrID, ok := req.Headers["x-correlation-id"]; ok {
			l.SetCorrelationID(corrID)
		}
	}
	addBaseContext(Map{
		KeyHTTP: Map{
			"request": structToMap(req),
		},
	})
}

// AddHTTPResponse adds HTTP response context.
func (l *Logger) AddHTTPResponse(resp HTTPResponse) {
	addBaseContext(Map{
		KeyHTTP: Map{
			"response": structToMap(resp),
		},
	})
}

// AddTelemetryFields adds telemetry context to the base context.
func (l *Logger) AddTelemetryFields(fields TelemetryFields) {
	addBaseContext(structToMap(fields))
}

// ErrorDetail represents a serialized error for structured logging.
type ErrorDetail struct {
	Message string `json:"message"`
	Name    string `json:"name"`
	Stack   string `json:"stack,omitempty"`
}

// buildLogObject constructs the log payload from the current context and args.
func (l *Logger) buildLogObject(level Level, msg string, args []any) Map {
	payload := getGlobalContext()

	if msg != "" {
		payload[KeyMessage] = msg
	}

	var errors []ErrorDetail
	for _, arg := range args {
		switch v := arg.(type) {
		case error:
			detail := ErrorDetail{
				Message: v.Error(),
				Name:    fmt.Sprintf("%T", v),
			}
			buf := make([]byte, 4096)
			n := runtime.Stack(buf, false)
			detail.Stack = string(buf[:n])
			errors = append(errors, detail)
		case map[string]any:
			ctx, ok := payload[KeyContext].(Map)
			if !ok {
				ctx = make(Map)
			}
			mergeMaps(ctx, v)
			payload[KeyContext] = ctx
		}
	}

	if len(errors) > 0 {
		payload[KeyError] = errors[0].Message
		details := make([]any, len(errors))
		for i, e := range errors {
			details[i] = Map{
				"message": e.Message,
				"name":    e.Name,
				"stack":   e.Stack,
			}
		}
		payload[KeyErrorDetails] = details
	}

	// If no message but there is an error, use the error message.
	if payload[KeyMessage] == nil || payload[KeyMessage] == "" {
		if errMsg, ok := payload[KeyError].(string); ok && errMsg != "" {
			payload[KeyMessage] = errMsg
		}
	}

	payload[KeyLevel] = int(level)
	payload[KeyLogLevel] = level.String()
	payload[KeyTime] = time.Now().UTC().Format(time.RFC3339Nano)
	payload[KeyName] = l.name

	removeNils(payload)
	return payload
}

func (l *Logger) emit(payload Map) error {
	var output string
	if l.prettyPrint {
		output = prettyJSON(payload)
	} else {
		output = plainJSON(payload)
	}

	if _, err := io.WriteString(l.output, output); err != nil {
		return err
	}

	if l.writer != nil {
		if err := l.writer.write([]byte(output)); err != nil {
			return err
		}
	}

	return nil
}

func (l *Logger) isEnabled(level Level) bool {
	return level >= l.level
}

// Trace logs at TRACE level.
func (l *Logger) Trace(msg string, args ...any) error {
	if !l.isEnabled(LevelTrace) {
		return nil
	}
	return l.emit(l.buildLogObject(LevelTrace, msg, args))
}

// Debug logs at DEBUG level.
func (l *Logger) Debug(msg string, args ...any) error {
	if !l.isEnabled(LevelDebug) {
		return nil
	}
	return l.emit(l.buildLogObject(LevelDebug, msg, args))
}

// Info logs at INFO level.
func (l *Logger) Info(msg string, args ...any) error {
	if !l.isEnabled(LevelInfo) {
		return nil
	}
	return l.emit(l.buildLogObject(LevelInfo, msg, args))
}

// Warn logs at WARN level.
func (l *Logger) Warn(msg string, args ...any) error {
	if !l.isEnabled(LevelWarn) {
		return nil
	}
	return l.emit(l.buildLogObject(LevelWarn, msg, args))
}

// Error logs at ERROR level.
func (l *Logger) Error(msg string, args ...any) error {
	if !l.isEnabled(LevelError) {
		return nil
	}
	return l.emit(l.buildLogObject(LevelError, msg, args))
}

// Fatal logs at FATAL level.
func (l *Logger) Fatal(msg string, args ...any) error {
	if !l.isEnabled(LevelFatal) {
		return nil
	}
	return l.emit(l.buildLogObject(LevelFatal, msg, args))
}

// Silent is a no-op log method.
func (l *Logger) Silent(_ string, _ ...any) error {
	return nil
}

// Close flushes and closes the file writer, if any.
func (l *Logger) Close() error {
	if l.writer != nil {
		return l.writer.close()
	}
	return nil
}

// MarshalJSON is a helper that marshals a Map to JSON bytes.
func MarshalJSON(m Map) ([]byte, error) {
	return json.Marshal(m)
}
