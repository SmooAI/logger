using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using SmooAI.Logger;

namespace SmooAI.Logger.Tests;

public class SmooLoggerTests
{
    private static (SmooLogger Logger, StringWriter Out) Build(Action<SmooLoggerOptions>? configure = null)
    {
        var writer = new StringWriter();
        var opts = new SmooLoggerOptions { Output = writer, PrettyPrint = false };
        configure?.Invoke(opts);
        return (new SmooLogger(opts), writer);
    }

    private static JsonElement ParseSingle(string captured)
    {
        // Compact output: one JSON object per line. Grab the first line.
        var line = captured.Split('\n', StringSplitOptions.RemoveEmptyEntries)[0];
        return JsonDocument.Parse(line).RootElement;
    }

    [Fact]
    public void Emits_Required_Fields()
    {
        var (logger, writer) = Build(o => o.Name = "test");
        logger.LogInfo("hello world");
        var entry = ParseSingle(writer.ToString());

        Assert.Equal("hello world", entry.GetProperty("msg").GetString());
        Assert.Equal("info", entry.GetProperty("LogLevel").GetString());
        Assert.Equal(30, entry.GetProperty("level").GetInt32());
        Assert.Equal("test", entry.GetProperty("name").GetString());
        Assert.True(entry.TryGetProperty("time", out _));
        Assert.True(entry.TryGetProperty("correlationId", out _));
        Assert.True(entry.TryGetProperty("requestId", out _));
        Assert.True(entry.TryGetProperty("traceId", out _));
    }

    [Fact]
    public void Level_Filter_Suppresses_Below_Minimum()
    {
        var (logger, writer) = Build(o => o.Level = Level.Warn);
        logger.LogInfo("ignored");
        logger.LogWarning("emitted");

        var lines = writer.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Single(lines);
        Assert.Contains("emitted", lines[0]);
    }

    [Fact]
    public void SetCorrelationId_Updates_All_Tracking_Ids()
    {
        var (logger, writer) = Build();
        logger.SetCorrelationId("corr-xyz");
        logger.LogInfo("msg");
        var entry = ParseSingle(writer.ToString());

        Assert.Equal("corr-xyz", entry.GetProperty("correlationId").GetString());
        Assert.Equal("corr-xyz", entry.GetProperty("requestId").GetString());
        Assert.Equal("corr-xyz", entry.GetProperty("traceId").GetString());
    }

    [Fact]
    public void ResetContext_Clears_And_Generates_New_CorrelationId()
    {
        var (logger, _) = Build();
        var original = logger.CorrelationId();

        logger.AddBaseContextKey("service", "api");
        logger.ResetContext();

        Assert.Null(logger.GetBaseContextKey("service"));
        Assert.NotNull(logger.CorrelationId());
        Assert.NotEqual(original, logger.CorrelationId());
    }

    [Fact]
    public void AddContext_Merges_Into_Nested_Context_Bag()
    {
        var (logger, writer) = Build();
        logger.AddContext(new Dictionary<string, object?> { ["orderId"] = "ord_1" });
        logger.LogInfo("msg");

        var entry = ParseSingle(writer.ToString());
        var ctx = entry.GetProperty("context");
        Assert.Equal("ord_1", ctx.GetProperty("orderId").GetString());
    }

    [Fact]
    public void AddBaseContext_Merges_Into_Top_Level()
    {
        var (logger, writer) = Build();
        logger.AddBaseContext(new Dictionary<string, object?> { ["service"] = "api" });
        logger.LogInfo("msg");

        var entry = ParseSingle(writer.ToString());
        Assert.Equal("api", entry.GetProperty("service").GetString());
    }

    [Fact]
    public void Data_Anonymous_Object_Becomes_Nested_Context()
    {
        var (logger, writer) = Build();
        logger.LogInfo("placed", new { orderId = "ord_42", userId = "u_7" });

        var entry = ParseSingle(writer.ToString());
        var ctx = entry.GetProperty("context");
        Assert.Equal("ord_42", ctx.GetProperty("orderId").GetString());
        Assert.Equal("u_7", ctx.GetProperty("userId").GetString());
    }

    [Fact]
    public void Data_Dictionary_Merges_Into_Nested_Context()
    {
        var (logger, writer) = Build();
        var data = new Dictionary<string, object?> { ["foo"] = "bar" };
        logger.LogInfo("msg", data);

        var entry = ParseSingle(writer.ToString());
        Assert.Equal("bar", entry.GetProperty("context").GetProperty("foo").GetString());
    }

    [Fact]
    public void Exception_Parameter_Populates_Error_And_ErrorDetails()
    {
        var (logger, writer) = Build();
        var ex = new InvalidOperationException("boom");
        logger.LogError("something failed", error: ex);

        var entry = ParseSingle(writer.ToString());
        Assert.Equal("boom", entry.GetProperty("error").GetString());
        var details = entry.GetProperty("errorDetails");
        Assert.Equal(1, details.GetArrayLength());
        Assert.Equal("InvalidOperationException", details[0].GetProperty("name").GetString());
        Assert.Equal("boom", details[0].GetProperty("message").GetString());
    }

    [Fact]
    public void Exception_In_Data_Is_Detected()
    {
        var (logger, writer) = Build();
        logger.LogError("failed", new { err = new ArgumentNullException("paramX") });

        var entry = ParseSingle(writer.ToString());
        Assert.True(entry.TryGetProperty("error", out _));
        Assert.True(entry.TryGetProperty("errorDetails", out _));
    }

