"""Golden-vector parity corpus (ADR-089 pattern, as used by @smooai/audit).

Asserts the Python port emits the level wire-shape every other port
(TypeScript / Go / Rust / .NET) is also held to. A failure here means either
this port drifted or the shared contract moved -- fix the port, not the corpus.
"""

import io
import json
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from smooai_logger.logger import Level, Logger

CORPUS_PATH = Path(__file__).resolve().parents[2] / "parity-corpus.json"
CORPUS: dict[str, Any] = json.loads(CORPUS_PATH.read_text())
LEVELS: list[dict[str, Any]] = CORPUS["levels"]


def _emit(level_name: str) -> dict[str, Any]:
    """Emit one record at `level_name` and return the parsed JSON payload."""
    logger = Logger(name="ParityCorpus", level=Level.TRACE, pretty_print=False, log_to_file=False)
    with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
        getattr(logger, level_name)("parity corpus probe")
        output = mock_stdout.getvalue()
    lines = [line for line in output.strip().split("\n") if line]
    assert len(lines) == 1, f"expected exactly one record, got {len(lines)}"
    return json.loads(lines[0])


def test_corpus_covers_all_six_levels() -> None:
    assert len(LEVELS) == 6
    assert [entry["name"] for entry in LEVELS] == ["trace", "debug", "info", "warn", "error", "fatal"]


@pytest.mark.parametrize("entry", LEVELS, ids=[e["name"] for e in LEVELS])
def test_level_wire_shape_matches_corpus(entry: dict[str, Any]) -> None:
    record = _emit(entry["name"])

    # level -> pino-compatible NUMERIC code
    assert record["level"] == entry["level"]
    assert isinstance(record["level"], int) and not isinstance(record["level"], bool)

    # LogLevel -> canonical lowercase STRING
    assert record["LogLevel"] == entry["LogLevel"]
    assert isinstance(record["LogLevel"], str)


def test_both_fields_present_on_every_record() -> None:
    record = _emit("info")
    assert "level" in record, "numeric `level` must not be dropped"
    assert "LogLevel" in record, "canonical `LogLevel` string must not be dropped"
