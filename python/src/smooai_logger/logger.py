import copy
import inspect
import json
import logging
import os
import sys
import threading
import traceback
import uuid
from enum import Enum
from logging.handlers import RotatingFileHandler, TimedRotatingFileHandler
from typing import Any, TypedDict, cast

import pendulum
from colorist import Color, Effect
from rich import pretty

from .utils.date import now
from .utils.json import JsonEncoder

pretty.install()


# --------------------------------------------------------------------------------
# Environment Utilities (mirroring TypeScript)
# --------------------------------------------------------------------------------
MAIN_ENVIRONMENTS: list[str] = ["development", "staging", "production"]


def is_build() -> bool:
    return bool(os.getenv("GITHUB_ACTIONS"))


def is_local() -> bool:
    return bool(os.getenv("SST_DEV")) or bool(os.getenv("IS_LOCAL")) or (bool(os.getenv("IS_DEPLOYED_STAGE")) and os.getenv("IS_DEPLOYED_STAGE") != "true")


def level_to_code(level: "Level") -> int:
    return {
        Level.TRACE: 10,
        Level.DEBUG: 20,
        Level.INFO: 30,
        Level.WARN: 40,
        Level.ERROR: 50,
        Level.FATAL: 60,
    }.get(level, 999)


def is_log_level_enabled(limit: "Level") -> bool:
    lvl = os.getenv("LOG_LEVEL", Level.INFO.value)
    try:
        current = Level(lvl.lower())  # Convert to lowercase to match enum values
    except ValueError:
        current = Level.INFO
    return level_to_code(limit) >= level_to_code(current)


# --------------------------------------------------------------------------------
# Rotation Configuration
# --------------------------------------------------------------------------------
def parse_size(size_str: str) -> int:
    """Parse size string like '1M', '10K', '1G' to bytes."""
    size_str = size_str.upper()
    if size_str.endswith("K"):
        return int(size_str[:-1]) * 1024
    elif size_str.endswith("M"):
        return int(size_str[:-1]) * 1024 * 1024
    elif size_str.endswith("G"):
        return int(size_str[:-1]) * 1024 * 1024 * 1024
    else:
        return int(size_str)


def parse_interval(interval_str: str) -> tuple[int, str]:
    """Parse interval string like '1d', '2h', '30m', '1M' to (count, unit)."""
    interval_str = interval_str.lower()
    if interval_str.endswith("m"):
        return int(interval_str[:-1]), "M"  # Minutes
    elif interval_str.endswith("h"):
        return int(interval_str[:-1]), "H"  # Hours
    elif interval_str.endswith("d"):
        return int(interval_str[:-1]), "D"  # Days
    elif interval_str.endswith("w"):
        return int(interval_str[:-1]), "W0"  # Weeks (Monday)
    elif interval_str.endswith("M"):
        return int(interval_str[:-1]), "M"  # Months (same as minutes for TimedRotatingFileHandler)
    else:
        return int(interval_str), "D"  # Default to days


class RotationOptions(TypedDict, total=False):
    path: str  # Directory path for log files (default: '.smooai-logs')
    filenamePrefix: str  # Prefix for log file names (default: 'output')
    extension: str  # File extension (default: 'log')
    size: str  # File size limit (e.g., '1M', '10K', '1G')
    interval: str  # Time-based rotation (e.g., '1d', '2h', '30m', '1M')
    maxFiles: int  # Maximum number of rotated files to keep
    maxSize: str  # Maximum total size of rotated files
    immutable: bool  # Use immutable file names
    intervalBoundary: bool  # Use interval boundaries for time-based rotation
    intervalUTC: bool  # Use UTC time for interval boundaries
    initialRotation: bool  # Perform initial rotation check on startup
    mode: int  # File permissions (Unix file mode)
    encoding: str  # File encoding


