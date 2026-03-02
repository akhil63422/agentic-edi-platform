# Voice AI Training & Improvement Guide

This document describes how to improve the Partner Setup voice AI for better accuracy across all fields.

---

## Current Implementation

### Frontend (AddTradingPartnerChat.jsx)
- **Backend Whisper** (primary): Sends audio to `/partners/ai/voice`, gets transcription + extracted data
- **Browser SpeechRecognition** (fallback): When backend fails, uses Chrome's Web Speech API
- **Voice-to-option matching**: `matchVoiceToOptions()` maps spoken text to multi-select options (e.g. "customer" → "Customer", "america new york" → "America/New_York")
- **Partner code normalization**: `normalizePartnerCode()` handles "one two three" → "123", "12 34 56" → "123456"

### Backend (partner_ai_service.py)
- **Whisper** (openai/whisper-medium by default): Better accuracy than small (~5GB VRAM). Set `WHISPER_MODEL=openai/whisper-large-v3` for best (needs ~10GB VRAM).
- **OpenAI Whisper API** (optional): Set `OPENAI_API_KEY` for cloud transcription - highest accuracy, no GPU needed. Tried first before local Whisper.
- **Language**: Uses `language="en"` for English-only transcription (improves accuracy).

---

## Supported Voice Inputs by Field

| Field | Example Voice Inputs | Notes |
|-------|---------------------|-------|
| businessName | "Prestige Technologies", "Walmart" | Free text |
| partnerCode | "1234567890", "one two three four five" | Normalized to alphanumeric |
| role | "Customer", "Supplier", "Both" | Matched to options |
| industry | "Retail", "Manufacturing", "Healthcare" | Matched to options |
| country | "United States", "India" | Free text |
| timezone | "America New York", "UTC" | Matched to options |
| ediStandard | "X12", "EDIFACT" | Matched to options |
| version | "5010", "4010" | Matched to options |
| transportType | "SFTP", "S3", "FTP", "AS2" | Matched to options |
| documents | "850 and 810", "850, 856" | Multi-select matching |
| Contact fields | Names, emails, phone numbers | Free text; email/phone normalized |
| businessContactEmail | "akhil6390 at gmail.com", "user a gmail dot com" | `a`/`at` → `@`, `dot` → `.` |
| businessContactPhone | "one two three four five six seven eight" | Spoken digits → numbers |

---

## Training / Fine-Tuning Options

### 1. Whisper Fine-Tuning (Advanced)
For domain-specific terms (EDI, partner codes, X12):

```bash
# Use Hugging Face datasets with EDI/partner vocabulary
# Add custom vocabulary: X12, EDIFACT, 850, 810, 856, SFTP, AS2, ISA, etc.
```

**Dataset ideas:**
- Record 50–100 samples of EDI terms spoken
- Include accents and variations ("ex twelve", "s f t p", "eight fifty")
- Use Wav2Vec2 or Whisper fine-tuning scripts

### 2. Add Custom Name/Email Corrections
For persistent misrecognitions (e.g. "aunty" → "akhil"), add to backend:

```python
VOICE_CORRECTIONS = {"aunty": "akhil", "aunty": "aali"}  # word: replacement
# Apply before email normalization
```

### 3. Add Custom Vocabulary (Simpler)
Extend `_normalize_voice_option()` and `matchVoiceToOptions()` with synonyms:

```python
# Backend: partner_ai_service.py
VOICE_SYNONYMS = {
    "customer": "Customer", "client": "Customer", "buyer": "Customer",
    "supplier": "Supplier", "vendor": "Supplier", "seller": "Supplier",
    "ex twelve": "X12", "x 12": "X12", "x12": "X12",
    "s f t p": "SFTP", "sftp": "SFTP", "secure ftp": "SFTP",
    "eight fifty": "850", "850": "850 (Purchase Order)",
    "new york": "America/New_York", "eastern": "America/New_York",
}
```

### 3. Improve Option Matching
- Add fuzzy matching (e.g. Levenshtein distance) for near-misses
- Handle numbers spoken as words: "five zero one zero" → "5010"
- Handle compound phrases: "purchase order" → "850 (Purchase Order)"

### 4. Post-Processing Pipeline
1. **Transcription** (Whisper) → raw text
2. **Normalization** (lowercase, remove filler words "um", "uh")
3. **Field-specific parsing** (partner code digits, option matching)
4. **Validation** (max length, allowed characters)

---

## Adding New Question Types

1. **Frontend**: Add to `CONVERSATION_FLOW` with `type: 'text'` or `type: 'multi-select'`
2. **Frontend**: Add to `matchVoiceToOptions()` if multi-select
3. **Backend**: Add to `_extract_info_rule_based()` in `_normalize_voice_option()` call
4. **Backend**: Add response template to `responses` dict in `_extract_info_rule_based()`

---

## Testing Voice Input

```bash
# Test backend voice endpoint directly
curl -X POST -F "audio_file=@test.wav" http://localhost:8001/api/v1/partners/ai/voice
```

Use sample WAV files with:
- "Customer" (role)
- "1234567890" (partner code)
- "Retail" (industry)
- "America New York" (timezone)
- "850 and 810" (documents)
