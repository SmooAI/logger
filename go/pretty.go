package logger

import (
	"encoding/json"
	"fmt"
	"strings"
)

const separator = "----------------------------------------------------------------------------------------------------"

// ANSI color codes matching the TypeScript/Python/Rust pretty printers.
const (
	ansiReset = "\033[0m"
	ansiBold  = "\033[1m"
	ansiGreen = "\033[38;2;46;204;113m"
	ansiBlue  = "\033[38;2;52;152;219m"
	ansiRed   = "\033[38;2;231;76;60m"
)

// prettyJSON formats a log payload as pretty-printed JSON with ANSI color
// highlights for msg, time, and error fields, followed by separator lines.
func prettyJSON(payload Map) string {
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "{}\n"
	}

	var sb strings.Builder
	for _, line := range strings.Split(string(data), "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case strings.HasPrefix(trimmed, `"msg"`):
			sb.WriteString(highlightKey(line, ansiGreen+ansiBold, ansiReset))
		case strings.HasPrefix(trimmed, `"time"`):
			sb.WriteString(highlightKey(line, ansiBlue, ansiReset))
		case strings.HasPrefix(trimmed, `"error"`) || strings.HasPrefix(trimmed, `"errorDetails"`):
			sb.WriteString(fmt.Sprintf("%s%s%s", ansiRed, line, ansiReset))
		default:
			sb.WriteString(line)
		}
		sb.WriteByte('\n')
	}

	sb.WriteString(separator)
	sb.WriteByte('\n')
	sb.WriteString(separator)
	sb.WriteByte('\n')
	sb.WriteString(separator)
	sb.WriteByte('\n')

	return sb.String()
}

// plainJSON formats a log payload as compact single-line JSON.
func plainJSON(payload Map) string {
	data, err := json.Marshal(payload)
	if err != nil {
		return "{}\n"
	}
	return string(data) + "\n"
}

func highlightKey(line, colorStart, colorEnd string) string {
	idx := strings.Index(line, ":")
	if idx < 0 {
		return line
	}
	return fmt.Sprintf("%s%s%s%s", colorStart, line[:idx], colorEnd, line[idx:])
}
