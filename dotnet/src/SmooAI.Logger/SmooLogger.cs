using System.Collections;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;

namespace SmooAI.Logger;

/// <summary>
/// Structured, contextual logger. .NET port of the TS <c>@smooai/logger</c> base Logger.
///
/// Thread-safety: all public mutators lock on an internal gate; <c>Log*</c> calls take a
/// snapshot of the context under the lock, so concurrent logging is safe.
/// </summary>
public class SmooLogger
{
    private static readonly JsonSerializerOptions CompactJson = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly JsonSerializerOptions PrettyJson = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly object _gate = new();
    private readonly Dictionary<string, object?> _context = new(StringComparer.Ordinal);
    private readonly TextWriter _output;
    private readonly ILogger? _forwardTo;
    private readonly bool _prettyPrint;
    private string _name;
    private Level _level;

    /// <summary>Logger name, emitted as <c>name</c> on every entry.</summary>
    public string Name
    {
        get { lock (_gate) { return _name; } }
        set { lock (_gate) { _name = value; } }
    }

    /// <summary>Minimum log level.</summary>
    public Level MinLevel
    {
        get { lock (_gate) { return _level; } }
        set { lock (_gate) { _level = value; } }
    }

    /// <summary>Snapshot of the current base context.</summary>
    public IReadOnlyDictionary<string, object?> Context
    {
        get
        {
            lock (_gate)
            {
                return new Dictionary<string, object?>(_context, StringComparer.Ordinal);
            }
        }
    }

    public SmooLogger() : this(new SmooLoggerOptions()) { }

    public SmooLogger(SmooLoggerOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        _name = options.Name;
        _level = options.Level ?? LevelExtensions.FromString(Environment.GetEnvironmentVariable("LOG_LEVEL"));
        _output = options.Output ?? Console.Out;
        _forwardTo = options.ForwardTo;
        _prettyPrint = options.PrettyPrint ?? IsLocalEnv();

        var correlationId = Guid.NewGuid().ToString();
        _context[ContextKey.CorrelationId] = correlationId;
        _context[ContextKey.RequestId] = correlationId;
        _context[ContextKey.TraceId] = correlationId;

        if (options.InitialContext != null)
        {
            foreach (var kv in options.InitialContext)
            {
                _context[kv.Key] = kv.Value;
            }
            if (options.InitialContext.TryGetValue(ContextKey.CorrelationId, out var cid) && cid is string cidStr && !string.IsNullOrEmpty(cidStr))
            {
                SetCorrelationIdUnlocked(cidStr);
            }
        }
    }

    /// <summary>Create a logger for a specific type, using the type name as the logger name.</summary>
    public static SmooLogger Create<T>(Action<SmooLoggerOptions>? configure = null)
    {
        var opts = new SmooLoggerOptions { Name = typeof(T).Name };
        configure?.Invoke(opts);
        return new SmooLogger(opts);
    }

    // ------------- Context mutators -------------

    public object? GetBaseContextKey(string key)
    {
        lock (_gate)
        {
            return _context.TryGetValue(key, out var v) ? v : null;
        }
    }

    public void AddBaseContextKey(string key, object? value)
    {
        lock (_gate)
        {
            _context[key] = value;
        }
    }

    /// <summary>Reset the base context and generate a fresh correlation ID.</summary>
    public void ResetContext()
    {
        lock (_gate)
        {
            _context.Clear();
            SetCorrelationIdUnlocked(Guid.NewGuid().ToString());
        }
    }

    /// <summary>
    /// Merge a dictionary into <c>context.context</c> (nested). Keys that already exist
    /// under the nested <c>context</c> bag are overwritten.
    /// </summary>
    public void AddContext(IDictionary<string, object?> ctx)
    {
        ArgumentNullException.ThrowIfNull(ctx);
        lock (_gate)
        {
            var nested = _context.TryGetValue(ContextKey.Context, out var existing) && existing is IDictionary<string, object?> dict
                ? new Dictionary<string, object?>(dict, StringComparer.Ordinal)
                : new Dictionary<string, object?>(StringComparer.Ordinal);

            foreach (var kv in ctx)
            {
                nested[kv.Key] = kv.Value;
            }
            _context[ContextKey.Context] = nested;
        }
    }

