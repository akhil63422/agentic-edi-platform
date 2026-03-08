"""
Outbound Processor (SAP → Oracle)
Per EDI gateway doc: IDoc → Receive → Validate → Transform → Route → Send 997 → Deliver → Monitor
997 sent after Transform/Route, before Deliver.
"""
from app.workers.document_processor import processor

# Outbound uses same processor with flow_type=outbound to defer 997 until after transform
outbound_processor = processor
