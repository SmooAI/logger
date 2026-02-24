package logger

import (
	"path/filepath"
	"runtime"
)

// CallerInfo holds information about the calling function.
type CallerInfo struct {
	File     string `json:"file"`
	Line     int    `json:"line"`
	Function string `json:"function"`
}

// getCallerInfo returns caller information, skipping internal logger frames.
// The skip parameter controls how many additional frames to skip beyond the
// base skip of 1 (for this function itself).
func getCallerInfo(skip int) *CallerInfo {
	pc, file, line, ok := runtime.Caller(skip + 1)
	if !ok {
		return nil
	}

	funcName := "unknown"
	if fn := runtime.FuncForPC(pc); fn != nil {
		funcName = fn.Name()
	}

	return &CallerInfo{
		File:     filepath.Base(file),
		Line:     line,
		Function: funcName,
	}
}