class RotationConfig:
    """Configuration for log file rotation with pendulum DateTime support."""

    def __init__(self, options: RotationOptions | None = None):
        # Default configuration
        self.path: str = ".smooai-logs"
        self.filenamePrefix: str = "output"
        self.extension: str = "ansi"
        self.size: str | None = "1M"  # 1MB default
        self.interval: str | None = "1d"  # Daily default
        self.maxFiles: int = 5
        self.maxSize: str | None = "100M"  # 100MB total default
        self.immutable: bool = False
        self.intervalBoundary: bool = True
        self.intervalUTC: bool = False
        self.initialRotation: bool = True
        self.mode: int = 0o644
        self.encoding: str = "utf-8"

        # Update with provided options
        if options:
            for key, value in options.items():
                if hasattr(self, key):
                    setattr(self, key, value)

    def get_log_directory(self) -> str:
        """Get the full log directory path."""
        return os.path.join(self.path, self._get_date_folder())

    def _get_date_folder(self) -> str:
        """Generate date folder in YYYY-MM format."""
        now_dt = pendulum.now("UTC" if self.intervalUTC else None)
        return now_dt.format("YYYY-MM")

    def get_filename(self, index: int = 0) -> str:
        """Generate filename with date and index."""
        now_dt = pendulum.now("UTC" if self.intervalUTC else None)
        date_str = now_dt.format("YYYY-MM-DD")
        return f"{self.filenamePrefix}-{date_str}-{index}.{self.extension}"

    def get_full_path(self, index: int = 0) -> str:
        """Get full file path including directory."""
        return os.path.join(self.get_log_directory(), self.get_filename(index))


# --------------------------------------------------------------------------------
# Context TypedDicts for Intellisense
# --------------------------------------------------------------------------------
class HttpRequestContext(TypedDict, total=False):
    method: str | None
    path: str | None
    protocol: str | None
    sourceIp: str | None
    userAgent: str | None
    headers: dict[str, str] | None
    queryString: str | None
    body: Any


class HttpResponseContext(TypedDict, total=False):
    statusCode: int | None
    body: str | None
    headers: dict[str, str] | None


class HttpContext(TypedDict, total=False):
    request: HttpRequestContext | None
    response: HttpResponseContext | None


class CallerContext(TypedDict, total=False):
    stack: list[str] | None


# AWS & ECS Context types for IntelliSense
class ECSContext(TypedDict, total=False):
    containerCredentialsRelativeUri: str | None
    containerMetadataUriV4: str | None
    containerMetadataUri: str | None
    agentUri: str | None
    executionEnv: str | None
    defaultRegion: str | None
    region: str | None


class LambdaEnvContext(TypedDict, total=False):
    functionName: str | None
    functionVersion: str | None
    executionEnv: str | None
    logGroupName: str | None
    logStreamName: str | None
    memorySizeMB: str | None
    requestId: str | None
    remainingTimeMs: int | None


class Context(TypedDict, total=False):
    level: str | None
    msg: str | None
    time: str | None
    name: str | None
    correlationId: str | None
    requestId: str | None
    traceId: str | None
    namespace: str | None
    service: str | None
    error: str | None
    errorDetails: list[dict[str, Any]] | None
    errors: list[dict[str, Any]] | None
    context: dict[str, Any] | None
    user: dict[str, Any] | None
    http: HttpContext | None
    callerContext: CallerContext | None
    ecs: ECSContext | None
    awsLambda: LambdaEnvContext | None


# --------------------------------------------------------------------------------
# Global Context Singleton
# --------------------------------------------------------------------------------
_global_context: Context = {}
_context_lock = threading.Lock()


def _get_global_context() -> Context:
    """Get the global context singleton."""
    with _context_lock:
        return _global_context.copy()


def _set_global_context(context: Context) -> None:
    """Set the global context singleton."""
    with _context_lock:
        global _global_context
        _global_context = context.copy()


def get_global_context() -> Context:
    """Public accessor for the global context singleton."""
    return _get_global_context()


def set_global_context(context: Context) -> None:
    """Public setter for the global context singleton."""
    _set_global_context(context)


def _update_global_context(context: Context) -> None:
    """Update the global context singleton by merging."""
    with _context_lock:
        global _global_context
        _global_context.update(context)


def _reset_global_context() -> None:
    """Reset the global context singleton to initial state."""
    with _context_lock:
        global _global_context
        default_id = str(uuid.uuid4())
        _global_context = {
            "correlationId": default_id,
            "requestId": default_id,
            "traceId": default_id,
        }


# Initialize global context
_reset_global_context()


def reset_global_context() -> None:
    """Reset the global context singleton to initial state."""
    _reset_global_context()


# --------------------------------------------------------------------------------
class Level(str, Enum):
    TRACE = "trace"
    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
    FATAL = "fatal"


