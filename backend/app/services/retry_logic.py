"""
Retry Logic Service
Configurable retries with exponential backoff for ERP, transport, and document processing
"""
import asyncio
import logging
from typing import Callable, TypeVar, Any
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Default config
DEFAULT_ATTEMPTS = 3
DEFAULT_BACKOFF_BASE = 2.0  # seconds
DEFAULT_MAX_DELAY = 60.0  # seconds


def retry_async(
    max_attempts: int = DEFAULT_ATTEMPTS,
    backoff_base: float = DEFAULT_BACKOFF_BASE,
    max_delay: float = DEFAULT_MAX_DELAY,
    exceptions: tuple = (Exception,),
):
    """Decorator for async functions with retry and exponential backoff"""

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt == max_attempts:
                        logger.error(
                            f"Retry exhausted for {func.__name__} after {max_attempts} attempts: {e}"
                        )
                        raise
                    delay = min(
                        backoff_base ** attempt,
                        max_delay
                    )
                    logger.warning(
                        f"Retry {attempt}/{max_attempts} for {func.__name__} after {e}, "
                        f"retrying in {delay:.1f}s"
                    )
                    await asyncio.sleep(delay)
            raise last_exc

        return wrapper

    return decorator


def retry_sync(
    max_attempts: int = DEFAULT_ATTEMPTS,
    backoff_base: float = DEFAULT_BACKOFF_BASE,
    max_delay: float = DEFAULT_MAX_DELAY,
    exceptions: tuple = (Exception,),
):
    """Decorator for sync functions with retry and exponential backoff"""
    import time

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            last_exc = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exc = e
                    if attempt == max_attempts:
                        logger.error(
                            f"Retry exhausted for {func.__name__} after {max_attempts} attempts: {e}"
                        )
                        raise
                    delay = min(backoff_base ** attempt, max_delay)
                    logger.warning(
                        f"Retry {attempt}/{max_attempts} for {func.__name__} after {e}, "
                        f"retrying in {delay:.1f}s"
                    )
                    time.sleep(delay)
            raise last_exc

        return wrapper

    return decorator
