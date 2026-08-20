package logger

// Golden-vector parity corpus (ADR-089 pattern, as used by @smooai/audit).
//
// Asserts the Go port satisfies the same contract every other port
// (TypeScript / Python / Rust / .NET) is held to, from the same committed file.
// A failure here means either this port drifted or the shared contract moved --
// fix the port, not the corpus.

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// corpusVersion is bumped alongside the corpus's own `version` when its shape changes.
const corpusVersion = 2

type corpusLevel struct {
	Name     string `json:"name"`
	LogLevel string `json:"LogLevel"`
	Level    int    `json:"level"`
}

type corpusCase struct {
	Name          string         `json:"name"`
	Message       string         `json:"message"`
	Context       map[string]any `json:"context"`
	ExpectMsg     string         `json:"expectMsg"`
	ExpectContext map[string]any `json:"expectContext"`
	Redacted      []string       `json:"redacted"`
	Preserved     map[string]any `json:"preserved"`
}

type parityCorpus struct {
	Version int `json:"version"`
	Levels  struct {
		Rows []corpusLevel `json:"rows"`
	} `json:"levels"`
	FieldNames map[string]string `json:"fieldNames"`
	Record     struct {
		Message        string   `json:"message"`
		RequiredFields []string `json:"requiredFields"`
	} `json:"record"`
	MessageShape struct {
		Cases []corpusCase `json:"cases"`
	} `json:"messageShape"`
	CorrelationID struct {
		Field    string   `json:"field"`
		AlsoSets []string `json:"alsoSets"`
		Value    string   `json:"value"`
	} `json:"correlationId"`
	Redaction struct {
		Placeholder string       `json:"placeholder"`
		DefaultKeys []string     `json:"defaultKeys"`
		Cases       []corpusCase `json:"cases"`
	} `json:"redaction"`
}

func loadCorpus(t *testing.T) parityCorpus {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("..", "parity-corpus.json"))
	if err != nil {
		t.Fatalf("reading parity-corpus.json: %v", err)
	}
	var corpus parityCorpus
	if err := json.Unmarshal(raw, &corpus); err != nil {
		t.Fatalf("parsing parity-corpus.json: %v", err)
	}
	if corpus.Version != corpusVersion {
		t.Fatalf("parity-corpus.json is version %d, this loader understands %d", corpus.Version, corpusVersion)
	}
	if len(corpus.Levels.Rows) == 0 {
		t.Fatal("parity corpus has no levels -- an empty corpus is not coverage")
	}
	return corpus
}

// emitCorpusRecord logs one record and returns the decoded JSON payload.
func emitCorpusRecord(t *testing.T, level string, message string, context map[string]any) map[string]any {
	t.Helper()
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false
	l.level = LevelTrace

	args := []any{}
	if context != nil {
		args = append(args, Map(context))
	}
	logAtCorpusLevel(t, l, level, message, args)

	var payload map[string]any
	if err := json.Unmarshal(buf.Bytes(), &payload); err != nil {
		t.Fatalf("decoding record for %q: %v (raw: %s)", level, err, buf.String())
	}
	return payload
}

func logAtCorpusLevel(t *testing.T, l *Logger, level string, message string, args []any) {
	t.Helper()
	switch level {
	case "trace":
		_ = l.Trace(message, args...)
	case "debug":
		_ = l.Debug(message, args...)
	case "info":
		_ = l.Info(message, args...)
	case "warn":
		_ = l.Warn(message, args...)
	case "error":
		_ = l.Error(message, args...)
	case "fatal":
		_ = l.Fatal(message, args...)
	default:
		t.Fatalf("corpus names level %q, which the Go port does not expose", level)
	}
}

func TestParityCorpusLevelWireShape(t *testing.T) {
	corpus := loadCorpus(t)
	for _, entry := range corpus.Levels.Rows {
		t.Run(entry.Name, func(t *testing.T) {
			record := emitCorpusRecord(t, entry.Name, corpus.Record.Message, nil)

			// level -> pino-compatible NUMERIC code (JSON decodes numbers as float64)
			got, ok := record[corpus.FieldNames["level"]].(float64)
			if !ok || int(got) != entry.Level {
				t.Errorf("%s: level = %v, want numeric %d", entry.Name, record[corpus.FieldNames["level"]], entry.Level)
			}

			// LogLevel -> canonical lowercase STRING
			if got, ok := record[corpus.FieldNames["logLevel"]].(string); !ok || got != entry.LogLevel {
				t.Errorf("%s: LogLevel = %v, want %q", entry.Name, record[corpus.FieldNames["logLevel"]], entry.LogLevel)
			}
		})
	}
}

func TestParityCorpusRequiredFields(t *testing.T) {
	corpus := loadCorpus(t)
	for _, entry := range corpus.Levels.Rows {
		record := emitCorpusRecord(t, entry.Name, corpus.Record.Message, nil)
		for _, field := range corpus.Record.RequiredFields {
			if _, ok := record[field]; !ok {
				t.Errorf("%s: required field %q missing from record", entry.Name, field)
			}
		}
	}
}

