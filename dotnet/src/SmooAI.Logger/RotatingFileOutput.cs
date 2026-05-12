using System.IO.Compression;
using System.Text;

namespace SmooAI.Logger;

/// <summary>
/// Options that configure a <see cref="RotatingFileOutput"/>. Mirrors the TS <c>RotationOptions</c>
/// shape and the Rust <c>RotationOptions</c> struct: size-based rollover, max archived files,
/// optional gzip compression of archived files, and a configurable path/filename pattern.
/// </summary>
public sealed class RotationOptions
{
    /// <summary>Directory where log files are written. Defaults to <c>.smooai-logs</c>.</summary>
    public string Path { get; set; } = ".smooai-logs";

    /// <summary>Filename prefix used for both the live file and archives. Defaults to <c>output</c>.</summary>
    public string FilenamePrefix { get; set; } = "output";

    /// <summary>File extension (no leading dot) used for the live file. Defaults to <c>log</c>.</summary>
    public string Extension { get; set; } = "log";

    /// <summary>
    /// Maximum size of the live file in bytes before rollover triggers. <c>null</c> disables
    /// size-based rollover. Defaults to 1 MiB.
    /// </summary>
    public long? MaxFileSizeBytes { get; set; } = 1L * 1024 * 1024;

    /// <summary>
    /// Maximum number of archived files to retain. Older archives beyond this count are deleted.
    /// Defaults to 30.
    /// </summary>
    public int MaxArchivedFiles { get; set; } = 30;

    /// <summary>
    /// When <c>true</c>, archived files are gzipped (suffix <c>.gz</c>). Defaults to <c>true</c>.
    /// </summary>
    public bool Compress { get; set; } = true;

    /// <summary>
    /// Optional archive filename pattern. Supports tokens <c>{prefix}</c>, <c>{date}</c>,
    /// <c>{index}</c>, <c>{ext}</c>. When <c>null</c>, the default
    /// <c>{prefix}-{date}-{index}.{ext}</c> is used. The <c>.gz</c> suffix is appended automatically
    /// when <see cref="Compress"/> is true.
    /// </summary>
    public string? ArchivePattern { get; set; }
}

/// <summary>
/// File writer with size-based rollover, optional gzip compression of archives, and a configurable
/// retention limit on archived files. Designed to be wired as a <see cref="TextWriter"/> sink for
/// <see cref="SmooLogger"/> via <see cref="SmooLoggerOptions.Output"/> or together with stdout via
/// <see cref="SmooLoggerOptions.Rotation"/>.
/// </summary>
public sealed class RotatingFileOutput : TextWriter
{
    private readonly object _gate = new();
    private readonly RotationOptions _options;
    private FileStream _stream;
    private long _bytesWritten;
    private bool _disposed;

    /// <summary>Path of the currently-open live file.</summary>
    public string CurrentPath { get; private set; }

    /// <inheritdoc />
    public override Encoding Encoding => Encoding.UTF8;

    public RotatingFileOutput(RotationOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        if (string.IsNullOrEmpty(options.Path)) throw new ArgumentException("Path is required", nameof(options));
        if (string.IsNullOrEmpty(options.FilenamePrefix)) throw new ArgumentException("FilenamePrefix is required", nameof(options));
        if (string.IsNullOrEmpty(options.Extension)) throw new ArgumentException("Extension is required", nameof(options));

        _options = options;
        Directory.CreateDirectory(options.Path);
        CurrentPath = LivePath();
        _stream = new FileStream(CurrentPath, FileMode.Append, FileAccess.Write, FileShare.Read);
        _bytesWritten = _stream.Length;
    }

    private string LivePath()
        => System.IO.Path.Combine(_options.Path, $"{_options.FilenamePrefix}.{_options.Extension}");

    /// <inheritdoc />
    public override void Write(char value) => Write(value.ToString());

    /// <inheritdoc />
    public override void Write(string? value)
    {
        if (string.IsNullOrEmpty(value)) return;
        var bytes = Encoding.UTF8.GetBytes(value);
        WriteBytes(bytes);
    }

