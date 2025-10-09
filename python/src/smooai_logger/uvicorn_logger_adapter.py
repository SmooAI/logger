import logging
from typing import Any

from .aws_logger import AwsServerLogger


class UvicornLoggerAdapter(logging.Logger):
    """
    Adapts a custom logger to the interface expected by uvicorn.
    Inherits from logging.Logger to be compatible with uvicorn's logging system.
    """

    def __init__(self, logger: AwsServerLogger, name: str = "uvicorn") -> None:
        super().__init__(name)
        self.aws_logger: AwsServerLogger = logger

    def info(self, msg: str, *args: Any, **kwargs: Any) -> None:
        # Format the message if args are provided
        if args:
            msg = msg % args
        self.aws_logger.info(f"[Uvicorn] {msg}")

    def warning(self, msg: str, *args: Any, **kwargs: Any) -> None:
        if args:
            msg = msg % args
        if hasattr(self.aws_logger, "warn"):
            self.aws_logger.warn(f"[Uvicorn] {msg}")
        else:
            self.aws_logger.info(f"[Uvicorn WARNING] {msg}")

    def error(self, msg: str, *args: Any, **kwargs: Any) -> None:
        if args:
            msg = msg % args
        self.aws_logger.error(f"[Uvicorn] {msg}")

    def debug(self, msg: str, *args: Any, **kwargs: Any) -> None:
        if args:
            msg = msg % args
        if hasattr(self.aws_logger, "debug"):
            self.aws_logger.debug(f"[Uvicorn] {msg}")
        else:
            # Only log debug messages in development
            self.aws_logger.info(f"[Uvicorn DEBUG] {msg}")

    def exception(self, msg: str, *args: Any, **kwargs: Any) -> None:
        if args:
            msg = msg % args
        self.aws_logger.error(f"[Uvicorn EXCEPTION] {msg}")

    def critical(self, msg: str, *args: Any, **kwargs: Any) -> None:
        if args:
            msg = msg % args
        self.aws_logger.error(f"[Uvicorn CRITICAL] {msg}")

    def log(self, level: int, msg: str, *args: Any, **kwargs: Any) -> None:
        """Handle generic log calls with different levels"""
        if args:
            msg = msg % args

        if level >= logging.ERROR:
            self.aws_logger.error(f"[Uvicorn] {msg}")
        elif level >= logging.WARNING:
            if hasattr(self.aws_logger, "warn"):
                self.aws_logger.warn(f"[Uvicorn] {msg}")
            else:
                self.aws_logger.info(f"[Uvicorn WARNING] {msg}")
        elif level >= logging.INFO:
            self.aws_logger.info(f"[Uvicorn] {msg}")
        else:  # DEBUG and below
            if hasattr(self.aws_logger, "debug"):
                self.aws_logger.debug(f"[Uvicorn] {msg}")
            else:
                self.aws_logger.info(f"[Uvicorn DEBUG] {msg}")


def configure_uvicorn_logging(aws_logger: AwsServerLogger) -> dict[str, Any]:
    """
    Configure uvicorn to use the custom logger adapter.
    Returns a log_config dict that can be passed to uvicorn.run()
    """
    # Create custom logger instances
    uvicorn_logger = UvicornLoggerAdapter(aws_logger, "uvicorn")
    uvicorn_access_logger = UvicornLoggerAdapter(aws_logger, "uvicorn.access")

    # Replace the default loggers
    logging.getLogger("uvicorn").handlers = []
    logging.getLogger("uvicorn.access").handlers = []
    logging.getLogger("uvicorn.error").handlers = []

    # Set the custom loggers
    logging.getLogger("uvicorn").addHandler(logging.NullHandler())
    logging.getLogger("uvicorn.access").addHandler(logging.NullHandler())
    logging.getLogger("uvicorn.error").addHandler(logging.NullHandler())

    # Monkey patch the loggers
    original_uvicorn_logger = logging.getLogger("uvicorn")
    original_access_logger = logging.getLogger("uvicorn.access")
    original_error_logger = logging.getLogger("uvicorn.error")

    # Replace methods
    for method_name in ["info", "warning", "error", "debug", "exception", "critical", "log"]:
        if hasattr(uvicorn_logger, method_name):
            setattr(original_uvicorn_logger, method_name, getattr(uvicorn_logger, method_name))
            setattr(original_access_logger, method_name, getattr(uvicorn_access_logger, method_name))
            setattr(original_error_logger, method_name, getattr(uvicorn_logger, method_name))

    # Return a minimal log config that disables uvicorn's default logging
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(message)s",
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.NullHandler",
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": "INFO",
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["default"],
                "level": "INFO",
                "propagate": False,
            },
        },
    }
