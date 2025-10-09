# smooai-logger

Python port of the SmooAI contextual logger with AWS and HTTP awareness.

## Usage

```python
from smooai_logger import AwsServerLogger

logger = AwsServerLogger()
logger.info({"event": "hello"}, "app:start")
```

## Development

```bash
uv run poe install-dev
uv run pytest
uv run poe lint
uv run poe lint:fix   # optional fixer
uv run poe format
uv run poe typecheck
uv run poe build
```

Set `UV_PUBLISH_TOKEN` before running `uv run poe publish` to upload to PyPI.
