namespace SmooAI.Logger;

/// <summary>
/// SmooAI log levels. Codes match the TS port (trace=10, debug=20, info=30, warn=40, error=50, fatal=60).
/// </summary>
public enum Level
{
    Trace = 10,
    Debug = 20,
    Info = 30,
    Warn = 40,
    Error = 50,
    Fatal = 60,
}

internal static class LevelExtensions
{
    public static string ToWireString(this Level level) => level switch
    {
        Level.Trace => "trace",
        Level.Debug => "debug",
        Level.Info => "info",
        Level.Warn => "warn",
        Level.Error => "error",
        Level.Fatal => "fatal",
        _ => "info",
    };

    public static Microsoft.Extensions.Logging.LogLevel ToMsLogLevel(this Level level) => level switch
    {
        Level.Trace => Microsoft.Extensions.Logging.LogLevel.Trace,
        Level.Debug => Microsoft.Extensions.Logging.LogLevel.Debug,
        Level.Info => Microsoft.Extensions.Logging.LogLevel.Information,
        Level.Warn => Microsoft.Extensions.Logging.LogLevel.Warning,
        Level.Error => Microsoft.Extensions.Logging.LogLevel.Error,
        Level.Fatal => Microsoft.Extensions.Logging.LogLevel.Critical,
        _ => Microsoft.Extensions.Logging.LogLevel.Information,
    };

    public static Level FromString(string? value, Level fallback = Level.Info)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }
        return value.Trim().ToLowerInvariant() switch
        {
            "trace" => Level.Trace,
            "debug" => Level.Debug,
            "info" or "information" => Level.Info,
            "warn" or "warning" => Level.Warn,
            "error" => Level.Error,
            "fatal" or "critical" => Level.Fatal,
            _ => fallback,
        };
    }
}