func TestParityCorpusFieldNames(t *testing.T) {
	corpus := loadCorpus(t)
	actual := map[string]string{
		"level":         KeyLevel,
		"logLevel":      KeyLogLevel,
		"time":          KeyTime,
		"message":       KeyMessage,
		"name":          KeyName,
		"context":       KeyContext,
		"correlationId": KeyCorrelationID,
		"requestId":     KeyRequestID,
		"traceId":       KeyTraceID,
		"spanId":        KeySpanID,
		"namespace":     KeyNamespace,
		"service":       KeyService,
		"duration":      KeyDuration,
		"error":         KeyError,
		"errorDetails":  KeyErrorDetails,
		"user":          KeyUser,
		"http":          KeyHTTP,
	}
	for concept, want := range corpus.FieldNames {
		got, ok := actual[concept]
		if !ok {
			t.Errorf("corpus names concept %q, which the Go port does not map to a key", concept)
			continue
		}
		if got != want {
			t.Errorf("field %q: Go emits %q, corpus requires %q", concept, got, want)
		}
	}
}

func TestParityCorpusMessageShape(t *testing.T) {
	corpus := loadCorpus(t)
	for _, testCase := range corpus.MessageShape.Cases {
		t.Run(testCase.Name, func(t *testing.T) {
			record := emitCorpusRecord(t, "info", testCase.Message, testCase.Context)
			if got := record[corpus.FieldNames["message"]]; got != testCase.ExpectMsg {
				t.Errorf("msg = %v, want %q", got, testCase.ExpectMsg)
			}

			if testCase.ExpectContext == nil {
				// A bare string message must not leak into `context`.
				if _, ok := record[corpus.FieldNames["context"]]; ok {
					t.Errorf("bare message leaked into %q", corpus.FieldNames["context"])
				}
				return
			}
			context, ok := record[corpus.FieldNames["context"]].(map[string]any)
			if !ok {
				t.Fatalf("expected a %q object, got %v", corpus.FieldNames["context"], record[corpus.FieldNames["context"]])
			}
			for key, want := range testCase.ExpectContext {
				if got := context[key]; got != want {
					t.Errorf("context[%q] = %v, want %v", key, got, want)
				}
			}
		})
	}
}

func TestParityCorpusCorrelationID(t *testing.T) {
	corpus := loadCorpus(t)
	resetGlobalContext()
	var buf bytes.Buffer
	l := Default()
	l.output = &buf
	l.prettyPrint = false
	l.SetCorrelationID(corpus.CorrelationID.Value)
	_ = l.Info(corpus.Record.Message)

	var record map[string]any
	if err := json.Unmarshal(buf.Bytes(), &record); err != nil {
		t.Fatalf("decoding record: %v", err)
	}
	if got := record[corpus.CorrelationID.Field]; got != corpus.CorrelationID.Value {
		t.Errorf("%s = %v, want %q", corpus.CorrelationID.Field, got, corpus.CorrelationID.Value)
	}
	for _, mirrored := range corpus.CorrelationID.AlsoSets {
		if got := record[mirrored]; got != corpus.CorrelationID.Value {
			t.Errorf("%s = %v, want it to mirror correlationId (%q)", mirrored, got, corpus.CorrelationID.Value)
		}
	}
}

func TestParityCorpusRedactionDefaults(t *testing.T) {
	corpus := loadCorpus(t)
	if got := DefaultRedactKeys(); !reflect.DeepEqual(got, corpus.Redaction.DefaultKeys) {
		t.Errorf("DefaultRedactKeys() = %v, corpus requires %v", got, corpus.Redaction.DefaultKeys)
	}
	if RedactedValue != corpus.Redaction.Placeholder {
		t.Errorf("RedactedValue = %q, corpus requires %q", RedactedValue, corpus.Redaction.Placeholder)
	}
}

func TestParityCorpusRedaction(t *testing.T) {
	corpus := loadCorpus(t)
	for _, testCase := range corpus.Redaction.Cases {
		t.Run(testCase.Name, func(t *testing.T) {
			record := emitCorpusRecord(t, "info", corpus.Record.Message, testCase.Context)
			context, ok := record[corpus.FieldNames["context"]].(map[string]any)
			if !ok {
				t.Fatalf("expected a %q object, got %v", corpus.FieldNames["context"], record[corpus.FieldNames["context"]])
			}
			for _, key := range testCase.Redacted {
				if got := context[key]; got != corpus.Redaction.Placeholder {
					t.Errorf("context[%q] = %v, want it redacted to %q", key, got, corpus.Redaction.Placeholder)
				}
			}
			for key, want := range testCase.Preserved {
				if got := context[key]; got != want {
					t.Errorf("context[%q] = %v, want it preserved as %v", key, got, want)
				}
			}
		})
	}
}
