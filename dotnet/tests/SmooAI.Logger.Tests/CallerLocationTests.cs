using System.Runtime.CompilerServices;
using System.Text.Json;

namespace SmooAI.Logger.Tests;

/// <summary>
/// Per-line caller location (<c>caller: { file, line, function }</c>).
///
/// The value is not "a caller field exists" but that it points at the USER's
/// call site rather than a frame inside SmooLogger — which is what threading the
/// compiler-injected <c>[Caller*]</c> arguments down to <c>Emit</c> buys.
/// </summary>
public class CallerLocationTests
{
    private static (SmooLogger Logger, StringWriter Out) Build()
    {
        var writer = new StringWriter();
        return (new SmooLogger(new SmooLoggerOptions
        {
            Output = writer,
            PrettyPrint = false,
            Name = "caller-test",
            Level = Level.Trace,
        }), writer);
    }

    private static JsonElement ParseSingle(StringWriter writer) =>
        JsonDocument.Parse(writer.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries)[0]).RootElement.Clone();

    [Fact]
    public void Caller_Points_At_This_File_Line_And_Method()
    {
        var (logger, writer) = Build();

        // Keep these two statements adjacent — the assertion pins the emitted
        // line to the LogInfo call, so an edit between them fails.
        var expectedLine = CurrentLine() + 1;
        logger.LogInfo("hello");

        var caller = ParseSingle(writer).GetProperty("caller");
        Assert.Equal("CallerLocationTests.cs", caller.GetProperty("file").GetString());
        Assert.Equal(expectedLine, caller.GetProperty("line").GetInt32());
        Assert.Equal(nameof(Caller_Points_At_This_File_Line_And_Method), caller.GetProperty("function").GetString());
    }

    [Fact]
    public void Caller_File_Is_The_Basename_Not_The_Build_Machine_Path()
    {
        var (logger, writer) = Build();
        logger.LogWarning("hello");

        var file = ParseSingle(writer).GetProperty("caller").GetProperty("file").GetString()!;
        Assert.DoesNotContain(Path.DirectorySeparatorChar, file);
        Assert.DoesNotContain('/', file);
    }

    [Fact]
    public void Caller_Tracks_The_Call_Site_Not_A_Fixed_Library_Frame()
    {
        var (logger, writer) = Build();
        logger.LogInfo("one");
        logger.LogInfo("two");

        var lines = writer.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => JsonDocument.Parse(l).RootElement.GetProperty("caller").GetProperty("line").GetInt32())
            .ToArray();

        Assert.Equal(2, lines.Length);
        // A constant here would mean the location is read from a frame inside SmooLogger.
        Assert.Equal(1, lines[1] - lines[0]);
    }

    [Fact]
    public void Every_Level_Carries_Caller()
    {
        foreach (var level in new[] { Level.Trace, Level.Debug, Level.Info, Level.Warn, Level.Error, Level.Fatal })
        {
            var (logger, writer) = Build();
            logger.Log(level, "hello");
            var caller = ParseSingle(writer).GetProperty("caller");
            Assert.Equal("CallerLocationTests.cs", caller.GetProperty("file").GetString());
            Assert.True(caller.GetProperty("line").GetInt32() > 0);
        }
    }

    private static int CurrentLine([CallerLineNumber] int line = 0) => line;
}
