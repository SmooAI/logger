from pydantic_extra_types.pendulum_dt import Date, DateTime, Duration

# Example: Re-export everything from another package
# from some_other_package import *
# __all__ = some_other_package.__all__

DEFAULT_TIMEZONE = "America/Indiana/Indianapolis"


def now() -> DateTime:
    return DateTime.now(DEFAULT_TIMEZONE)


__all__ = ["DEFAULT_TIMEZONE", "now", "DateTime", "Date", "Duration"]
