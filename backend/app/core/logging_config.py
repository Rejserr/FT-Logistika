"""Structured JSON logging configuration with file rotation."""

import json
import logging
import logging.handlers
import os
from datetime import datetime, timezone
from pathlib import Path
from contextvars import ContextVar

# Context variable for correlation ID (set per request)
correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)


class JsonFormatter(logging.Formatter):
    """Formats log records as JSON for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Correlation ID from context
        cid = correlation_id_var.get(None)
        if cid:
            log_entry["correlation_id"] = cid

        # Extra fields added by middleware or explicit logging
        for key in ("user_id", "role", "warehouse_id", "action", "duration_ms", "ip_address"):
            val = getattr(record, key, None)
            if val is not None:
                log_entry[key] = val

        # Exception info
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }

        return json.dumps(log_entry, ensure_ascii=False, default=str)


def setup_logging() -> None:
    """Configure structured JSON logging with daily file rotation."""
    log_dir = Path(__file__).resolve().parent.parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)

    # JSON file handler — daily rotation, 30 days retention
    json_handler = logging.handlers.TimedRotatingFileHandler(
        filename=str(log_dir / "app.json"),
        when="midnight",
        interval=1,
        backupCount=30,
        encoding="utf-8",
    )
    json_handler.setLevel(logging.INFO)
    json_handler.setFormatter(JsonFormatter())

    # Console handler — human-readable
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s")
    )

    root = logging.getLogger()
    root.setLevel(logging.INFO)

    # Remove existing handlers to avoid duplicates on reload
    root.handlers.clear()
    root.addHandler(json_handler)
    root.addHandler(console_handler)
