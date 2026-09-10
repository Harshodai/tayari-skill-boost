"""OpenTelemetry distributed tracing for FastAPI."""
import logging
import os

logger = logging.getLogger(__name__)


def init_tracing(app):
    """Initialize OpenTelemetry tracer provider and FastAPI instrumentation."""
    try:
        from opentelemetry import trace
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

        endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4318")
        if not endpoint.endswith("/v1/traces"):
            traces_endpoint = f"{endpoint.rstrip('/')}/v1/traces"
        else:
            traces_endpoint = endpoint

        resource = Resource.create({
            SERVICE_NAME: "tayari-python-ai",
            SERVICE_VERSION: "1.0.0",
        })
        provider = TracerProvider(resource=resource)
        exporter = OTLPSpanExporter(endpoint=traces_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))
        trace.set_tracer_provider(provider)

        FastAPIInstrumentor.instrument_app(app)
        logger.info("OpenTelemetry tracing initialized with endpoint: %s", traces_endpoint)
        return True
    except ImportError as e:
        logger.warning("OpenTelemetry packages not installed, tracing disabled: %s", e)
        return False
    except Exception as e:
        logger.warning("OpenTelemetry initialization failed, tracing disabled: %s", e)
        return False