    /// <inheritdoc />
    public override void WriteLine(string? value)
    {
        Write((value ?? string.Empty) + Environment.NewLine);
    }

    /// <inheritdoc />
    public override void Write(char[] buffer, int index, int count)
    {
        if (buffer == null || count <= 0) return;
        var bytes = Encoding.UTF8.GetBytes(buffer, index, count);
        WriteBytes(bytes);
    }

    private void WriteBytes(byte[] bytes)
    {
        lock (_gate)
        {
            if (_disposed) return;
            if (_options.MaxFileSizeBytes is long max && max > 0 && _bytesWritten + bytes.Length > max && _bytesWritten > 0)
            {
                Rotate();
            }
            _stream.Write(bytes, 0, bytes.Length);
            _stream.Flush();
            _bytesWritten += bytes.Length;
        }
    }

    /// <inheritdoc />
    public override void Flush()
    {
        lock (_gate)
        {
            if (_disposed) return;
            _stream.Flush();
        }
    }

    /// <summary>
    /// Force a rotation. The live file is closed, renamed (and optionally gzipped), then a fresh
    /// empty live file is opened. Older archives beyond <see cref="RotationOptions.MaxArchivedFiles"/>
    /// are deleted.
    /// </summary>
    public void ForceRotate()
    {
        lock (_gate)
        {
            if (_disposed) return;
            Rotate();
        }
    }

    private void Rotate()
    {
        _stream.Flush();
        _stream.Dispose();

        var archivePath = NextArchivePath();
        var sourcePath = CurrentPath;

        if (_options.Compress)
        {
            using (var source = new FileStream(sourcePath, FileMode.Open, FileAccess.Read, FileShare.Read))
            using (var dest = new FileStream(archivePath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            using (var gz = new GZipStream(dest, CompressionLevel.Fastest))
            {
                source.CopyTo(gz);
            }
            File.Delete(sourcePath);
        }
        else
        {
            File.Move(sourcePath, archivePath);
        }

        EnforceRetention();

        _stream = new FileStream(sourcePath, FileMode.Create, FileAccess.Write, FileShare.Read);
        CurrentPath = sourcePath;
        _bytesWritten = 0;
    }

    private string NextArchivePath()
    {
        var date = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var pattern = _options.ArchivePattern ?? "{prefix}-{date}-{index}.{ext}";
        int index = 0;
        while (true)
        {
            var name = pattern
                .Replace("{prefix}", _options.FilenamePrefix, StringComparison.Ordinal)
                .Replace("{date}", date, StringComparison.Ordinal)
                .Replace("{index}", index.ToString("D3"), StringComparison.Ordinal)
                .Replace("{ext}", _options.Extension, StringComparison.Ordinal);
            if (_options.Compress) name += ".gz";
            var candidate = System.IO.Path.Combine(_options.Path, name);
            if (!File.Exists(candidate)) return candidate;
            index++;
            if (index > 10_000) throw new InvalidOperationException("Unable to allocate archive filename");
        }
    }

    private void EnforceRetention()
    {
        if (_options.MaxArchivedFiles <= 0) return;
        if (!Directory.Exists(_options.Path)) return;

        var livePath = LivePath();
        var liveName = System.IO.Path.GetFileName(livePath);
        var prefix = _options.FilenamePrefix + "-";
        var entries = new DirectoryInfo(_options.Path)
            .GetFiles()
            .Where(f => !string.Equals(f.Name, liveName, StringComparison.Ordinal))
            .Where(f => f.Name.StartsWith(prefix, StringComparison.Ordinal))
            .OrderBy(f => f.LastWriteTimeUtc)
            .ToList();

        while (entries.Count > _options.MaxArchivedFiles)
        {
            var oldest = entries[0];
            try { oldest.Delete(); }
            catch (IOException) { /* best-effort */ }
            entries.RemoveAt(0);
        }
    }

    /// <inheritdoc />
    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            lock (_gate)
            {
                if (!_disposed)
                {
                    _disposed = true;
                    try { _stream.Flush(); _stream.Dispose(); } catch { /* ignore */ }
                }
            }
        }
        base.Dispose(disposing);
    }
}
