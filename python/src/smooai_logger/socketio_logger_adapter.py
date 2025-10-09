from typing import Any

from .aws_logger import AwsServerLogger


class SocketIOLoggerAdapter:
    """
    Adapts a custom logger to the interface expected by python-socketio.
    All logs are sent at info level, or mapped accordingly.
    """

    def __init__(self, logger: AwsServerLogger) -> None:
        self.logger: AwsServerLogger = logger

    def info(self, msg: str, *args: Any, **kwargs: Any) -> None:
        self.logger.info(msg, *args, **kwargs)

    def warning(self, msg: str, *args: Any, **kwargs: Any) -> None:
        # Map to warn if available, else info
        if hasattr(self.logger, "warn"):
            self.logger.warn(msg, *args, **kwargs)
        else:
            self.logger.info(msg, *args, **kwargs)

    def error(self, msg: str, *args: Any, **kwargs: Any) -> None:
        self.logger.error(msg, *args, **kwargs)

    def debug(self, msg: str, *args: Any, **kwargs: Any) -> None:
        # Optionally map debug to info, or implement debug in your logger
        if hasattr(self.logger, "debug"):
            self.logger.debug(msg, *args, **kwargs)
        else:
            self.logger.info(msg, *args, **kwargs)

    def exception(self, msg: str, *args: Any, **kwargs: Any) -> None:
        # Map to error
        self.logger.error(msg, *args, **kwargs)

    def critical(self, msg: str, *args: Any, **kwargs: Any) -> None:
        # Map to error
        self.logger.error(msg, *args, **kwargs)
