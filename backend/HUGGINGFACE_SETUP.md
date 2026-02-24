# Hugging Face Model Setup for Partner AI

This document explains how to set up Hugging Face models for the Partner Setup AI chatbot.

## Models Used

1. **Conversational AI**: `Qwen/Qwen2.5-7B-Instruct`
   - Alternative: `meta-llama/Meta-Llama-3-8B-Instruct`
   - Purpose: Process chat messages and extract partner information

2. **Speech-to-Text**: `openai/whisper-base`
   - Purpose: Convert voice input to text

3. **Document Understanding**: `microsoft/layoutlmv3-base`
   - Purpose: Extract structured information from uploaded documents (PDF, DOCX, XLSX)

## Installation

1. Install required packages:
```bash
pip install transformers torch librosa PyPDF2 python-docx pandas openpyxl
```

2. Set up Hugging Face token (optional but recommended):
```bash
export HUGGINGFACE_API_TOKEN="your_token_here"
```

Or add to `.env`:
```
HUGGINGFACE_API_TOKEN=your_token_here
```

## Model Loading

Models are loaded lazily (on first use) to reduce startup time. The first request may take longer as models download and initialize.

## API Endpoints

- `POST /api/v1/partners/ai/chat` - Process chat messages
- `POST /api/v1/partners/ai/voice` - Process voice input
- `POST /api/v1/partners/ai/document` - Process document uploads
- `POST /api/v1/partners/ai/save-partner` - Save extracted partner data

## Usage

The frontend `AddTradingPartnerChat` component automatically uses these services when:
- User sends a chat message
- User uploads a document
- User uses voice input

## Fallback Behavior

If Hugging Face models are not available or fail to load, the system falls back to rule-based extraction using regex patterns.

## Performance Notes

- First model load: ~30-60 seconds (depending on hardware)
- Subsequent requests: ~1-3 seconds
- GPU recommended for faster inference
- Models use quantization when available to reduce memory usage

## Troubleshooting

1. **Out of Memory**: Use smaller models or enable quantization
2. **Slow Loading**: Models download on first use (~2-5GB total)
3. **API Errors**: Check Hugging Face token if using gated models
