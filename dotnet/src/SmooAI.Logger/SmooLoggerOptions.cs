namespace SmooAI.Logger;

/// <summary>
/// Options for constructing a <see cref="SmooLogger"/>. Mirrors the TS Logger constructor options.
/// </summary>
public sealed class SmooLoggerOptions
{
    /// <summary>Logger name, emitted as <c>name</c> on every entry.</summary>
    public string Name { get; set; } = "Logger";

    /// <summary>Minimum level to emit. Defaults to <c>LOG_LEVEL</c> env var, falling back to Info.</summary>
    public Level? Level { get; set; }

    /// <summary>
    /// Initial base context merged into the logger before any log call. Keys under this dictionary
    /// appear at the top level of every structured entry.
    /// </summary>
    public IDictionary<string, object?>? InitialContext { get; set; }

    /// <summary>Pretty-print output (multi-line indented JSON). Defaults true locally, false in deployed stages.</summary>
    public bool? PrettyPrint { get; set; }

    /// <summary>Optional <see cref="TextWriter"/> to write structured output to. Defaults to <see cref="Console.Out"/>.</summary>
    public TextWriter? Output { get; set; }

    /// <summary>
    /// Optional upstream <see cref="Microsoft.Extensions.Logging.ILogger"/> to forward structured entries to.
    /// When set, SmooLogger also calls <c>logger.Log(...)</c> with the structured scope so Serilog / CloudWatch
    /// sinks wired through <c>ILoggerFactory</c> continue to receive the entry.
    /// </summary>
    public Microsoft.Extensions.Logging.ILogger? ForwardTo { get; set; }
}
