package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// RotationOptions configures log file rotation.
type RotationOptions struct {
	Path           string // Directory for log files (default: ".smooai-logs")
	FilenamePrefix string // Prefix for log filenames (default: "output")
	Extension      string // File extension (default: "ansi")
	Size           string // Max file size before rotation (e.g., "1M", "10K")
	Interval       string // Rotation interval (e.g., "1d", "2h")
	MaxFiles       int    // Max rotated files to keep (default: 30)
	MaxTotalSize   string // Max total size of all log files (e.g., "100M")
}

// DefaultRotationOptions returns the default rotation configuration.
func DefaultRotationOptions() RotationOptions {
	return RotationOptions{
		Path:           ".smooai-logs",
		FilenamePrefix: "output",
		Extension:      "ansi",
		Size:           "1M",
		Interval:       "1d",
		MaxFiles:       30,
		MaxTotalSize:   "100M",
	}
}

type rotatingWriter struct {
	opts           RotationOptions
	mu             sync.Mutex
	file           *os.File
	bytesWritten   int64
	maxBytes       int64
	maxTotalBytes  int64
	interval       time.Duration
	currentDir     string
	currentPath    string
	index          int
	intervalAnchor time.Time
}

func newRotatingWriter(opts RotationOptions) (*rotatingWriter, error) {
	maxBytes := parseSize(opts.Size)
	maxTotalBytes := parseSize(opts.MaxTotalSize)
	interval := parseDuration(opts.Interval)

	now := time.Now().UTC()
	dir := logDirectory(opts, now)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("create log directory: %w", err)
	}

	path := filepath.Join(dir, logFilename(opts, now, 0))
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return nil, fmt.Errorf("open log file: %w", err)
	}

	info, _ := f.Stat()
	var written int64
	if info != nil {
		written = info.Size()
	}

	return &rotatingWriter{
		opts:           opts,
		file:           f,
		bytesWritten:   written,
		maxBytes:       maxBytes,
		maxTotalBytes:  maxTotalBytes,
		interval:       interval,
		currentDir:     dir,
		currentPath:    path,
		index:          0,
		intervalAnchor: now,
	}, nil
}

func (w *rotatingWriter) write(data []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	now := time.Now().UTC()
	if w.shouldRotate(now, int64(len(data))) {
		if err := w.rotate(now); err != nil {
			return err
		}
	}

	n, err := w.file.Write(data)
	w.bytesWritten += int64(n)
	if err != nil {
		return err
	}
	return w.file.Sync()
}

func (w *rotatingWriter) shouldRotate(now time.Time, additional int64) bool {
	if w.maxBytes > 0 && w.bytesWritten+additional > w.maxBytes {
		return true
	}
	if w.interval > 0 && now.Sub(w.intervalAnchor) >= w.interval {
		return true
	}
	return false
}

func (w *rotatingWriter) rotate(now time.Time) error {
	if w.file != nil {
		_ = w.file.Close()
	}

	nextIndex := w.index + 1
	newDir := logDirectory(w.opts, now)
	if newDir != w.currentDir {
		nextIndex = 0
	}

	if err := os.MkdirAll(newDir, 0o755); err != nil {
		return fmt.Errorf("create log directory: %w", err)
	}

	path := filepath.Join(newDir, logFilename(w.opts, now, nextIndex))
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open rotated log file: %w", err)
	}

	w.file = f
	w.bytesWritten = 0
	w.currentDir = newDir
	w.currentPath = path
	w.index = nextIndex
	w.intervalAnchor = now

	w.enforceLimits()
	return nil
}

func (w *rotatingWriter) enforceLimits() {
	entries, err := os.ReadDir(w.currentDir)
	if err != nil {
		return
	}

	type fileInfo struct {
		path    string
		modTime time.Time
		size    int64
	}

	var files []fileInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if !strings.HasPrefix(name, w.opts.FilenamePrefix) || !strings.HasSuffix(name, w.opts.Extension) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		files = append(files, fileInfo{
			path:    filepath.Join(w.currentDir, name),
			modTime: info.ModTime(),
			size:    info.Size(),
		})
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].modTime.Before(files[j].modTime)
	})

	// Enforce max file count.
	for len(files) > w.opts.MaxFiles && len(files) > 0 {
		_ = os.Remove(files[0].path)
		files = files[1:]
	}

	// Enforce max total size.
	if w.maxTotalBytes > 0 {
		var total int64
		for _, f := range files {
			total += f.size
		}
		for total > w.maxTotalBytes && len(files) > 0 {
			total -= files[0].size
			_ = os.Remove(files[0].path)
			files = files[1:]
		}
	}
}

func (w *rotatingWriter) close() error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.file != nil {
		return w.file.Close()
	}
	return nil
}

func logDirectory(opts RotationOptions, t time.Time) string {
	folder := fmt.Sprintf("%04d-%02d", t.Year(), t.Month())
	return filepath.Join(opts.Path, folder)
}

func logFilename(opts RotationOptions, t time.Time, index int) string {
	return fmt.Sprintf("%s-%04d-%02d-%02d-%03d.%s",
		opts.FilenamePrefix,
		t.Year(), t.Month(), t.Day(),
		index,
		opts.Extension,
	)
}

func parseSize(s string) int64 {
	s = strings.TrimSpace(strings.ToUpper(s))
	if s == "" {
		return 0
	}
	if strings.HasSuffix(s, "K") {
		n, _ := strconv.ParseInt(s[:len(s)-1], 10, 64)
		return n * 1024
	}
	if strings.HasSuffix(s, "M") {
		n, _ := strconv.ParseInt(s[:len(s)-1], 10, 64)
		return n * 1024 * 1024
	}
	if strings.HasSuffix(s, "G") {
		n, _ := strconv.ParseInt(s[:len(s)-1], 10, 64)
		return n * 1024 * 1024 * 1024
	}
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}

func parseDuration(s string) time.Duration {
	s = strings.TrimSpace(strings.ToLower(s))
	if s == "" {
		return 0
	}
	if strings.HasSuffix(s, "s") {
		n, _ := strconv.Atoi(s[:len(s)-1])
		return time.Duration(n) * time.Second
	}
	if strings.HasSuffix(s, "m") {
		n, _ := strconv.Atoi(s[:len(s)-1])
		return time.Duration(n) * time.Minute
	}
	if strings.HasSuffix(s, "h") {
		n, _ := strconv.Atoi(s[:len(s)-1])
		return time.Duration(n) * time.Hour
	}
	if strings.HasSuffix(s, "d") {
		n, _ := strconv.Atoi(s[:len(s)-1])
		return time.Duration(n) * 24 * time.Hour
	}
	if strings.HasSuffix(s, "w") {
		n, _ := strconv.Atoi(s[:len(s)-1])
		return time.Duration(n) * 7 * 24 * time.Hour
	}
	return 0
}
