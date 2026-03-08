"""
Prometheus metrics for EDI platform
"""
import logging

logger = logging.getLogger(__name__)

# Try to import prometheus_client - optional dependency
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

if PROMETHEUS_AVAILABLE:
    documents_processed_total = Counter(
        "edi_documents_processed_total",
        "Total documents processed",
        ["direction", "status"],
    )
    document_processing_duration = Histogram(
        "edi_document_processing_seconds",
        "Document processing duration in seconds",
        ["direction"],
        buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0],
    )
    exceptions_total = Counter(
        "edi_exceptions_total",
        "Total exceptions created",
        ["severity"],
    )
    api_requests_total = Counter(
        "edi_api_requests_total",
        "Total API requests",
        ["method", "path", "status"],
    )
else:
    documents_processed_total = None
    document_processing_duration = None
    exceptions_total = None
    api_requests_total = None


def get_metrics():
    """Return Prometheus metrics in text format"""
    if PROMETHEUS_AVAILABLE:
        return generate_latest(), CONTENT_TYPE_LATEST
    return b"# Prometheus client not installed\n", "text/plain"
