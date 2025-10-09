import json
from typing import Any, override
from uuid import UUID

from pendulum import DateTime
from pydantic import BaseModel


class JsonEncoder(json.JSONEncoder):
    @override
    def default(self, o: Any) -> Any:
        if isinstance(o, UUID):
            # if the obj is uuid, we simply return the value of uuid
            return str(o)

        # Handle Pydantic BaseModel instances
        if isinstance(o, BaseModel):
            # Try Pydantic v2 method first
            if hasattr(o, "model_dump"):
                return o.model_dump()

        if isinstance(o, DateTime):
            return o.to_iso8601_string()

        try:
            return json.JSONEncoder.default(self, o)
        except Exception:
            return str(o)


def dumps(obj: Any, **kwargs: Any) -> str:
    """
    Serialize obj to a JSON formatted string.

    This function is compatible with the standard library json.dumps
    but uses our custom JsonEncoder for handling UUID, BaseModel, and DateTime objects.

    Args:
        obj: The object to serialize
        **kwargs: Additional arguments passed to json.dumps

    Returns:
        A JSON formatted string
    """
    # Use our custom encoder by default, but allow override
    if "cls" not in kwargs:
        kwargs["cls"] = JsonEncoder

    return json.dumps(obj, **kwargs)


def loads(s: str | bytes, **kwargs: Any) -> Any:
    """
    Deserialize s (a str or bytes instance containing a JSON document) to a Python object.

    This function is compatible with the standard library json.loads.

    Args:
        s: A string or bytes instance containing a JSON document
        **kwargs: Additional arguments passed to json.loads

    Returns:
        The deserialized Python object
    """
    return json.loads(s, **kwargs)
