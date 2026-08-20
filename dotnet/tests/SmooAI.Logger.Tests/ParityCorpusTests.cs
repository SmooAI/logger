using System.Text.Json;

namespace SmooAI.Logger.Tests;

/// <summary>
/// Golden-vector parity corpus (ADR-089 pattern, as used by @smooai/audit).
///
/// Asserts the .NET port satisfies the same contract every other port
/// (TypeScript / Python / Rust / Go) is held to, from the same committed file.
/// A failure here means either this port drifted or the shared contract moved —
/// fix the port, not the corpus.
/// </summary>
public class ParityCorpusTests
{
    /// <summary>Bumped alongside the corpus's own `version` when its shape changes.</summary>
    private const int CorpusVersion = 2;

    private static readonly JsonElement Corpus = LoadCorpus();

    private static JsonElement LoadCorpus()
    {
        // Copied next to the test assembly by the .csproj so it resolves from
        // the run directory, not from a guessed number of `..` hops.
        var path = Path.Combine(AppContext.BaseDirectory, "parity-corpus.json");
        return JsonDocument.Parse(File.ReadAllText(path)).RootElement.Clone();
    }

    private static string Field(string concept) =>
        Corpus.GetProperty("fieldNames").GetProperty(concept).GetString()!;

    private static IEnumerable<JsonElement> Levels() =>
        Corpus.GetProperty("levels").GetProperty("rows").EnumerateArray();

    private static string CorpusMessage => Corpus.GetProperty("record").GetProperty("message").GetString()!;

    private static JsonElement Emit(string level, string message, JsonElement? context, Action<SmooLogger>? configure = null)
    {
        var writer = new StringWriter();
        var logger = new SmooLogger(new SmooLoggerOptions
        {
            Output = writer,
            PrettyPrint = false,
            Name = "ParityCorpus",
            Level = Level.Trace,
        });
        configure?.Invoke(logger);

        object? data = context is { } c ? JsonSerializer.Deserialize<Dictionary<string, object?>>(c.GetRawText()) : null;
        logger.Log(ParseLevel(level), message, data);

        var lines = writer.ToString().Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Single(lines);
        return JsonDocument.Parse(lines[0]).RootElement.Clone();
    }

    private static Level ParseLevel(string name) => name switch
    {
        "trace" => Level.Trace,
        "debug" => Level.Debug,
        "info" => Level.Info,
        "warn" => Level.Warn,
        "error" => Level.Error,
        "fatal" => Level.Fatal,
        _ => throw new Xunit.Sdk.XunitException($"corpus names level '{name}', which the .NET port does not expose"),
    };

    [Fact]
    public void Corpus_Is_The_Shape_This_Loader_Understands()
    {
        Assert.Equal(CorpusVersion, Corpus.GetProperty("version").GetInt32());
        Assert.NotEmpty(Levels());
    }

    [Fact]
    public void Level_Wire_Shape_Matches_Corpus()
    {
        foreach (var row in Levels())
        {
            var name = row.GetProperty("name").GetString()!;
            var record = Emit(name, CorpusMessage, null);

            // level -> pino-compatible NUMERIC code
            var level = record.GetProperty(Field("level"));
            Assert.Equal(JsonValueKind.Number, level.ValueKind);
            Assert.Equal(row.GetProperty("level").GetInt32(), level.GetInt32());

            // LogLevel -> canonical lowercase STRING
            var logLevel = record.GetProperty(Field("logLevel"));
            Assert.Equal(JsonValueKind.String, logLevel.ValueKind);
            Assert.Equal(row.GetProperty("LogLevel").GetString(), logLevel.GetString());
        }
    }

    [Fact]
    public void Every_Record_Carries_The_Required_Fields()
    {
        var required = Corpus.GetProperty("record").GetProperty("requiredFields")
            .EnumerateArray().Select(f => f.GetString()!).ToArray();

        foreach (var row in Levels())
        {
            var name = row.GetProperty("name").GetString()!;
            var record = Emit(name, CorpusMessage, null);
            foreach (var field in required)
            {
                Assert.True(record.TryGetProperty(field, out var value), $"{name}: required field '{field}' missing");
                Assert.NotEqual(JsonValueKind.Null, value.ValueKind);
            }
        }
    }

