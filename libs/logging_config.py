"""Centralized logging configuration module for the Smart Stadium Platform.

Defines a structured JSON formatter for standard logging outputs to optimize
audit trailing and log analysis.
"""

import json
import logging
from typing import Any, Dict


class JsonFormatter(logging.Formatter):
    """Structured JSON log formatter for production logging systems."""

    def format(self, record: logging.LogRecord) -> str:
        """Serialize log records into formatted JSON strings."""
        log_data: Dict[str, Any] = {
            "timestamp": self.formatTime(record, self.datefmt),
            "service": "gateway",
            "level": record.levelname,
            "message": record.getMessage(),
        }
        if hasattr(record, "context"):
            log_data["context"] = record.context
        elif record.exc_info:
            log_data["context"] = {"exception": self.formatException(record.exc_info)}
        else:
            log_data["context"] = {}
        return json.dumps(log_data)


def configure_logging() -> logging.Logger:
    """Initialize and configure global structured logging settings."""
    logger = logging.getLogger("gateway")
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


logger = configure_logging()