    [Fact]
    public void BeginScope_Reverts_On_Dispose()
    {
        var (logger, writer) = Build();
        using (logger.BeginScope(new Dictionary<string, object?> { ["scoped"] = "yes" }))
        {
            logger.LogInfo("inside");
        }
        logger.LogInfo("outside");

        var lines = writer.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        var inside = JsonDocument.Parse(lines[0]).RootElement;
        var outside = JsonDocument.Parse(lines[1]).RootElement;

        Assert.Equal("yes", inside.GetProperty("scoped").GetString());
        Assert.False(outside.TryGetProperty("scoped", out _));
    }

    [Fact]
    public void AddUserContext_Attaches_User_Object()
    {
        var (logger, writer) = Build();
        logger.AddUserContext(new SmooUser { Id = "u_1", Email = "a@b.com" });
        logger.LogInfo("msg");

        var entry = ParseSingle(writer.ToString());
        var user = entry.GetProperty("user");
        Assert.Equal("u_1", user.GetProperty("id").GetString());
        Assert.Equal("a@b.com", user.GetProperty("email").GetString());
    }

    [Fact]
    public void AddHttpRequest_Attaches_Under_http_request()
    {
        var (logger, writer) = Build();
        logger.AddHttpRequest(new SmooHttpRequest { Method = "POST", Path = "/orders", Hostname = "api.example" });
        logger.LogInfo("msg");

        var entry = ParseSingle(writer.ToString());
        var req = entry.GetProperty("http").GetProperty("request");
        Assert.Equal("POST", req.GetProperty("method").GetString());
        Assert.Equal("/orders", req.GetProperty("path").GetString());
    }

    [Fact]
    public void AddHttpResponse_Preserves_Existing_Request()
    {
        var (logger, writer) = Build();
        logger.AddHttpRequest(new SmooHttpRequest { Method = "GET", Path = "/x" });
        logger.AddHttpResponse(new SmooHttpResponse { StatusCode = 201 });
        logger.LogInfo("msg");

        var http = ParseSingle(writer.ToString()).GetProperty("http");
        Assert.Equal("GET", http.GetProperty("request").GetProperty("method").GetString());
        Assert.Equal(201, http.GetProperty("response").GetProperty("statusCode").GetInt32());
    }

    [Fact]
    public void AddTelemetryFields_Merges_Top_Level()
    {
        var (logger, writer) = Build();
        logger.AddTelemetryFields(new TelemetryFields { Service = "billing", Duration = 42.5, Namespace = "POST /charge" });
        logger.LogInfo("msg");

        var entry = ParseSingle(writer.ToString());
        Assert.Equal("billing", entry.GetProperty("service").GetString());
        Assert.Equal(42.5, entry.GetProperty("duration").GetDouble());
        Assert.Equal("POST /charge", entry.GetProperty("namespace").GetString());
    }

    [Fact]
    public void Create_Generic_Names_Logger_After_Type()
    {
        var logger = SmooLogger.Create<SmooLoggerTests>();
        Assert.Equal(nameof(SmooLoggerTests), logger.Name);
    }

    [Fact]
    public void InitialContext_Sets_CorrelationId()
    {
        var writer = new StringWriter();
        var logger = new SmooLogger(new SmooLoggerOptions
        {
            Output = writer,
            PrettyPrint = false,
            InitialContext = new Dictionary<string, object?> { ["correlationId"] = "cid-from-init" },
        });
        logger.LogInfo("msg");

        var entry = ParseSingle(writer.ToString());
        Assert.Equal("cid-from-init", entry.GetProperty("correlationId").GetString());
        Assert.Equal("cid-from-init", entry.GetProperty("requestId").GetString());
        Assert.Equal("cid-from-init", entry.GetProperty("traceId").GetString());
    }

    [Fact]
    public void ForwardTo_Receives_Structured_Entry()
    {
        var captured = new List<(LogLevel Level, string Message, List<KeyValuePair<string, object?>> Fields)>();
        var forward = new CaptureLogger(captured);
        var writer = new StringWriter();

        var logger = new SmooLogger(new SmooLoggerOptions
        {
            Output = writer,
            PrettyPrint = false,
            ForwardTo = forward,
        });
        logger.LogInfo("forwarded", new { orderId = "ord_99" });

        Assert.Single(captured);
        var (lvl, msg, fields) = captured[0];
        Assert.Equal(LogLevel.Information, lvl);
        Assert.Equal("forwarded", msg);
        Assert.Contains(fields, f => f.Key == "msg" && f.Value as string == "forwarded");
        Assert.Contains(fields, f => f.Key == "name");
    }

    [Fact]
    public void IsEnabled_Respects_Min_Level()
    {
        var (logger, _) = Build(o => o.Level = Level.Error);
        Assert.False(logger.IsEnabled(Level.Info));
        Assert.True(logger.IsEnabled(Level.Error));
        Assert.True(logger.IsEnabled(Level.Fatal));
    }

    [Fact]
    public void Concurrent_Logging_Does_Not_Throw()
    {
        var (logger, writer) = Build();
        var tasks = Enumerable.Range(0, 50).Select(i =>
            Task.Run(() => logger.LogInfo($"msg-{i}", new { i }))).ToArray();
        Task.WaitAll(tasks);

        var lines = writer.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(50, lines.Length);
        foreach (var line in lines)
        {
            JsonDocument.Parse(line); // must be valid JSON
        }
    }

    private sealed class CaptureLogger : ILogger
    {
        private readonly List<(LogLevel Level, string Message, List<KeyValuePair<string, object?>> Fields)> _captured;

        public CaptureLogger(List<(LogLevel, string, List<KeyValuePair<string, object?>>)> captured)
        {
            _captured = captured;
        }

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var fields = new List<KeyValuePair<string, object?>>();
            if (state is IEnumerable<KeyValuePair<string, object?>> enumerable)
            {
                fields.AddRange(enumerable);
            }
            _captured.Add((logLevel, formatter(state, exception), fields));
        }
    }
}