    [Fact]
    public void Wire_Field_Names_Match_Corpus()
    {
        var actual = new Dictionary<string, string>
        {
            ["level"] = ContextKey.Level,
            ["logLevel"] = ContextKey.LogLevel,
            ["time"] = ContextKey.Time,
            ["message"] = ContextKey.Message,
            ["name"] = ContextKey.Name,
            ["context"] = ContextKey.Context,
            ["correlationId"] = ContextKey.CorrelationId,
            ["requestId"] = ContextKey.RequestId,
            ["traceId"] = ContextKey.TraceId,
            ["spanId"] = ContextKey.SpanId,
            ["namespace"] = ContextKey.Namespace,
            ["service"] = ContextKey.Service,
            ["duration"] = ContextKey.Duration,
            ["error"] = ContextKey.Error,
            ["errorDetails"] = ContextKey.ErrorDetails,
            ["user"] = ContextKey.User,
            ["http"] = ContextKey.Http,
        };

        foreach (var entry in Corpus.GetProperty("fieldNames").EnumerateObject())
        {
            Assert.True(actual.ContainsKey(entry.Name),
                $"corpus names concept '{entry.Name}', which this test does not map to a ContextKey");
            Assert.Equal(entry.Value.GetString(), actual[entry.Name]);
        }
    }

    [Fact]
    public void Message_Shape_Matches_Corpus()
    {
        foreach (var testCase in Corpus.GetProperty("messageShape").GetProperty("cases").EnumerateArray())
        {
            var name = testCase.GetProperty("name").GetString()!;
            var context = testCase.GetProperty("context");
            var record = Emit("info", testCase.GetProperty("message").GetString()!,
                context.ValueKind == JsonValueKind.Object ? context : null);

            Assert.Equal(testCase.GetProperty("expectMsg").GetString(),
                record.GetProperty(Field("message")).GetString());

            if (testCase.TryGetProperty("expectContext", out var expected) && expected.ValueKind == JsonValueKind.Object)
            {
                var actual = record.GetProperty(Field("context"));
                foreach (var property in expected.EnumerateObject())
                {
                    Assert.Equal(property.Value.GetString(), actual.GetProperty(property.Name).GetString());
                }
            }
            else
            {
                // A bare string message must not leak into `context`.
                Assert.False(record.TryGetProperty(Field("context"), out _), $"{name}: bare message leaked into context");
            }
        }
    }

    [Fact]
    public void CorrelationId_Surfaces_And_Mirrors()
    {
        var correlation = Corpus.GetProperty("correlationId");
        var expected = correlation.GetProperty("value").GetString()!;

        var record = Emit("info", CorpusMessage, null, logger => logger.SetCorrelationId(expected));

        Assert.Equal(expected, record.GetProperty(correlation.GetProperty("field").GetString()!).GetString());
        foreach (var mirrored in correlation.GetProperty("alsoSets").EnumerateArray())
        {
            var key = mirrored.GetString()!;
            Assert.Equal(expected, record.GetProperty(key).GetString());
        }
    }

    [Fact]
    public void Default_Redact_Keys_Match_Corpus_In_Order()
    {
        var redaction = Corpus.GetProperty("redaction");
        var expected = redaction.GetProperty("defaultKeys").EnumerateArray().Select(k => k.GetString()!).ToArray();

        Assert.Equal(expected, SmooLogger.DefaultRedactKeys.ToArray());
        Assert.Equal(SmooLogger.RedactedValue, redaction.GetProperty("placeholder").GetString());
    }

    [Fact]
    public void Redaction_Matches_Corpus()
    {
        var redaction = Corpus.GetProperty("redaction");
        var placeholder = redaction.GetProperty("placeholder").GetString();

        foreach (var testCase in redaction.GetProperty("cases").EnumerateArray())
        {
            var name = testCase.GetProperty("name").GetString()!;
            var record = Emit("info", CorpusMessage, testCase.GetProperty("context"));
            var context = record.GetProperty(Field("context"));

            foreach (var key in testCase.GetProperty("redacted").EnumerateArray())
            {
                Assert.Equal(placeholder, context.GetProperty(key.GetString()!).GetString());
            }
            foreach (var property in testCase.GetProperty("preserved").EnumerateObject())
            {
                Assert.Equal(property.Value.GetString(), context.GetProperty(property.Name).GetString());
            }
        }
    }
}
