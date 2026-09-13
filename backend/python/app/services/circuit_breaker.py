"""Simple in-memory circuit breaker for LLM API calls."""
import functools
import time
import logging
from typing import Callable, Any

logger = logging.getLogger(__name__)

STATE_CLOSED = "CLOSED"
STATE_OPEN = "OPEN"
STATE_HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """In-memory circuit breaker with decorator support."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        name: str = "default",
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.name = name
        self._state = STATE_CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0.0
        self._success_count = 0

    @property
    def state(self) -> str:
        return self._state

    def _can_attempt(self) -> bool:
        if self._state == STATE_CLOSED:
            return True
        if self._state == STATE_OPEN:
            if time.time() - self._last_failure_time >= self.recovery_timeout:
                self._state = STATE_HALF_OPEN
                self._failure_count = 0
                self._success_count = 0
                logger.info("Circuit breaker '%s' entering HALF_OPEN", self.name)
                return True
            return False
        # HALF_OPEN
        return True

    def record_success(self) -> None:
        if self._state == STATE_HALF_OPEN:
            self._success_count += 1
            if self._success_count >= 2:
                self._state = STATE_CLOSED
                self._failure_count = 0
                self._success_count = 0
                logger.info("Circuit breaker '%s' CLOSED", self.name)
        else:
            self._failure_count = 0

    def record_failure(self) -> None:
        self._failure_count += 1
        self._last_failure_time = time.time()
        if self._state == STATE_HALF_OPEN:
            self._state = STATE_OPEN
            logger.warning("Circuit breaker '%s' OPEN (half-open failure)", self.name)
        elif self._failure_count >= self.failure_threshold:
            self._state = STATE_OPEN
            logger.warning(
                "Circuit breaker '%s' OPEN after %s failures",
                self.name, self._failure_count,
            )

    def __call__(self, func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            if not self._can_attempt():
                raise CircuitBreakerOpen(
                    f"Circuit breaker '{self.name}' is OPEN. Retry after {self.recovery_timeout}s."
                )
            try:
                result = await func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as exc:
                self.record_failure()
                raise

        @functools.wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            if not self._can_attempt():
                raise CircuitBreakerOpen(
                    f"Circuit breaker '{self.name}' is OPEN. Retry after {self.recovery_timeout}s."
                )
            try:
                result = func(*args, **kwargs)
                self.record_success()
                return result
            except Exception as exc:
                self.record_failure()
                raise

        # Return async wrapper if the function is a coroutine, otherwise sync
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper


class CircuitBreakerOpen(Exception):
    """Raised when the circuit breaker is OPEN."""
    pass


# Default registry (in-memory)
_default_breakers: dict[str, CircuitBreaker] = {}


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    name: str = "default",
) -> Callable:
    """Decorator factory for circuit breaker protection.

    Usage:
        @circuit_breaker()
        async def my_llm_call(...): ...
    """
    if name not in _default_breakers:
        _default_breakers[name] = CircuitBreaker(
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
            name=name,
        )
    return _default_breakers[name]


# Need asyncio import at the end to avoid circular import issues with functools
import asyncio  # noqa: E402
