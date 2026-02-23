package logger

import "strings"

// Level represents the severity of a log entry.
type Level int

const (
	LevelTrace Level = 10
	LevelDebug Level = 20
	LevelInfo  Level = 30
	LevelWarn  Level = 40
	LevelError Level = 50
	LevelFatal Level = 60
)

// String returns the lowercase string representation of the level.
func (l Level) String() string {
	switch l {
	case LevelTrace:
		return "trace"
	case LevelDebug:
		return "debug"
	case LevelInfo:
		return "info"
	case LevelWarn:
		return "warn"
	case LevelError:
		return "error"
	case LevelFatal:
		return "fatal"
	default:
		return "unknown"
	}
}

// ParseLevel converts a string to a Level. Returns LevelInfo if unrecognized.
func ParseLevel(s string) Level {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "trace":
		return LevelTrace
	case "debug":
		return LevelDebug
	case "info":
		return LevelInfo
	case "warn", "warning":
		return LevelWarn
	case "error":
		return LevelError
	case "fatal":
		return LevelFatal
	default:
		return LevelInfo
	}
}
