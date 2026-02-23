package logger

import (
	"sync"

	"github.com/google/uuid"
)

// Context key constants matching the TypeScript/Python/Rust implementations.
const (
	KeyLevel         = "level"
	KeyLogLevel      = "LogLevel"
	KeyTime          = "time"
	KeyMessage       = "msg"
	KeyName          = "name"
	KeyCorrelationID = "correlationId"
	KeyRequestID     = "requestId"
	KeyTraceID       = "traceId"
	KeyNamespace     = "namespace"
	KeyService       = "service"
	KeyDuration      = "duration"
	KeyError         = "error"
	KeyErrorDetails  = "errorDetails"
	KeyContext        = "context"
	KeyUser          = "user"
	KeyHTTP          = "http"
)

// Map is the type used for structured context data.
type Map = map[string]any

// User holds user identity context.
type User struct {
	ID        string `json:"id,omitempty"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
	Role      string `json:"role,omitempty"`
	FullName  string `json:"fullName,omitempty"`
	FirstName string `json:"firstName,omitempty"`
	LastName  string `json:"lastName,omitempty"`
	Context   Map    `json:"context,omitempty"`
}

// HTTPRequest holds HTTP request context.
type HTTPRequest struct {
	Protocol    string            `json:"protocol,omitempty"`
	Hostname    string            `json:"hostname,omitempty"`
	Path        string            `json:"path,omitempty"`
	Method      string            `json:"method,omitempty"`
	QueryString string            `json:"queryString,omitempty"`
	SourceIP    string            `json:"sourceIp,omitempty"`
	UserAgent   string            `json:"userAgent,omitempty"`
	Headers     map[string]string `json:"headers,omitempty"`
	Body        any               `json:"body,omitempty"`
}

// HTTPResponse holds HTTP response context.
type HTTPResponse struct {
	StatusCode int               `json:"statusCode,omitempty"`
	Body       any               `json:"body,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
}

// TelemetryFields holds telemetry context.
type TelemetryFields struct {
	RequestID string  `json:"requestId,omitempty"`
	Duration  float64 `json:"duration,omitempty"`
	TraceID   string  `json:"traceId,omitempty"`
	Namespace string  `json:"namespace,omitempty"`
	Service   string  `json:"service,omitempty"`
	Error     string  `json:"error,omitempty"`
}

// globalContext is the process-wide context singleton, matching the behavior
// of the TypeScript, Python, and Rust SDKs.
var (
	globalContext Map
	contextMu    sync.RWMutex
)

func init() {
	resetGlobalContext()
}

func resetGlobalContext() {
	contextMu.Lock()
	defer contextMu.Unlock()
	id := uuid.New().String()
	globalContext = Map{
		KeyCorrelationID: id,
		KeyRequestID:     id,
		KeyTraceID:       id,
	}
}

func getGlobalContext() Map {
	contextMu.RLock()
	defer contextMu.RUnlock()
	return cloneMap(globalContext)
}

func setGlobalContext(ctx Map) {
	contextMu.Lock()
	defer contextMu.Unlock()
	globalContext = ctx
}

func addBaseContext(ctx Map) {
	contextMu.Lock()
	defer contextMu.Unlock()
	mergeMaps(globalContext, ctx)
}

func baseContextKey(key string) (any, bool) {
	contextMu.RLock()
	defer contextMu.RUnlock()
	v, ok := globalContext[key]
	return v, ok
}

func setCorrelationID(id string) {
	contextMu.Lock()
	defer contextMu.Unlock()
	globalContext[KeyCorrelationID] = id
	globalContext[KeyRequestID] = id
	globalContext[KeyTraceID] = id
}

// mergeMaps deeply merges src into dst. Nested maps are merged recursively;
// other values in src overwrite dst.
func mergeMaps(dst, src Map) {
	for k, srcVal := range src {
		dstVal, exists := dst[k]
		if exists {
			dstMap, dstOk := dstVal.(Map)
			srcMap, srcOk := srcVal.(Map)
			if dstOk && srcOk {
				mergeMaps(dstMap, srcMap)
				continue
			}
		}
		dst[k] = srcVal
	}
}

// cloneMap creates a shallow copy of a map. Nested maps are also cloned.
func cloneMap(m Map) Map {
	if m == nil {
		return nil
	}
	result := make(Map, len(m))
	for k, v := range m {
		if nested, ok := v.(Map); ok {
			result[k] = cloneMap(nested)
		} else {
			result[k] = v
		}
	}
	return result
}

// removeNils recursively removes nil values from a map.
func removeNils(m Map) {
	for k, v := range m {
		if v == nil {
			delete(m, k)
			continue
		}
		if nested, ok := v.(Map); ok {
			removeNils(nested)
			if len(nested) == 0 {
				delete(m, k)
			}
		}
	}
}

// structToMap converts known struct types to a Map.
func structToMap(v any) Map {
	result := make(Map)
	switch val := v.(type) {
	case User:
		if val.ID != "" {
			result["id"] = val.ID
		}
		if val.Email != "" {
			result["email"] = val.Email
		}
		if val.Phone != "" {
			result["phone"] = val.Phone
		}
		if val.Role != "" {
			result["role"] = val.Role
		}
		if val.FullName != "" {
			result["fullName"] = val.FullName
		}
		if val.FirstName != "" {
			result["firstName"] = val.FirstName
		}
		if val.LastName != "" {
			result["lastName"] = val.LastName
		}
		if val.Context != nil {
			result["context"] = val.Context
		}
	case HTTPRequest:
		if val.Protocol != "" {
			result["protocol"] = val.Protocol
		}
		if val.Hostname != "" {
			result["hostname"] = val.Hostname
		}
		if val.Path != "" {
			result["path"] = val.Path
		}
		if val.Method != "" {
			result["method"] = val.Method
		}
		if val.QueryString != "" {
			result["queryString"] = val.QueryString
		}
		if val.SourceIP != "" {
			result["sourceIp"] = val.SourceIP
		}
		if val.UserAgent != "" {
			result["userAgent"] = val.UserAgent
		}
		if val.Headers != nil {
			result["headers"] = val.Headers
		}
		if val.Body != nil {
			result["body"] = val.Body
		}
	case HTTPResponse:
		if val.StatusCode != 0 {
			result["statusCode"] = val.StatusCode
		}
		if val.Body != nil {
			result["body"] = val.Body
		}
		if val.Headers != nil {
			result["headers"] = val.Headers
		}
	case TelemetryFields:
		if val.RequestID != "" {
			result["requestId"] = val.RequestID
		}
		if val.Duration != 0 {
			result["duration"] = val.Duration
		}
		if val.TraceID != "" {
			result["traceId"] = val.TraceID
		}
		if val.Namespace != "" {
			result["namespace"] = val.Namespace
		}
		if val.Service != "" {
			result["service"] = val.Service
		}
		if val.Error != "" {
			result["error"] = val.Error
		}
	}
	return result
}
