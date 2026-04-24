using System.Text.Json.Serialization;

namespace SmooAI.Logger;

/// <summary>
/// Well-known context keys emitted in structured log output. Mirrors the TS
/// ContextKey enum so JSON shape is wire-compatible across language ports.
/// </summary>
public static class ContextKey
{
    public const string Level = "level";
    public const string LogLevel = "LogLevel";
    public const string Time = "time";
    public const string Message = "msg";
    public const string ErrorDetails = "errorDetails";

    public const string Name = "name";
    public const string CorrelationId = "correlationId";
    public const string User = "user";
    public const string Http = "http";
    public const string Context = "context";

    public const string RequestId = "requestId";
    public const string Duration = "duration";
    public const string TraceId = "traceId";
    public const string Error = "error";
    public const string Namespace = "namespace";
    public const string Service = "service";
}

/// <summary>
/// User context captured on the logger. Fields mirror the TS User type.
/// </summary>
public sealed class SmooUser
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("phone")] public string? Phone { get; set; }
    [JsonPropertyName("role")] public string? Role { get; set; }
    [JsonPropertyName("fullName")] public string? FullName { get; set; }
    [JsonPropertyName("firstName")] public string? FirstName { get; set; }
    [JsonPropertyName("lastName")] public string? LastName { get; set; }
    [JsonPropertyName("context")] public object? Context { get; set; }
}

/// <summary>
/// HTTP request context.
/// </summary>
public sealed class SmooHttpRequest
{
    [JsonPropertyName("protocol")] public string? Protocol { get; set; }
    [JsonPropertyName("hostname")] public string? Hostname { get; set; }
    [JsonPropertyName("path")] public string? Path { get; set; }
    [JsonPropertyName("method")] public string? Method { get; set; }
    [JsonPropertyName("queryString")] public string? QueryString { get; set; }
    [JsonPropertyName("sourceIp")] public string? SourceIp { get; set; }
    [JsonPropertyName("userAgent")] public string? UserAgent { get; set; }
    [JsonPropertyName("headers")] public IReadOnlyDictionary<string, string>? Headers { get; set; }
    [JsonPropertyName("body")] public object? Body { get; set; }
}

/// <summary>
/// HTTP response context.
/// </summary>
public sealed class SmooHttpResponse
{
    [JsonPropertyName("statusCode")] public int? StatusCode { get; set; }
    [JsonPropertyName("headers")] public IReadOnlyDictionary<string, string>? Headers { get; set; }
    [JsonPropertyName("body")] public object? Body { get; set; }
}

/// <summary>
/// Telemetry fields merged into the base context via <see cref="SmooLogger.AddTelemetryFields"/>.
/// </summary>
public sealed class TelemetryFields
{
    public string? RequestId { get; set; }
    public double? Duration { get; set; }
    public string? TraceId { get; set; }
    public string? Namespace { get; set; }
    public string? Service { get; set; }
    public string? Error { get; set; }
}
