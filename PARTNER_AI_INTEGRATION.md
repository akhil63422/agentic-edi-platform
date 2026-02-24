# Partner Setup AI Integration with Hugging Face

## Overview

Integrated Hugging Face models into the Partner Setup chatbot to process chat messages, voice inputs, and document uploads, extracting structured partner information and storing it in the database.

## Models Selected

### 1. Conversational AI: `Qwen/Qwen2.5-7B-Instruct`
- **Purpose**: Process chat messages and extract partner information
- **Alternative**: `meta-llama/Meta-Llama-3-8B-Instruct`
- **Why**: Good balance of performance and speed, supports conversational context

### 2. Speech-to-Text: `openai/whisper-base`
- **Purpose**: Convert voice input to text
- **Why**: High accuracy, supports multiple languages, good for real-time transcription

### 3. Document Understanding: `microsoft/layoutlmv3-base`
- **Purpose**: Extract structured information from documents (PDF, DOCX, XLSX)
- **Why**: Specialized for document understanding and information extraction

## Implementation

### Backend

1. **Service**: `backend/app/services/partner_ai_service.py`
   - Handles model loading (lazy loading for performance)
   - Processes chat, voice, and documents
   - Extracts structured partner information
   - Falls back to rule-based extraction if models fail

2. **API Endpoints**: `backend/app/api/v1/partner_ai.py`
   - `POST /api/v1/partners/ai/chat` - Process chat messages
   - `POST /api/v1/partners/ai/voice` - Process voice input
   - `POST /api/v1/partners/ai/document` - Process document uploads
   - `POST /api/v1/partners/ai/save-partner` - Save extracted partner data

### Frontend

1. **Service**: `frontend/src/services/partnerAI.js`
   - API client for AI endpoints

2. **Component Updates**: `frontend/src/components/AddTradingPartnerChat.jsx`
   - Integrated AI processing for chat messages
   - Document upload now uses AI extraction
   - Voice input can optionally use AI processing
   - Auto-fills form data from extracted information

## Data Flow

1. **Chat Message**:
   - User sends message → AI processes → Extracts partner info → Updates form → Stores in DB

2. **Voice Input**:
   - User speaks → Whisper transcribes → AI extracts info → Updates form → Stores in DB

3. **Document Upload**:
   - User uploads file → AI extracts structured data → Auto-fills form → Stores in DB

## Installation

```bash
# Backend dependencies
cd backend
pip install transformers torch librosa PyPDF2 python-docx pandas openpyxl

# Set Hugging Face token (optional)
export HUGGINGFACE_API_TOKEN="your_token_here"
```

## Configuration

Add to `.env`:
```
HUGGINGFACE_API_TOKEN=your_token_here
```

## Usage

The AI integration is automatic. When users:
- Type messages → AI extracts information
- Upload documents → AI extracts structured data
- Use voice → AI transcribes and extracts

All extracted data is automatically merged into the partner form and saved to the database.

## Fallback Behavior

If Hugging Face models are unavailable:
- Falls back to rule-based regex extraction
- System continues to function normally
- No breaking errors

## Performance

- First model load: ~30-60 seconds
- Subsequent requests: ~1-3 seconds
- GPU recommended for faster inference
- Models use lazy loading to reduce startup time

## Extracted Fields

The AI extracts:
- Business name
- Partner code
- Role (Customer/Supplier/Both)
- Industry
- Country
- Timezone
- Contact information (email, phone)
- EDI configuration details
- Document types
- And more...

## Next Steps

1. Install dependencies: `pip install -r requirements.txt`
2. Set Hugging Face token (optional but recommended)
3. Start backend server
4. Test with chat, voice, and document uploads
