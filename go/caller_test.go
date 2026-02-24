package logger

import (
	"strings"
	"testing"
)

func TestGetCallerInfoReturnsCorrectFile(t *testing.T) {
	info := getCallerInfo(0) // 0 = direct caller of getCallerInfo
	if info == nil {
		t.Fatal("getCallerInfo returned nil")
	}
	if info.File != "caller_test.go" {
		t.Errorf("File = %q, want %q", info.File, "caller_test.go")
	}
}

func TestGetCallerInfoReturnsNonZeroLine(t *testing.T) {
	info := getCallerInfo(0)
	if info == nil {
		t.Fatal("getCallerInfo returned nil")
	}
	if info.Line <= 0 {
		t.Errorf("Line = %d, want > 0", info.Line)
	}
}

func TestGetCallerInfoReturnsFunctionName(t *testing.T) {
	info := getCallerInfo(0)
	if info == nil {
		t.Fatal("getCallerInfo returned nil")
	}
	if !strings.Contains(info.Function, "TestGetCallerInfoReturnsFunctionName") {
		t.Errorf("Function = %q, should contain test function name", info.Function)
	}
}

func TestGetCallerInfoWithHigherSkip(t *testing.T) {
	info := helperGetCaller()
	if info == nil {
		t.Fatal("getCallerInfo returned nil")
	}
	// When called from a helper with skip=1, the caller should be the test function
	if !strings.Contains(info.Function, "TestGetCallerInfoWithHigherSkip") {
		t.Errorf("Function = %q, should contain test function name from higher skip", info.Function)
	}
}

func helperGetCaller() *CallerInfo {
	return getCallerInfo(1) // 1 = skip helperGetCaller, return its caller
}