    /// <summary>Merge a dictionary into the top-level base context.</summary>
    public void AddBaseContext(IDictionary<string, object?> ctx)
    {
        ArgumentNullException.ThrowIfNull(ctx);
        lock (_gate)
        {
            foreach (var kv in ctx)
            {
                _context[kv.Key] = kv.Value;
            }
        }
    }

    /// <summary>Current correlation ID.</summary>
    public string? CorrelationId()
    {
        return GetBaseContextKey(ContextKey.CorrelationId) as string;
    }

    /// <summary>Generate + set a fresh correlation ID (also updates requestId + traceId).</summary>
    public void ResetCorrelationId()
    {
        SetCorrelationId(Guid.NewGuid().ToString());
    }

    /// <summary>Set correlation ID + request ID + trace ID to the same value.</summary>
    public void SetCorrelationId(string correlationId)
    {
        ArgumentException.ThrowIfNullOrEmpty(correlationId);
        lock (_gate)
        {
            SetCorrelationIdUnlocked(correlationId);
        }
    }

    private void SetCorrelationIdUnlocked(string correlationId)
    {
        _context[ContextKey.CorrelationId] = correlationId;
        _context[ContextKey.RequestId] = correlationId;
        _context[ContextKey.TraceId] = correlationId;
    }

    /// <summary>Add user context.</summary>
    public void AddUserContext(SmooUser? user)
    {
        if (user == null) return;
        AddBaseContext(new Dictionary<string, object?> { [ContextKey.User] = user });
    }

    /// <summary>Set the <c>namespace</c> field.</summary>
    public void SetNamespace(string value) => AddBaseContextKey(ContextKey.Namespace, value);

    /// <summary>Add an HTTP request to the <c>http.request</c> sub-context.</summary>
    public void AddHttpRequest(SmooHttpRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        lock (_gate)
        {
            var http = GetHttpBagUnlocked();
            http["request"] = request;
            _context[ContextKey.Http] = http;
        }
    }

    /// <summary>Add an HTTP response to the <c>http.response</c> sub-context.</summary>
    public void AddHttpResponse(SmooHttpResponse response)
    {
        ArgumentNullException.ThrowIfNull(response);
        lock (_gate)
        {
            var http = GetHttpBagUnlocked();
            http["response"] = response;
            _context[ContextKey.Http] = http;
        }
    }

    /// <summary>Merge telemetry fields into the base context.</summary>
    public void AddTelemetryFields(TelemetryFields fields)
    {
        ArgumentNullException.ThrowIfNull(fields);
        var bag = new Dictionary<string, object?>(StringComparer.Ordinal);
        if (fields.RequestId != null) bag[ContextKey.RequestId] = fields.RequestId;
        if (fields.Duration != null) bag[ContextKey.Duration] = fields.Duration;
        if (fields.TraceId != null) bag[ContextKey.TraceId] = fields.TraceId;
        if (fields.Namespace != null) bag[ContextKey.Namespace] = fields.Namespace;
        if (fields.Service != null) bag[ContextKey.Service] = fields.Service;
        if (fields.Error != null) bag[ContextKey.Error] = fields.Error;
        AddBaseContext(bag);
    }

    /// <summary>
    /// Push a scope with additional context. The returned <see cref="IDisposable"/> reverts
    /// the context to its prior state when disposed. Equivalent to ILogger.BeginScope.
    /// </summary>
    public IDisposable BeginScope(IDictionary<string, object?> scopeContext)
    {
        ArgumentNullException.ThrowIfNull(scopeContext);
        Dictionary<string, object?> snapshot;
        lock (_gate)
        {
            snapshot = new Dictionary<string, object?>(_context, StringComparer.Ordinal);
            foreach (var kv in scopeContext)
            {
                _context[kv.Key] = kv.Value;
            }
        }
        return new ScopeReverter(this, snapshot);
    }

    private sealed class ScopeReverter : IDisposable
    {
        private readonly SmooLogger _owner;
        private readonly Dictionary<string, object?> _snapshot;
        private bool _disposed;

