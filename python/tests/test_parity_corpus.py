"""Golden-vector parity corpus (ADR-089 pattern, as used by @smooai/audit).

Asserts the Python port satisfies the same contract every other port
(TypeScript / Rust / Go / .NET) is held to, from the same committed file. A
failure here means either this port drifted or the shared contract moved --
fix the port, not the corpus.
"""

import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from smooai_logger.logger import DEFAULT_REDACT_KEYS, REDACTED_VALUE, Level, Logger, reset_global_context

CORPUS_PATH = Path(__file__).resolve().parents[2] / "parity-corpus.json"
CORPUS: dict[str, Any] = json.loads(CORPUS_PATH.read_text())

LEVELS: list[dict[str, Any]] = CORPUS["levels"]["rows"]
FIELDS: dict[str, str] = CORPUS["fieldNames"]
RECORD: dict[str, Any] = CORPUS["record"]
REDACTION: dict[str, Any] = CORPUS["redaction"]


def _emit(level_name: str, message: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """Emit one record and return the parsed JSON payload."""
    reset_global_context()
    logger = Logger(name="ParityCorpus", level=Level.TRACE, pretty_print=False, log_to_file=False)
    args: list[Any] = [message] if context is None else [message, context]
    with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
        getattr(logger, level_name)(*args)
        output = mock_stdout.getvalue()
    lines = [line for line in output.strip().split("\n") if line]
    assert len(lines) == 1, f"expected exactly one record, got {len(lines)}"
    return json.loads(lines[0])


# Bump alongside the corpus's own `version` when its shape changes.
CORPUS_VERSION = 2


def test_corpus_is_the_shape_this_loader_understands() -> None:
    assert CORPUS["version"] == CORPUS_VERSION


def test_corpus_covers_all_six_levels() -> None:
    assert [entry["name"] for entry in LEVELS] == ["trace", "debug", "info", "warn", "error", "fatal"]


@pytest.mark.parametrize("entry", LEVELS, ids=[e["name"] for e in LEVELS])
def test_level_wire_shape_matches_corpus(entry: dict[str, Any]) -> None:
    record = _emit(entry["name"], RECORD["message"])

    # level -> pino-compatible NUMERIC code
    assert record[FIELDS["level"]] == entry["level"]
    assert isinstance(record[FIELDS["level"]], int) and not isinstance(record[FIELDS["level"]], bool)

    # LogLevel -> canonical lowercase STRING
    assert record[FIELDS["logLevel"]] == entry["LogLevel"]
    assert isinstance(record[FIELDS["logLevel"]], str)


@pytest.mark.parametrize("entry", LEVELS, ids=[e["name"] for e in LEVELS])
def test_required_fields_present_on_every_record(entry: dict[str, Any]) -> None:
    record = _emit(entry["name"], RECORD["message"])
    for field in RECORD["requiredFields"]:
        assert field in record, f"{field} must not be dropped"
        assert record[field] is not None


@pytest.mark.parametrize("case", CORPUS["messageShape"]["cases"], ids=[c["name"] for c in CORPUS["messageShape"]["cases"]])
def test_message_shape_matches_corpus(case: dict[str, Any]) -> None:
    record = _emit("info", case["message"], case["context"])
    assert record[FIELDS["message"]] == case["expectMsg"]

    if case.get("expectContext"):
        context = record[FIELDS["context"]]
        for key, value in case["expectContext"].items():
            assert context[key] == value
    else:
        # A bare string message must not leak into `context`.
        assert FIELDS["context"] not in record


def test_correlation_id_surfaces_and_mirrors() -> None:
    reset_global_context()
    logger = Logger(name="ParityCorpus", level=Level.TRACE, pretty_print=False, log_to_file=False)
    logger.correlation_id = CORPUS["correlationId"]["value"]
    with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
        logger.info(RECORD["message"])
        record = json.loads(mock_stdout.getvalue().strip())

    assert record[CORPUS["correlationId"]["field"]] == CORPUS["correlationId"]["value"]
    for mirrored in CORPUS["correlationId"]["alsoSets"]:
        assert record[mirrored] == CORPUS["correlationId"]["value"], f"{mirrored} must mirror correlationId"


def test_default_redact_keys_match_corpus_in_order() -> None:
    assert DEFAULT_REDACT_KEYS == REDACTION["defaultKeys"]


def test_redaction_placeholder_matches_corpus() -> None:
    assert REDACTED_VALUE == REDACTION["placeholder"]


@pytest.mark.parametrize("case", REDACTION["cases"], ids=[c["name"] for c in REDACTION["cases"]])
def test_redaction_matches_corpus(case: dict[str, Any]) -> None:
    record = _emit("info", RECORD["message"], case["context"])
    context = record[FIELDS["context"]]

    for key in case["redacted"]:
        assert context[key] == REDACTION["placeholder"], f"{key} must be redacted"
    for key, value in case["preserved"].items():
        assert context[key] == value, f"{key} must NOT be redacted"
