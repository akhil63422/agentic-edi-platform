"""
Inbound Processor (Oracle → SAP)
Per EDI gateway doc: X12 → Receive → Validate → Send 997 → Transform → Route → Post to SAP → Monitor
997 sent after Validate, before Transform.
"""
from app.workers.document_processor import processor

# Inbound uses the main processor with 997 after validate (default flow)
# The document_processor is refactored to support both; inbound = current behavior
inbound_processor = processor