        public ScopeReverter(SmooLogger owner, Dictionary<string, object?> snapshot)
        {
            _owner = owner;
            _snapshot = snapshot;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            lock (_owner._gate)
            {
                _owner._context.Clear();
                foreach (var kv in _snapshot)
                {
                    _owner._context[kv.Key] = kv.Value;
                }
            }
        }
    }

    // ------------- Logging -------------

    public bool IsEnabled(Level level) => level >= MinLevel;

    public void LogTrace(string message, object? data = null, Exception? error = null)
        => Emit(Level.Trace, message, data, error);

    public void LogDebug(string message, object? data = null, Exception? error = null)
        => Emit(Level.Debug, message, data, error);

    public void LogInfo(string message, object? data = null, Exception? error = null)
        => Emit(Level.Info, message, data, error);

    public void LogWarning(string message, object? data = null, Exception? error = null)
        => Emit(Level.Warn, message, data, error);

    public void LogError(string message, object? data = null, Exception? error = null)
        => Emit(Level.Error, message, data, error);

    public void LogFatal(string message, object? data = null, Exception? error = null)
        => Emit(Level.Fatal, message, data, error);

    /// <summary>Primary entry point — emit a structured log at the given level.</summary>
    public void Log(Level level, string message, object? data = null, Exception? error = null)
        => Emit(level, message, data, error);

    private void Emit(Level level, string message, object? data, Exception? error)
    {
        if (!IsEnabled(level))
        {
            return;
        }

        Dictionary<string, object?> entry;
        lock (_gate)
        {
            entry = new Dictionary<string, object?>(_context, StringComparer.Ordinal);
        }

        if (!string.IsNullOrEmpty(message))
        {
            entry[ContextKey.Message] = message;
        }

        if (data != null)
        {
            MergeDataIntoEntry(entry, data);
        }

        if (error != null)
        {
            ApplyError(entry, error);
            if (!entry.ContainsKey(ContextKey.Message) && entry.TryGetValue(ContextKey.Error, out var errMsg))
            {
                entry[ContextKey.Message] = errMsg;
            }
        }

        entry[ContextKey.Level] = (int)level;
        entry[ContextKey.LogLevel] = level.ToWireString();
        entry[ContextKey.Time] = DateTimeOffset.UtcNow.ToString("O");
        entry[ContextKey.Name] = _name;

        WriteEntry(entry, level, message, error);
    }

    private static void ApplyError(Dictionary<string, object?> entry, Exception error)
    {
        if (entry.TryGetValue(ContextKey.Error, out var existing) && existing is string prev && !string.IsNullOrEmpty(prev))
        {
            entry[ContextKey.Error] = $"{prev}; {error.Message}";
        }
        else
        {
            entry[ContextKey.Error] = error.Message;
        }

        var details = entry.TryGetValue(ContextKey.ErrorDetails, out var d) && d is List<object> existingList
            ? existingList
            : new List<object>();
        details.Add(SerializeException(error));
        entry[ContextKey.ErrorDetails] = details;
    }

    private static object SerializeException(Exception ex)
    {
        var dict = new Dictionary<string, object?>(StringComparer.Ordinal)
        {
            ["name"] = ex.GetType().Name,
            ["message"] = ex.Message,
            ["stack"] = ex.StackTrace,
        };
        if (ex.InnerException != null)
        {
            dict["cause"] = SerializeException(ex.InnerException);
        }
        return dict;
    }

