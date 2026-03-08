"""
Semantic Search Service
Provides intelligent search over EDI documents, partners, and audit logs using:
  - OpenAI text-embedding-3-small for vector embeddings
  - Qdrant (optional) as a vector store
  - MongoDB text search + cosine similarity as fallback

Supports natural language queries like:
  "850s from Acme Corp last month", "failed invoices over $50k", "shipments with tracking errors"
"""
import os
import json
import logging
import math
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import (
        Distance, VectorParams, PointStruct, Filter,
        FieldCondition, MatchValue, SearchRequest,
    )
    QDRANT_AVAILABLE = True
except ImportError:
    QDRANT_AVAILABLE = False
    logger.info("Qdrant not installed — using MongoDB-only semantic search")


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x ** 2 for x in a))
    norm_b = math.sqrt(sum(x ** 2 for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class SearchService:
    """
    Semantic search over EDI documents and partners.

    Embedding strategy:
      Each document is embedded as a concatenation of its key searchable fields:
        "{document_type} {partner_code} {direction} {status} {fields_summary}"
    """

    COLLECTION_DOCUMENTS = "edi_documents"
    COLLECTION_PARTNERS = "edi_partners"
    EMBEDDING_DIM = 1536  # text-embedding-3-small output dimension

    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self.qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        self.qdrant_api_key = os.getenv("QDRANT_API_KEY")
        self._qdrant: Optional[Any] = None
        self._qdrant_initialized = False

    # ── Qdrant Setup ──────────────────────────────────────────────────────────

    def _get_qdrant(self) -> Optional[Any]:
        """Lazy-initialize Qdrant client."""
        if not QDRANT_AVAILABLE:
            return None
        if self._qdrant_initialized:
            return self._qdrant
        try:
            kwargs = {"url": self.qdrant_url}
            if self.qdrant_api_key:
                kwargs["api_key"] = self.qdrant_api_key
            self._qdrant = QdrantClient(**kwargs)
            # Ensure collections exist
            for coll in (self.COLLECTION_DOCUMENTS, self.COLLECTION_PARTNERS):
                existing = [c.name for c in self._qdrant.get_collections().collections]
                if coll not in existing:
                    self._qdrant.create_collection(
                        collection_name=coll,
                        vectors_config=VectorParams(size=self.EMBEDDING_DIM, distance=Distance.COSINE),
                    )
            self._qdrant_initialized = True
            logger.info(f"Qdrant connected at {self.qdrant_url}")
        except Exception as e:
            logger.warning(f"Qdrant unavailable ({e}) — will use MongoDB fallback for search")
            self._qdrant = None
            self._qdrant_initialized = True
        return self._qdrant

    # ── Embedding ─────────────────────────────────────────────────────────────

    async def _embed(self, texts: List[str]) -> Optional[List[List[float]]]:
        """Embed a list of texts using OpenAI text-embedding-3-small."""
        if not self.api_key or not texts:
            return None
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.api_key)
            # Truncate each text to avoid token limits
            truncated = [t[:2000] for t in texts]
            resp = await client.embeddings.create(
                model="text-embedding-3-small",
                input=truncated,
            )
            return [item.embedding for item in resp.data]
        except Exception as e:
            logger.warning(f"Embedding failed: {e}")
            return None

    def _doc_to_text(self, doc: Dict[str, Any]) -> str:
        """Convert an EDI document to searchable text."""
        parts = [
            doc.get("document_type", ""),
            doc.get("partner_code", ""),
            doc.get("direction", ""),
            doc.get("status", ""),
            doc.get("file_name", ""),
        ]
        # Add canonical fields summary
        canonical = doc.get("canonical_json") or {}
        if isinstance(canonical, dict):
            fields = canonical.get("fields", {}) or {}
            for k, v in list(fields.items())[:10]:
                if v:
                    parts.append(f"{k}:{v}")
        # Add validation errors
        for vr in (doc.get("validation_results") or [])[:3]:
            msg = vr.get("message") or vr.get("rule", "")
            if msg:
                parts.append(msg)
        received = doc.get("received_at")
        if received:
            parts.append(str(received)[:10])
        return " ".join(str(p) for p in parts if p)

    def _partner_to_text(self, partner: Dict[str, Any]) -> str:
        """Convert a trading partner to searchable text."""
        return " ".join(filter(None, [
            partner.get("business_name", ""),
            partner.get("partner_code", ""),
            partner.get("role", ""),
            partner.get("industry", ""),
            partner.get("country", ""),
            (partner.get("edi_config") or {}).get("standard", ""),
        ]))

    # ── Index ─────────────────────────────────────────────────────────────────

    async def index_document(self, doc: Dict[str, Any]) -> bool:
        """Embed and upsert a document into Qdrant."""
        qdrant = self._get_qdrant()
        if not qdrant or not self.api_key:
            return False
        try:
            text = self._doc_to_text(doc)
            embeddings = await self._embed([text])
            if not embeddings:
                return False
            doc_id = str(doc.get("_id", ""))
            # Use a hash of the doc_id as integer point ID (Qdrant requires integer IDs)
            point_id = abs(hash(doc_id)) % (2 ** 63)
            qdrant.upsert(
                collection_name=self.COLLECTION_DOCUMENTS,
                points=[PointStruct(
                    id=point_id,
                    vector=embeddings[0],
                    payload={
                        "document_id": doc_id,
                        "document_type": doc.get("document_type", ""),
                        "partner_code": doc.get("partner_code", ""),
                        "direction": doc.get("direction", ""),
                        "status": doc.get("status", ""),
                        "received_at": str(doc.get("received_at", "")),
                    },
                )],
            )
            return True
        except Exception as e:
            logger.warning(f"Failed to index document: {e}")
            return False

    # ── Search ────────────────────────────────────────────────────────────────

    async def search(
        self,
        query: str,
        collection: str = "documents",
        limit: int = 20,
        filters: Optional[Dict[str, Any]] = None,
        db=None,
    ) -> Dict[str, Any]:
        """
        Semantic search over EDI documents or partners.

        Args:
            query: Natural language query string.
            collection: "documents" or "partners".
            limit: Max results to return.
            filters: Optional key-value filters (partner_code, direction, status).
            db: Motor database (for MongoDB fallback).

        Returns:
            Dict with results, total, method, and query_understanding.
        """
        # Understand query intent via LLM
        query_meta = await self._understand_query(query)

        # Merge LLM-inferred filters with explicit filters
        merged_filters = {**(query_meta.get("filters") or {}), **(filters or {})}

        # Try Qdrant vector search first
        qdrant = self._get_qdrant()
        if qdrant and self.api_key:
            try:
                result = await self._qdrant_search(query, collection, limit, merged_filters, query_meta)
                if result.get("results"):
                    return result
            except Exception as e:
                logger.warning(f"Qdrant search failed: {e}, falling back to MongoDB")

        # MongoDB fallback
        if db is not None:
            return await self._mongo_search(query, collection, limit, merged_filters, query_meta, db)

        return {"results": [], "total": 0, "method": "none", "query_understanding": query_meta}

    async def _understand_query(self, query: str) -> Dict[str, Any]:
        """Use GPT-4o-mini to parse query intent and extract filters."""
        if not self.api_key:
            return {"intent": "search", "filters": {}, "keywords": query.split()}
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.api_key)
            resp = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Parse an EDI search query and return JSON with:\n"
                            "- intent: (search|filter|aggregate|explain)\n"
                            "- filters: {document_type, partner_code, direction, status, date_from, date_to, "
                            "  min_amount, max_amount} (only include if mentioned)\n"
                            "- keywords: [list of key terms]\n"
                            "- time_range: (today|week|month|quarter|year|null)\n"
                            "Respond ONLY with JSON."
                        ),
                    },
                    {"role": "user", "content": f"Parse this EDI search query: {query}"},
                ],
                response_format={"type": "json_object"},
                max_tokens=300,
                temperature=0.1,
            )
            return json.loads(resp.choices[0].message.content.strip())
        except Exception as e:
            logger.warning(f"Query understanding failed: {e}")
            return {"intent": "search", "filters": {}, "keywords": query.split()}

    async def _qdrant_search(
        self,
        query: str,
        collection: str,
        limit: int,
        filters: Dict[str, Any],
        query_meta: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Search using Qdrant vector similarity."""
        qdrant = self._get_qdrant()
        embeddings = await self._embed([query])
        if not embeddings:
            return {"results": [], "total": 0, "method": "qdrant_no_embedding"}

        coll_name = self.COLLECTION_DOCUMENTS if collection == "documents" else self.COLLECTION_PARTNERS

        # Build Qdrant filter
        qdrant_filters = None
        conditions = []
        for key in ("document_type", "partner_code", "direction", "status"):
            if filters.get(key):
                conditions.append(FieldCondition(key=key, match=MatchValue(value=filters[key])))
        if conditions:
            from qdrant_client.models import Filter as QFilter, Must
            qdrant_filters = QFilter(must=conditions)

        results = qdrant.search(
            collection_name=coll_name,
            query_vector=embeddings[0],
            limit=limit,
            query_filter=qdrant_filters,
            with_payload=True,
            score_threshold=0.3,
        )

        return {
            "results": [{"score": r.score, **r.payload} for r in results],
            "total": len(results),
            "method": "qdrant_vector",
            "query_understanding": query_meta,
        }

    async def _mongo_search(
        self,
        query: str,
        collection: str,
        limit: int,
        filters: Dict[str, Any],
        query_meta: Dict[str, Any],
        db,
    ) -> Dict[str, Any]:
        """MongoDB-based search with embedding similarity re-ranking."""
        coll = db.documents if collection == "documents" else db.trading_partners

        # Build MongoDB query from extracted filters
        mongo_query: Dict[str, Any] = {}
        if filters.get("document_type"):
            dt = str(filters["document_type"]).replace("X12 ", "").replace("EDIFACT ", "")
            mongo_query["document_type"] = {"$regex": dt, "$options": "i"}
        if filters.get("partner_code"):
            mongo_query["partner_code"] = {"$regex": filters["partner_code"], "$options": "i"}
        if filters.get("direction"):
            mongo_query["direction"] = filters["direction"]
        if filters.get("status"):
            mongo_query["status"] = filters["status"]

        # Time range filter
        time_range = query_meta.get("time_range")
        if time_range:
            now = datetime.utcnow()
            delta_map = {
                "today": timedelta(days=1),
                "week": timedelta(weeks=1),
                "month": timedelta(days=30),
                "quarter": timedelta(days=90),
                "year": timedelta(days=365),
            }
            if time_range in delta_map:
                mongo_query["received_at"] = {"$gte": now - delta_map[time_range]}

        # Keyword fallback: text search in file_name and document_type
        keywords = query_meta.get("keywords", [])
        if keywords and not mongo_query:
            keyword_regex = "|".join(keywords[:5])
            mongo_query["$or"] = [
                {"document_type": {"$regex": keyword_regex, "$options": "i"}},
                {"partner_code": {"$regex": keyword_regex, "$options": "i"}},
                {"file_name": {"$regex": keyword_regex, "$options": "i"}},
                {"status": {"$regex": keyword_regex, "$options": "i"}},
            ]

        docs = await coll.find(mongo_query).sort("received_at", -1).limit(limit * 3).to_list(length=limit * 3)

        # Re-rank with embeddings if available
        if docs and self.api_key:
            try:
                texts = [self._doc_to_text(d) if collection == "documents" else self._partner_to_text(d) for d in docs]
                all_texts = [query] + texts
                embeddings = await self._embed(all_texts)
                if embeddings:
                    q_emb = embeddings[0]
                    scored = sorted(
                        zip(docs, embeddings[1:]),
                        key=lambda x: _cosine_similarity(q_emb, x[1]),
                        reverse=True,
                    )
                    docs = [d for d, _ in scored[:limit]]
                    for d, emb in scored[:limit]:
                        d["_search_score"] = round(_cosine_similarity(q_emb, emb), 4)
            except Exception as e:
                logger.warning(f"Embedding re-rank failed: {e}")
        else:
            docs = docs[:limit]

        # Serialize ObjectIds
        for d in docs:
            d["_id"] = str(d.get("_id", ""))

        return {
            "results": docs,
            "total": len(docs),
            "method": "mongo_embedding_rerank" if self.api_key else "mongo_keyword",
            "query_understanding": query_meta,
        }


search_service = SearchService()
