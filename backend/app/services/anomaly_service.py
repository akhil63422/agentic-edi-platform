"""
Anomaly Detection Service
Detects unusual transaction patterns using Isolation Forest (scikit-learn).
Scores EDI documents for anomalies across: volume, amount, timing, partner behavior.
Runs automatically during document processing and can be triggered on-demand.
"""
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import numpy as np
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger.warning("scikit-learn or numpy not installed — anomaly detection will use statistical fallback")


class AnomalyService:
    """
    Detects anomalies in EDI transaction patterns using Isolation Forest.

    Feature vector per document:
      [hour_of_day, day_of_week, amount_normalized, segment_count,
       partner_doc_frequency, validation_error_count, processing_time_seconds]
    """

    CONTAMINATION = 0.05    # Expected fraction of anomalies in training data
    MIN_SAMPLES = 20        # Minimum history records needed to fit model
    RETRAIN_INTERVAL = 3600 # Re-train model every hour (seconds)

    def __init__(self):
        self._model: Optional[Any] = None       # IsolationForest
        self._scaler: Optional[Any] = None      # StandardScaler
        self._last_trained: Optional[datetime] = None
        self._training_size: int = 0

    # ── Feature Extraction ────────────────────────────────────────────────────

    def _extract_features(
        self,
        doc: Dict[str, Any],
        partner_history: Optional[Dict[str, Any]] = None,
    ) -> List[float]:
        """Extract a numeric feature vector from an EDI document."""
        now = doc.get("received_at") or doc.get("created_at") or datetime.utcnow()
        if isinstance(now, str):
            try:
                now = datetime.fromisoformat(now.replace("Z", "+00:00"))
            except ValueError:
                now = datetime.utcnow()

        # Time features
        hour_of_day = now.hour / 23.0
        day_of_week = now.weekday() / 6.0

        # Amount feature (try to extract from canonical JSON or raw)
        amount = 0.0
        canonical = doc.get("canonical_json", {}) or {}
        fields = canonical.get("fields", {}) if isinstance(canonical, dict) else {}
        for key in ("total_amount", "totalAmount", "total_due", "totalDue", "amount"):
            raw_val = fields.get(key, 0)
            try:
                amount = float(str(raw_val).replace(",", "").replace("$", ""))
                break
            except (ValueError, TypeError):
                continue

        # Segment count
        segments = doc.get("parsed_segments", []) or []
        segment_count = min(len(segments) / 50.0, 1.0)

        # Validation error count
        validation = doc.get("validation_results", []) or []
        error_count = min(
            len([v for v in validation if v.get("type") == "error" or v.get("severity") in ("High", "Critical")]) / 5.0,
            1.0,
        )

        # Partner transaction frequency (normalized 0–1, higher = more frequent)
        partner_freq = 0.5
        if partner_history:
            total = partner_history.get("total_documents", 0) or 0
            partner_freq = min(total / 1000.0, 1.0)

        # AI confidence score
        confidence = float(doc.get("ai_confidence_score", 0.75) or 0.75)

        return [hour_of_day, day_of_week, amount, segment_count, partner_freq, error_count, confidence]

    # ── Model Training ────────────────────────────────────────────────────────

    def _should_retrain(self) -> bool:
        if self._model is None:
            return True
        if self._last_trained is None:
            return True
        elapsed = (datetime.utcnow() - self._last_trained).total_seconds()
        return elapsed > self.RETRAIN_INTERVAL

    def _fit(self, feature_matrix: List[List[float]]) -> None:
        """Fit Isolation Forest on historical feature matrix."""
        if not SKLEARN_AVAILABLE:
            return
        if len(feature_matrix) < self.MIN_SAMPLES:
            logger.debug(f"Not enough samples to train anomaly model ({len(feature_matrix)} < {self.MIN_SAMPLES})")
            return
        try:
            X = np.array(feature_matrix, dtype=float)
            # Replace NaN/Inf
            X = np.nan_to_num(X, nan=0.5, posinf=1.0, neginf=0.0)

            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            model = IsolationForest(
                n_estimators=100,
                contamination=self.CONTAMINATION,
                random_state=42,
                n_jobs=-1,
            )
            model.fit(X_scaled)

            self._model = model
            self._scaler = scaler
            self._last_trained = datetime.utcnow()
            self._training_size = len(X)
            logger.info(f"Anomaly model trained on {len(X)} samples")
        except Exception as e:
            logger.error(f"Error training anomaly model: {e}")

    # ── Scoring ───────────────────────────────────────────────────────────────

    def _score_isolation_forest(self, features: List[float]) -> Tuple[float, bool]:
        """Return (anomaly_score 0–1, is_anomaly)."""
        if not SKLEARN_AVAILABLE or self._model is None or self._scaler is None:
            return 0.0, False
        try:
            x = np.array([features], dtype=float)
            x = np.nan_to_num(x)
            x_scaled = self._scaler.transform(x)
            # decision_function: negative = more anomalous; range approx [-0.5, 0.5]
            score_raw = self._model.decision_function(x_scaled)[0]
            # Normalize to [0, 1] where 1 = most anomalous
            anomaly_score = max(0.0, min(1.0, 0.5 - score_raw))
            is_anomaly = self._model.predict(x_scaled)[0] == -1
            return round(anomaly_score, 4), is_anomaly
        except Exception as e:
            logger.warning(f"Isolation Forest scoring failed: {e}")
            return 0.0, False

    def _score_statistical(self, features: List[float]) -> Tuple[float, bool]:
        """Simple z-score-based anomaly detection as fallback."""
        amount = features[2]
        error_count = features[5]
        confidence = features[6]

        # Very high amounts, many errors, or very low confidence are anomalous
        score = 0.0
        if amount > 0.9:
            score += 0.3
        if error_count > 0.4:
            score += 0.4
        if confidence < 0.5:
            score += 0.3

        return round(min(score, 1.0), 4), score > 0.5

    # ── Public API ────────────────────────────────────────────────────────────

    async def score_document(
        self,
        document: Dict[str, Any],
        historical_docs: Optional[List[Dict[str, Any]]] = None,
        partner_history: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Score an EDI document for anomalies.

        Args:
            document: The current EDI document dict.
            historical_docs: Recent documents from the same partner (used for training).
            partner_history: Partner statistics (total_documents, etc.).

        Returns:
            Dict with anomaly_score, is_anomaly, anomaly_type, details.
        """
        features = self._extract_features(document, partner_history)

        # Optionally retrain on historical data
        if historical_docs and self._should_retrain():
            history_features = [
                self._extract_features(d, partner_history)
                for d in historical_docs
                if d.get("_id") != document.get("_id")
            ]
            if len(history_features) >= self.MIN_SAMPLES:
                self._fit(history_features)

        if SKLEARN_AVAILABLE and self._model is not None:
            anomaly_score, is_anomaly = self._score_isolation_forest(features)
            method = "isolation_forest"
        else:
            anomaly_score, is_anomaly = self._score_statistical(features)
            method = "statistical"

        # Classify anomaly type
        anomaly_types = []
        if features[2] > 0.8:
            anomaly_types.append("unusual_amount")
        if features[5] > 0.4:
            anomaly_types.append("high_error_rate")
        if features[6] < 0.5:
            anomaly_types.append("low_confidence")
        if features[0] < 0.08 or features[0] > 0.92:
            anomaly_types.append("off_hours_transaction")
        if features[4] < 0.05:
            anomaly_types.append("new_partner_activity")

        severity = "Low"
        if anomaly_score > 0.75:
            severity = "High"
        elif anomaly_score > 0.5:
            severity = "Medium"

        return {
            "anomaly_score": anomaly_score,
            "is_anomaly": is_anomaly,
            "severity": severity,
            "anomaly_types": anomaly_types,
            "method": method,
            "model_trained_on": self._training_size,
            "features": {
                "hour_of_day": round(features[0] * 23),
                "day_of_week": round(features[1] * 6),
                "amount_normalized": features[2],
                "segment_count_normalized": features[3],
                "partner_frequency": features[4],
                "error_count_normalized": features[5],
                "ai_confidence": features[6],
            },
        }

    async def score_batch(
        self,
        documents: List[Dict[str, Any]],
        partner_history: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Score a batch of documents. Trains model on the batch itself."""
        if not documents:
            return []

        feature_matrix = [self._extract_features(d, partner_history) for d in documents]

        if self._should_retrain() and len(feature_matrix) >= self.MIN_SAMPLES:
            self._fit(feature_matrix)

        results = []
        for i, doc in enumerate(documents):
            result = await self.score_document(doc, None, partner_history)
            result["document_id"] = str(doc.get("_id", i))
            results.append(result)

        return results

    def get_model_status(self) -> Dict[str, Any]:
        """Return current model training status."""
        return {
            "sklearn_available": SKLEARN_AVAILABLE,
            "model_trained": self._model is not None,
            "training_size": self._training_size,
            "last_trained": self._last_trained.isoformat() if self._last_trained else None,
            "contamination": self.CONTAMINATION,
            "min_samples_required": self.MIN_SAMPLES,
        }


anomaly_service = AnomalyService()