    private static void MergeDataIntoEntry(Dictionary<string, object?> entry, object data)
    {
        // If data is a dictionary, merge into context.context.
        IDictionary<string, object?> incoming;
        if (data is IDictionary<string, object?> dict)
        {
            incoming = dict;
        }
        else if (data is IDictionary nonGeneric)
        {
            incoming = new Dictionary<string, object?>(StringComparer.Ordinal);
            foreach (DictionaryEntry de in nonGeneric)
            {
                incoming[de.Key.ToString() ?? ""] = de.Value;
            }
        }
        else
        {
            // Reflect public, readable properties (supports anonymous objects + records).
            incoming = new Dictionary<string, object?>(StringComparer.Ordinal);
            foreach (var prop in data.GetType().GetProperties(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Instance))
            {
                if (!prop.CanRead || prop.GetIndexParameters().Length > 0)
                {
                    continue;
                }
                incoming[prop.Name] = prop.GetValue(data);
            }
        }

        foreach (var kv in incoming)
        {
            if (kv.Value is Exception ex)
            {
                ApplyError(entry, ex);
            }
        }

        var nested = entry.TryGetValue(ContextKey.Context, out var existing) && existing is IDictionary<string, object?> existingDict
            ? new Dictionary<string, object?>(existingDict, StringComparer.Ordinal)
            : new Dictionary<string, object?>(StringComparer.Ordinal);

        foreach (var kv in incoming)
        {
            nested[kv.Key] = kv.Value;
        }
        entry[ContextKey.Context] = nested;
    }

    private void WriteEntry(Dictionary<string, object?> entry, Level level, string message, Exception? error)
    {
        var opts = _prettyPrint ? PrettyJson : CompactJson;
        string json;
        try
        {
            json = JsonSerializer.Serialize(entry, opts);
        }
        catch (Exception serializeEx)
        {
            // Fallback: strip the potentially-bad context and retry.
            var safe = new Dictionary<string, object?>(StringComparer.Ordinal)
            {
                [ContextKey.Level] = entry[ContextKey.Level],
                [ContextKey.LogLevel] = entry[ContextKey.LogLevel],
                [ContextKey.Time] = entry[ContextKey.Time],
                [ContextKey.Name] = entry[ContextKey.Name],
                [ContextKey.Message] = message,
                [ContextKey.Error] = serializeEx.Message,
            };
            json = JsonSerializer.Serialize(safe, opts);
        }

        var sb = new StringBuilder();
        sb.Append(json);
        sb.Append('\n');
        if (_prettyPrint)
        {
            // 3x dashed separators — matches TS output so log-viewer regexes keep working.
            const string bar = "----------------------------------------------------------------------------------------------------";
            sb.Append(bar).Append('\n');
            sb.Append(bar).Append('\n');
            sb.Append(bar).Append('\n');
        }

        var payload = sb.ToString();
        lock (_output)
        {
            _output.Write(payload);
            _output.Flush();
        }

        if (_forwardTo != null && _forwardTo.IsEnabled(level.ToMsLogLevel()))
        {
            _forwardTo.Log(
                level.ToMsLogLevel(),
                new EventId((int)level, level.ToWireString()),
                new StructuredLogState(entry, message),
                error,
                static (state, _) => state.Message);
        }
    }

    private Dictionary<string, object?> GetHttpBagUnlocked()
    {
        if (_context.TryGetValue(ContextKey.Http, out var existing) && existing is IDictionary<string, object?> dict)
        {
            return new Dictionary<string, object?>(dict, StringComparer.Ordinal);
        }
        return new Dictionary<string, object?>(StringComparer.Ordinal);
    }

    private static bool IsLocalEnv()
    {
        return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("IS_LOCAL"))
            || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("SST_DEV"))
            || !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("GITHUB_ACTIONS"));
    }

    /// <summary>
    /// Log state passed to the forwarded ILogger. Exposes the structured entry via
    /// <see cref="IReadOnlyList{KeyValuePair}"/> so Serilog / AWS.Logger can see each field.
    /// </summary>
    private sealed class StructuredLogState : IReadOnlyList<KeyValuePair<string, object?>>
    {
        private readonly List<KeyValuePair<string, object?>> _fields;

        public StructuredLogState(IDictionary<string, object?> entry, string message)
        {
            Message = message;
            _fields = new List<KeyValuePair<string, object?>>(entry.Count + 1);
            foreach (var kv in entry)
            {
                _fields.Add(new KeyValuePair<string, object?>(kv.Key, kv.Value));
            }
            _fields.Add(new KeyValuePair<string, object?>("{OriginalFormat}", message));
        }

        public string Message { get; }
        public int Count => _fields.Count;
        public KeyValuePair<string, object?> this[int index] => _fields[index];
        public IEnumerator<KeyValuePair<string, object?>> GetEnumerator() => _fields.GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