class Logger:
    """
    Structured JSON logger with context, call-site, HTTP helpers, pretty printing,
    and advanced rotating-file logging with pendulum DateTime support.
    """

    def __init__(
        self,
        name: str | None = None,
        level: Level | None = None,
        context: Context | None = None,
        pretty_print: bool | None = None,
        log_to_file: bool | None = None,
        rotation_options: RotationOptions | None = None,
    ) -> None:
        # Initialize global context if provided
        if context:
            _update_global_context(context)

        self._name: str = name or "Logger"
        self._level: Level = level or self._parse_level(os.getenv("LOG_LEVEL"))
        self.pretty_print: bool = pretty_print if pretty_print is not None else (is_local() or is_build())
        self.log_to_file: bool = log_to_file if log_to_file is not None else is_local()

        # Initialize file logging attributes
        self._file_logger: logging.Logger | None = None
        self._file_handler: RotatingFileHandler | TimedRotatingFileHandler | None = None
        self._rotation_config: RotationConfig | None = None

        # Set up rotating file if requested
        if self.log_to_file:
            self._setup_rotation_handler(rotation_options)

    def reset_context(self) -> None:
        """Reset the global context to its initial state."""
        _reset_global_context()

    def _setup_rotation_handler(self, rotation_options: RotationOptions | None = None) -> None:
        """Set up advanced rotation handler with pendulum DateTime support."""
        self._rotation_config = RotationConfig(rotation_options)

        # Ensure log directory exists
        log_dir = self._rotation_config.get_log_directory()
        os.makedirs(log_dir, exist_ok=True)

        # Get initial file path
        log_file = self._rotation_config.get_full_path()

        self._file_logger = logging.getLogger(f"{self._name}.file")
        self._file_logger.setLevel(logging.NOTSET)

        # Determine rotation type and create appropriate handler
        if self._rotation_config.interval and self._rotation_config.size:
            # Both time and size-based rotation
            self._setup_timed_rotating_handler(log_file)
        elif self._rotation_config.interval:
            # Time-based rotation only
            self._setup_timed_rotating_handler(log_file)
        else:
            # Size-based rotation only (default)
            self._setup_size_rotating_handler(log_file)

    def _setup_size_rotating_handler(self, log_file: str) -> None:
        """Set up size-based rotating file handler."""
        if not self._rotation_config:
            return

        max_bytes = parse_size(self._rotation_config.size or "1M")
        backup_count = self._rotation_config.maxFiles

        handler = RotatingFileHandler(log_file, maxBytes=max_bytes, backupCount=backup_count, encoding=self._rotation_config.encoding)
        handler.setLevel(logging.NOTSET)
        handler.setFormatter(logging.Formatter("%(message)s"))

        if self._file_logger:
            self._file_logger.addHandler(handler)
        self._file_handler = handler

    def _setup_timed_rotating_handler(self, log_file: str) -> None:
        """Set up time-based rotating file handler."""
        if not self._rotation_config or not self._rotation_config.interval:
            return

        interval_count, interval_unit = parse_interval(self._rotation_config.interval)

        handler = TimedRotatingFileHandler(
            log_file, when=interval_unit, interval=interval_count, backupCount=self._rotation_config.maxFiles, encoding=self._rotation_config.encoding
        )
        handler.setLevel(logging.NOTSET)
        handler.setFormatter(logging.Formatter("%(message)s"))

        if self._file_logger:
            self._file_logger.addHandler(handler)
        self._file_handler = handler

    def _get_current_log_file(self) -> str:
        """Get the current log file path based on rotation config."""
        if not self._rotation_config:
            return "app.log"
        return self._rotation_config.get_full_path()

    @property
    def name(self) -> str:
        return self._name

    @name.setter
    def name(self, v: str) -> None:
        self._name = v

    @property
    def level(self) -> Level:
        return self._level

    @level.setter
    def level(self, v: Level) -> None:
        self._level = v

    @property
    def context(self) -> Context:
        return cast(Context, cast(object, _get_global_context()))

    @context.setter
    def context(self, v: Context) -> None:
        _set_global_context(v)

    @property
    def correlation_id(self) -> str | None:
        return cast(str | None, _get_global_context().get("correlationId"))

    @correlation_id.setter
    def correlation_id(self, v: str | None) -> None:
        context = _get_global_context()
        if v is None:
            context.pop("correlationId", None)
        else:
            context["correlationId"] = str(v)
        _set_global_context(context)

    @property
    def correlation_id(self) -> str | None:
        """CamelCase alias to match the TypeScript Logger API."""
        return self.correlation_id

    @correlation_id.setter
    def correlation_id(self, v: str | None) -> None:
        self.correlation_id = v

    def _parse_level(self, lvl: str | None) -> Level:
        if not lvl:
            return Level.INFO
        try:
            return Level(lvl.lower())
        except ValueError:
            return Level.INFO

    def _is_enabled(self, lvl: Level) -> bool:
        return level_to_code(lvl) >= level_to_code(self._level)

    def _clone(self, obj: Any) -> Any:
        return copy.deepcopy(obj)

    def _remove_none(self, obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k: self._remove_none(v) for k, v in obj.items() if v is not None}  # pyright: ignore[reportUnknownVariableType]
        if isinstance(obj, list):
            return [self._remove_none(v) for v in obj if v is not None]  # pyright: ignore[reportUnknownVariableType]
        return obj

    def _apply_context_config(self, rec: Context) -> Context:
        # Stub for future context-config filtering
        return rec

    def add_request_context(self, request: HttpRequestContext) -> None:
        """Attach generic HTTP request context."""
        context = _get_global_context()
        if "http" not in context or context["http"] is None:
            context["http"] = {}
        if "http" in context and context["http"] is not None:  # pyright: ignore[reportUnnecessaryComparison]
            if "request" not in context["http"] or context["http"]["request"] is None:
                context["http"]["request"] = {}
            context["http"]["request"] = request
        _set_global_context(context)

    def add_response_context(self, response: HttpResponseContext) -> None:
        """Attach generic HTTP response context."""
        context = _get_global_context()
        if "http" not in context or context["http"] is None:
            context["http"] = {}
        if "http" in context and context["http"] is not None:  # pyright: ignore[reportUnnecessaryComparison]
            if "response" not in context["http"] or context["http"]["response"] is None:
                context["http"]["response"] = {}
            context["http"]["response"] = response
        _set_global_context(context)

    def add_context(self, context_data: dict[str, Any]) -> None:
        """Add context data by merging with existing context."""
        global_context = _get_global_context()
        if "context" not in global_context or global_context["context"] is None:
            global_context["context"] = {}
        global_context["context"].update(context_data)
        _set_global_context(global_context)

    def add_base_context(self, context_data: Context) -> None:
        """Add base context data by merging with existing context."""
        assert _get_global_context() is not None
        _update_global_context(cast(Context, cast(object, context_data)))

    def _extract_exceptions_from_context(self, obj: Any) -> list[Exception]:
        """Recursively find all Exception instances in a dict, list, or tuple."""
        found: list[Exception] = []
        if isinstance(obj, Exception):
            found.append(obj)
        elif isinstance(obj, dict):
            for v in obj.values():
                found.extend(self._extract_exceptions_from_context(v))
        elif isinstance(obj, list | tuple):
            for v in obj:
                found.extend(self._extract_exceptions_from_context(v))
        return found

    def _get_callsite(self, depth: int = 4, max_depth: int = 10) -> list[str]:
        frames = inspect.stack()[depth:]
        if len(frames) > max_depth:
            frames = frames[:max_depth]
        return [f"{frame.filename}:{frame.lineno} in {frame.function}" for frame in frames]

    def _build_record(self, lvl: Level, args: list[Any]) -> Context:
        rec: Context = self._clone(_get_global_context())
        # callsite
        rec["callerContext"] = {"stack": self._get_callsite()}
        msgs: list[str] = []
        all_exceptions: list[Exception] = []
        all_error_details: list[dict[str, Any]] = []
        for a in args:
            if isinstance(a, Exception):
                all_exceptions.append(a)
                all_error_details.append(
                    {
                        "type": type(a).__name__,
                        "message": str(a),
                        "stack": traceback.format_exception(type(a), a, a.__traceback__),
                    }
                )
            elif isinstance(a, dict):
                exceptions = self._extract_exceptions_from_context(a)
                for exc in exceptions:
                    all_exceptions.append(exc)
                    all_error_details.append(
                        {
                            "type": type(exc).__name__,
                            "message": str(exc),
                            "stack": traceback.format_exception(type(exc), exc, exc.__traceback__),
                        }
                    )
                if "context" not in rec or rec["context"] is None:
                    rec["context"] = {}
                if "context" in rec and rec["context"] is not None:  # pyright: ignore[reportUnnecessaryComparison]
                    rec["context"].update(a)  # pyright: ignore[reportUnknownArgumentType]
            elif isinstance(a, str):
                msgs.append(a)
            else:
                if "context" not in rec or rec["context"] is None:
                    rec["context"] = {}
                if "context" in rec and rec["context"] is not None:  # pyright: ignore[reportUnnecessaryComparison]
                    objects = rec["context"].get("objects", [])
                    objects.append(a)
                    rec["context"].update({"objects": objects})  # pyright: ignore[reportUnknownArgumentType]
        # Set error fields according to the number of exceptions found
        if all_exceptions:
            # Always set error and errorDetails for the first error
            rec["error"] = str(all_exceptions[0])
            rec["errorDetails"] = [all_error_details[0]]
            # If more than one error, set errors array
            if len(all_exceptions) > 1:
                rec["errors"] = [
                    {
                        "error": str(exc),
                        "errorDetails": [detail],
                    }
                    for exc, detail in zip(all_exceptions, all_error_details, strict=False)
                ]
        if msgs:
            rec["msg"] = "; ".join(msgs)
        rec["level"] = lvl.value
        rec["time"] = now().isoformat()
        rec["name"] = self._name
        # reorder keys: msg, time, error, errorDetails, errors first
        ordered = {}
        for key in ["msg", "time", "error", "errorDetails", "errors"]:
            if key in rec:
                ordered[key] = rec.pop(key)
        ordered.update(rec)  # pyright: ignore[reportUnknownMemberType]
        return self._remove_none(self._apply_context_config(cast(Context, cast(object, ordered))))

    def _pretty_emit(self, record: Context) -> None:
        sep = "-" * 100
        print(sep)
        print(sep)
        print(sep)
        js = json.dumps(record, indent=2, cls=JsonEncoder)
        for line in js.splitlines():
            if '"msg":' in line:
                key, val = line.split(": ", 1)
                styled = f"{Color.GREEN}{Effect.BOLD}{val}{Effect.BOLD_OFF}{Color.OFF}"
                print(f"{key}: {styled}")
            elif '"time":' in line:
                key, val = line.split(": ", 1)
                styled = f"{Color.BLUE}{val}{Color.OFF}"
                print(f"{key}: {styled}")
            elif '"error":' in line or '"errorDetails":' in line:
                print(f"{Color.RED}{line}{Color.OFF}")
            elif '"correlationId":' in line:
                key, val = line.split(": ", 1)
                styled = f"{Color.YELLOW}{val}{Color.OFF}"
                print(f"{key}: {styled}")
            else:
                print(line)

    def _emit(self, record: Context) -> None:
        # 1) Print to stdout (JSON or pretty)
        if self.pretty_print:
            self._pretty_emit(record)
        else:
            sys.stdout.write(json.dumps(record, cls=JsonEncoder) + "\n")

        # 2) Also write to rotating file, if enabled
        if self.log_to_file and self._file_logger is not None:
            json_str = json.dumps(record, indent=2, cls=JsonEncoder)
            json_str_lines = []
            for line in json_str.splitlines():
                if '"msg":' in line:
                    key, val = line.split(": ", 1)
                    styled = f"{Color.GREEN}{Effect.BOLD}{val}{Effect.BOLD_OFF}{Color.OFF}"
                    json_str_lines.append(f"{key}: {styled}")
                elif '"time":' in line:
                    key, val = line.split(": ", 1)
                    styled = f"{Color.BLUE}{val}{Color.OFF}"
                    json_str_lines.append(f"{key}: {styled}")
                elif '"error":' in line or '"errorDetails":' in line:
                    json_str_lines.append(f"{Color.RED}{line}{Color.OFF}")
                else:
                    json_str_lines.append(line)
            json_str = "\n".join(json_str_lines)
            sep = "-" * 100
            json_str = sep + "\n" + json_str + "\n" + sep + "\n"

            log_rec = logging.LogRecord(
                name=self._name,
                level=level_to_code(Level.INFO),  # level doesn't matter for rollover
                pathname=__file__,
                lineno=0,
                msg=json_str,
                args=(),
                exc_info=None,
            )
            # emit via our file-only logger
            self._file_logger.handle(log_rec)

    def _log(self, lvl: Level, *args: Any) -> None:
        if self._is_enabled(lvl):
            rec = self._build_record(lvl, list(args))
            self._emit(rec)

    def trace(self, *args: Any) -> None:
        self._log(Level.TRACE, *args)

    def debug(self, *args: Any) -> None:
        self._log(Level.DEBUG, *args)

    def info(self, *args: Any) -> None:
        self._log(Level.INFO, *args)

    def warn(self, *args: Any) -> None:
        self._log(Level.WARN, *args)

    def warning(self, *args: Any) -> None:
        self._log(Level.WARN, *args)

    def error(self, *args: Any) -> None:
        self._log(Level.ERROR, *args)

    def fatal(self, *args: Any) -> None:
        self._log(Level.FATAL, *args)
