using System.IO.Compression;
using SmooAI.Logger;

namespace SmooAI.Logger.Tests;

public class RotatingFileOutputTests : IDisposable
{
    private readonly string _tempDir;

    public RotatingFileOutputTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "smooai-logger-rotation-tests-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_tempDir);
    }

    public void Dispose()
    {
        try { Directory.Delete(_tempDir, recursive: true); } catch { /* ignore */ }
        GC.SuppressFinalize(this);
    }

    private RotationOptions DefaultOptions(long? maxBytes = 200, int maxArchived = 30, bool compress = true)
    {
        return new RotationOptions
        {
            Path = _tempDir,
            FilenamePrefix = "output",
            Extension = "log",
            MaxFileSizeBytes = maxBytes,
            MaxArchivedFiles = maxArchived,
            Compress = compress,
        };
    }

    [Fact]
    public void Rollover_Creates_Archive_When_MaxBytes_Exceeded()
    {
        var opts = DefaultOptions(maxBytes: 100, compress: true);
        using (var output = new RotatingFileOutput(opts))
        {
            // Write a chunk under the threshold first.
            output.Write(new string('a', 80));
            // Next write must trigger rollover.
            output.Write(new string('b', 80));
            output.Flush();
        }

        var files = Directory.GetFiles(_tempDir);
        // Live file + one archive
        Assert.Equal(2, files.Length);

        var live = files.Single(f => Path.GetFileName(f) == "output.log");
        var archive = files.Single(f => Path.GetFileName(f) != "output.log");

        Assert.EndsWith(".gz", archive);
        Assert.Matches(@"output-\d{4}-\d{2}-\d{2}-\d{3}\.log\.gz$", archive.Replace('\\', '/'));

        // Live file should contain the post-rollover payload.
        var liveContent = File.ReadAllText(live);
        Assert.Equal(new string('b', 80), liveContent);

        // Archive should gunzip to the pre-rollover payload.
        using var fs = File.OpenRead(archive);
        using var gz = new GZipStream(fs, CompressionMode.Decompress);
        using var sr = new StreamReader(gz);
        var decompressed = sr.ReadToEnd();
        Assert.Equal(new string('a', 80), decompressed);
    }

    [Fact]
    public void Retention_Caps_Archive_Count_To_MaxArchivedFiles()
    {
        var opts = DefaultOptions(maxBytes: 50, maxArchived: 3, compress: true);
        using (var output = new RotatingFileOutput(opts))
        {
            // Trigger 5 rollovers by writing 6 chunks that each exceed the 50-byte ceiling.
            for (int i = 0; i < 6; i++)
            {
                output.Write(new string((char)('a' + i), 60));
                // tiny sleep so LastWriteTimeUtc ordering is stable
                Thread.Sleep(10);
            }
        }

        var archives = Directory.GetFiles(_tempDir)
            .Where(f => Path.GetFileName(f) != "output.log")
            .ToArray();

        Assert.Equal(3, archives.Length);
        Assert.All(archives, a => Assert.EndsWith(".gz", a));
    }

    [Fact]
    public void Uncompressed_Archive_Has_No_Gz_Suffix()
    {
        var opts = DefaultOptions(maxBytes: 50, compress: false);
        using (var output = new RotatingFileOutput(opts))
        {
            output.Write(new string('a', 60));
            output.Write(new string('b', 60));
        }

        var archives = Directory.GetFiles(_tempDir)
            .Where(f => Path.GetFileName(f) != "output.log")
            .ToArray();

        Assert.Single(archives);
        Assert.DoesNotContain(".gz", archives[0]);
        Assert.Equal(new string('a', 60), File.ReadAllText(archives[0]));
    }

    [Fact]
    public void SmooLogger_Rotation_Writes_To_File()
    {
        var rotation = DefaultOptions(maxBytes: 10_000, compress: false);
        var stdout = new StringWriter();
        var opts = new SmooLoggerOptions
        {
            Name = "test",
            Output = stdout,
            PrettyPrint = false,
            Rotation = rotation,
        };
        using (var logger = new SmooLogger(opts))
        {
            logger.LogInfo("hello rotation");
        }

        var live = Path.Combine(_tempDir, "output.log");
        Assert.True(File.Exists(live));
        var content = File.ReadAllText(live);
        Assert.Contains("hello rotation", content);
        // Also went to stdout.
        Assert.Contains("hello rotation", stdout.ToString());
    }
}
