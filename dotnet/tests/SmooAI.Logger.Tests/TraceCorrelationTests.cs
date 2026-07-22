using System.Diagnostics;
using System.Text.Json;
using SmooAI.Logger;

namespace SmooAI.Logger.Tests;

/// <summary>
/// Verifies the emit-time trace correlation (th-de3805): a log emitted inside an
/// active W3C <see cref="Activity"/> carries that span's real trace/span id, and
/// falls back to the fabricated correlation uuid when no activity is in scope.
/// </summary>
public class TraceCorrelationTests
{
    private static (SmooLogger Logger, StringWriter Out) Build()
    {
        var writer = new StringWriter();
        return (new SmooLogger(new SmooLoggerOptions { Output = writer, PrettyPrint = false }), writer);
    }

    private static JsonElement ParseSingle(string captured)
    {
        var line = captured.Split('\n', StringSplitOptions.RemoveEmptyEntries)[0];
        return JsonDocument.Parse(line).RootElement;
    }

    [Fact]
    public void Log_Within_Active_Activity_Carries_Real_TraceAndSpanId()
    {
        // ActivitySource only starts activities when a listener samples them.
        using var source = new ActivitySource("smooai.logger.tests");
        using var listener = new ActivityListener
        {
            ShouldListenTo = s => s.Name == "smooai.logger.tests",
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllData,
        };
        ActivitySource.AddActivityListener(listener);

        var (logger, writer) = Build();
        using var activity = source.StartActivity("op");
        Assert.NotNull(activity);
        Assert.Equal(ActivityIdFormat.W3C, activity!.IdFormat);

        logger.LogInfo("inside span");
        var entry = ParseSingle(writer.ToString());

        Assert.Equal(activity.TraceId.ToHexString(), entry.GetProperty("traceId").GetString());
        Assert.Equal(activity.SpanId.ToHexString(), entry.GetProperty("spanId").GetString());
    }

    [Fact]
    public void Log_Without_Activity_Falls_Back_To_Correlation_Uuid()
    {
        // No listener registered here, and any ambient activity cleared.
        Activity.Current = null;

        var (logger, writer) = Build();
        logger.LogInfo("no span");
        var entry = ParseSingle(writer.ToString());

        // Prior behavior: traceId == the fabricated correlation id, no spanId emitted.
        Assert.Equal(entry.GetProperty("correlationId").GetString(), entry.GetProperty("traceId").GetString());
        Assert.False(entry.TryGetProperty("spanId", out _));
    }
}
