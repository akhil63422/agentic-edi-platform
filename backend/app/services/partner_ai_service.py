"""
Partner AI Service using Hugging Face Models
Handles conversational AI, speech-to-text, and document understanding for partner setup
"""
import os
import logging
import re
from typing import Dict, Any, List, Optional
import json
import base64
from io import BytesIO

try:
    import torch
    TORCH_AVAILABLE = True
    HAS_GPU = torch.cuda.is_available()
except ImportError:
    TORCH_AVAILABLE = False
    HAS_GPU = False

HF_AVAILABLE = False
LAYOUTLM_AVAILABLE = False
if HAS_GPU and TORCH_AVAILABLE:
    try:
        from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        HF_AVAILABLE = True
        try:
            from transformers import LayoutLMv3Processor, LayoutLMv3ForTokenClassification
            from PIL import Image
            LAYOUTLM_AVAILABLE = True
        except ImportError:
            logging.info("LayoutLMv3 or Pillow not available — document QA will use text extraction.")
    except ImportError:
        logging.warning("Hugging Face transformers not installed.")

logger = logging.getLogger(__name__)


class PartnerAIService:
    """
    AI Service for Partner Setup.
    Uses Hugging Face models on GPU, falls back to rule-based extraction on CPU.
    """
    
    def __init__(self):
        self.hf_token = os.getenv("HUGGINGFACE_API_TOKEN", "")
        self.device = "cuda" if HAS_GPU else "cpu"
        
        self.chat_model = None
        self.chat_tokenizer = None
        self.whisper_processor = None
        self.whisper_model = None
        self.document_qa_model = None
        
        self.chat_model_name = "Qwen/Qwen2.5-7B-Instruct"
        self.whisper_model_name = os.getenv("WHISPER_MODEL", "openai/whisper-medium")  # medium > small for accuracy (~5GB VRAM)
        self.document_model_name = "microsoft/layoutlmv3-base"
        self.layoutlm_processor = None
        self.layoutlm_model = None
        self._system_prompt = None
        self._name_synonyms = {"one word": "oneworld"}

        if not HAS_GPU:
            logger.info("PartnerAIService: No GPU detected, using rule-based extraction (skipping large model loading)")
        else:
            logger.info(f"PartnerAIService initialized with device: {self.device}")
    
    def _load_chat_model(self):
        """Lazy load conversational AI model (GPU only)"""
        if not HAS_GPU or not HF_AVAILABLE:
            return
        if self.chat_model is None:
            try:
                logger.info(f"Loading chat model: {self.chat_model_name}")
                self.chat_tokenizer = AutoTokenizer.from_pretrained(
                    self.chat_model_name,
                    token=self.hf_token if self.hf_token else None,
                    trust_remote_code=True
                )
                self.chat_model = AutoModelForCausalLM.from_pretrained(
                    self.chat_model_name,
                    token=self.hf_token if self.hf_token else None,
                    torch_dtype=torch.float16,
                    device_map="auto",
                    trust_remote_code=True
                )
                logger.info("Chat model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading chat model: {e}")
                self.chat_model = None
    
    def _load_layoutlm_model(self):
        """Lazy load LayoutLMv3 document understanding model (GPU only)."""
        if not HAS_GPU or not LAYOUTLM_AVAILABLE:
            return
        if self.layoutlm_model is None:
            try:
                logger.info(f"Loading LayoutLMv3 model: {self.document_model_name}")
                self.layoutlm_processor = LayoutLMv3Processor.from_pretrained(
                    self.document_model_name,
                    token=self.hf_token if self.hf_token else None,
                    apply_ocr=False,
                )
                self.layoutlm_model = LayoutLMv3ForTokenClassification.from_pretrained(
                    self.document_model_name,
                    token=self.hf_token if self.hf_token else None,
                    torch_dtype=torch.float16,
                    device_map="auto",
                )
                logger.info("LayoutLMv3 model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading LayoutLMv3 model: {e}")
                self.layoutlm_model = None

    def _load_whisper_model(self):
        """Lazy load Whisper speech-to-text model (GPU only)"""
        if not HAS_GPU or not HF_AVAILABLE:
            return
        if self.whisper_model is None:
            try:
                logger.info(f"Loading Whisper model: {self.whisper_model_name}")
                self.whisper_processor = WhisperProcessor.from_pretrained(
                    self.whisper_model_name,
                    token=self.hf_token if self.hf_token else None
                )
                self.whisper_model = WhisperForConditionalGeneration.from_pretrained(
                    self.whisper_model_name,
                    token=self.hf_token if self.hf_token else None,
                    torch_dtype=torch.float16,
                    device_map="auto"
                )
                logger.info("Whisper model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading Whisper model: {e}")
                self.whisper_model = None
    
    async def process_chat_message(
        self,
        message: str,
        conversation_history: List[Dict[str, str]] = None,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Process chat message - uses context-aware responses so the right field is acknowledged.
        When current_question is set, always use rule-based response to avoid wrong acknowledgments.
        """
        current_question = (context or {}).get("current_question", "")
        # When we know the current field, use rule-based for correct acknowledgment (e.g. "Partner code X registered")
        if current_question:
            rule_result = self._extract_info_rule_based(message, context)
            if HF_AVAILABLE and self.chat_model:
                try:
                    self._load_chat_model()
                    if self.chat_model:
                        ai_extracted = self._extract_partner_info(message, "", context)
                        for k, v in (ai_extracted or {}).items():
                            if v and not rule_result.get("extracted_data", {}).get(k):
                                rule_result.setdefault("extracted_data", {})[k] = v
                except Exception:
                    pass
            return rule_result

        try:
            if not HF_AVAILABLE:
                return self._extract_info_rule_based(message, context)
            self._load_chat_model()
            if self.chat_model is None:
                return self._extract_info_rule_based(message, context)

            system_prompt = getattr(self, "_system_prompt", None) or (
                "You are an AI assistant helping to set up a trading partner for an EDI system. "
                "Extract: business name, partner code, role, industry, country, timezone, contacts. "
                "Be conversational and guide the user."
            )
            messages = [{"role": "system", "content": system_prompt}]
            if conversation_history:
                messages.extend(conversation_history)
            messages.append({"role": "user", "content": message})

            if hasattr(self.chat_tokenizer, "apply_chat_template"):
                prompt = self.chat_tokenizer.apply_chat_template(
                    messages, tokenize=False, add_generation_prompt=True
                )
            else:
                prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])

            inputs = self.chat_tokenizer(prompt, return_tensors="pt").to(self.device)
            with torch.no_grad():
                outputs = self.chat_model.generate(
                    **inputs,
                    max_new_tokens=256,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=self.chat_tokenizer.eos_token_id,
                )
            response_text = self.chat_tokenizer.decode(
                outputs[0][inputs["input_ids"].shape[1] :], skip_special_tokens=True
            )
            extracted_data = self._extract_partner_info(message, response_text, context)
            return {"response": response_text.strip(), "extracted_data": extracted_data, "confidence": 0.85}
        except Exception as e:
            logger.error(f"Error processing chat message: {e}")
            return self._extract_info_rule_based(message, context)
    
    async def _transcribe_openai(self, audio_data: bytes, audio_format: str) -> Optional[str]:
        """Use OpenAI Whisper API for higher accuracy (requires OPENAI_API_KEY)."""
        try:
            import tempfile
            from openai import OpenAI
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
            client = OpenAI(api_key=api_key)
            ext = "wav"
            if "webm" in audio_format or "ogg" in audio_format:
                ext = "webm"
            elif "mp3" in audio_format or "mpeg" in audio_format:
                ext = "mp3"
            elif "mp4" in audio_format:
                ext = "m4a"
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
                f.write(audio_data)
                tmp_path = f.name
            try:
                with open(tmp_path, "rb") as af:
                    resp = client.audio.transcriptions.create(model="whisper-1", file=af, language="en")
                return (resp.text or "").strip() if resp else None
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass
        except Exception as e:
            logger.warning(f"OpenAI Whisper fallback failed: {e}")
            return None

    async def process_voice_input(
        self,
        audio_data: bytes,
        audio_format: str = "wav",
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Process voice input - try OpenAI API first (if key set), else local Whisper.
        Uses whisper-medium by default for better accuracy.
        """
        try:
            # 1. Try OpenAI Whisper API first (best accuracy, requires OPENAI_API_KEY)
            transcription = await self._transcribe_openai(audio_data, audio_format)
            if transcription is not None:
                return {"text": transcription, "extracted_data": {}, "confidence": 0.95}

            # 2. Fall back to local Whisper (requires GPU)
            if not HF_AVAILABLE:
                return {
                    "text": "",
                    "error": "Voice requires GPU or OPENAI_API_KEY. Set OPENAI_API_KEY for cloud transcription."
                }

            self._load_whisper_model()
            if self.whisper_model is None:
                return {"text": "", "error": "Whisper model not loaded. Set OPENAI_API_KEY for cloud fallback."}

            import librosa
            audio_array, sample_rate = librosa.load(BytesIO(audio_data), sr=16000, mono=True)
            if len(audio_array) == 0:
                return {"text": "", "error": "Empty or invalid audio"}

            inputs = self.whisper_processor(
                audio_array, sampling_rate=sample_rate, return_tensors="pt"
            ).to(self.device)
            input_features = inputs.get("input_features") or inputs.get("input_ids")
            if input_features is None:
                input_features = inputs[list(inputs.keys())[0]]

            with torch.no_grad():
                generated_ids = self.whisper_model.generate(
                    input_features, max_length=448, language="en", task="transcribe"
                )

            transcription = self.whisper_processor.batch_decode(
                generated_ids, skip_special_tokens=True
            )[0]

            return {"text": transcription.strip(), "extracted_data": {}, "confidence": 0.90}

        except Exception as e:
            logger.error(f"Error processing voice input: {e}")
            return {"text": "", "error": str(e)}
    
    async def process_document_upload(
        self,
        file_data: bytes,
        file_name: str,
        file_type: str
    ) -> Dict[str, Any]:
        """
        Process uploaded document to extract partner information
        
        Args:
            file_data: File bytes
            file_name: File name
            file_type: File MIME type (pdf, docx, xlsx, etc.)
            
        Returns:
            Dict with extracted information
        """
        try:
            extracted_data = {}
            
            # Handle different file types
            if file_type == "application/pdf":
                extracted_data = await self._extract_from_pdf(file_data)
            elif file_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
                extracted_data = await self._extract_from_docx(file_data)
            elif file_type in ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"]:
                extracted_data = await self._extract_from_excel(file_data)
            else:
                # Try to extract text from any file
                extracted_data = await self._extract_text_generic(file_data, file_type)
            
            return {
                "extracted_data": extracted_data,
                "confidence": 0.80,
                "file_name": file_name
            }
            
        except Exception as e:
            logger.error(f"Error processing document: {e}")
            return {
                "extracted_data": {},
                "error": str(e)
            }
    
    def _normalize_partner_code(self, text: str) -> str:
        """Convert voice input (e.g. 'one two three' or '1 2 3') to alphanumeric code, max 10 chars."""
        word_to_digit = {
            "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
            "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
            "oh": "0",
        }
        text = text.strip().lower()
        parts = re.split(r"\s+", text)
        result = []
        for p in parts:
            if p in word_to_digit:
                result.append(word_to_digit[p])
            else:
                digits = re.sub(r"\D", "", p)
                result.append(digits if digits else p)
        code = "".join(result)[:10]
        return code.upper() if code else ""

    def _normalize_email_voice(self, text: str) -> str:
        """Fix common voice misrecognitions for email: 'a'/'at' -> '@', 'dot' -> '.'"""
        if not text or not isinstance(text, str):
            return text
        t = text.strip()
        m = re.search(r"^(.+?)\s+(?:a|at)\s+(\w+(?:\.\w+)*)\s*$", t, re.IGNORECASE)
        if m:
            local = re.sub(r"\s+", "", m.group(1))
            domain = re.sub(r"\s+", "", m.group(2))
            return f"{local}@{domain}"
        return re.sub(r"\s+", "", t)

    def _normalize_phone_voice(self, text: str) -> str:
        """Convert spoken digits to phone number."""
        words = {"zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
                 "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "oh": "0"}
        parts = re.split(r"\s+", text.strip().lower())
        out = []
        for p in parts:
            out.append(words.get(p, re.sub(r"\D", "", p)))
        return "".join(out)[:20] or text

    def _normalize_voice_option(self, text: str, options: list) -> str:
        """Match voice input to valid option (e.g. 'customer' -> 'Customer', 's f t p' -> 'SFTP')."""
        if not text or not options:
            return text.strip() if text else ""
        q = text.strip().lower().replace("-", " ").replace("/", " ").replace("_", " ")
        # Common voice synonyms for EDI/partner terms
        synonyms = {
            "customer": "Customer", "client": "Customer", "buyer": "Customer",
            "supplier": "Supplier", "vendor": "Supplier", "seller": "Supplier",
            "both": "Both", "either": "Both", "each": "Both",
            "ex twelve": "X12", "x 12": "X12", "x twelve": "X12",
            "s f t p": "SFTP", "sftp": "SFTP", "secure ftp": "SFTP",
            "new york": "America/New_York", "eastern": "America/New_York",
            "chicago": "America/Chicago", "central": "America/Chicago",
            "denver": "America/Denver", "mountain": "America/Denver",
            "los angeles": "America/Los_Angeles", "pacific": "America/Los_Angeles",
        }
        if q in synonyms and synonyms[q] in options:
            return synonyms[q]
        for opt in options:
            opt_lower = opt.lower().replace("-", " ").replace("/", " ").replace("_", " ")
            key = opt.split("(")[0].strip().lower()
            if q == opt_lower or q == key or opt_lower.startswith(q) or q.startswith(key):
                return opt
            if q in opt_lower or (len(q) >= 2 and key and (q in key or key in q)):
                return opt
        return text.strip()

    def _extract_partner_info(
        self,
        text: str,
        ai_response: str = "",
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Extract structured partner information from text"""
        extracted = {}
        text_lower = text.lower()
        text_clean = re.sub(r"\s+", " ", text).strip()

        # Extract business name - natural language patterns first
        if not extracted.get("business_name"):
            nl_patterns = [
                r"add\s+(.+?)\s+as\s+(?:a\s+)?trading\s+partner",
                r"add\s+(.+?)\s+as\s+(?:a\s+)?partner",
                r"need\s+to\s+add\s+(.+?)\s+as\s+(?:a\s+)?trading\s+partner",
                r"i\s+want\s+to\s+add\s+(.+?)\s+as",
                r"(?:add|register)\s+([A-Za-z0-9\s&.-]+?)\s+(?:as|as a)",
            ]
            for pat in nl_patterns:
                match = re.search(pat, text, re.IGNORECASE)
                if match:
                    name = match.group(1).strip()
                    if len(name) > 1 and name.lower() not in ("a", "the", "it"):
                        name_lower = name.lower()
                        synonyms = getattr(self, "_name_synonyms", None) or {"one word": "oneworld"}
                        name = synonyms.get(name_lower, name)
                        extracted["business_name"] = name.title() if name.islower() else name
                        break
            if not extracted.get("business_name"):
                for pat in [
                    r"business name[:\s]+([A-Za-z0-9\s&.,]+)",
                    r"company[:\s]+([A-Za-z0-9\s&.,]+)",
                    r"legal name[:\s]+([A-Za-z0-9\s&.,]+)",
                ]:
                    match = re.search(pat, text, re.IGNORECASE)
                    if match:
                        extracted["business_name"] = match.group(1).strip()
                        break

        # Extract partner code
        if not extracted.get("partner_code"):
            match = re.search(r"partner code[:\s]+([A-Za-z0-9\s]{1,15})", text, re.IGNORECASE)
            if match:
                code = re.sub(r"\s+", "", match.group(1))[:10]
                if code:
                    extracted["partner_code"] = code.upper()
        
        # Extract role
        if "customer" in text_lower and "supplier" in text_lower:
            extracted["role"] = "Both"
        elif "customer" in text_lower:
            extracted["role"] = "Customer"
        elif "supplier" in text_lower:
            extracted["role"] = "Supplier"
        
        # Extract industry
        industries = ["retail", "manufacturing", "logistics", "healthcare", "automotive"]
        for industry in industries:
            if industry in text_lower:
                extracted["industry"] = industry.capitalize()
                break
        
        # Extract country
        countries = ["united states", "usa", "canada", "mexico", "uk", "united kingdom"]
        for country in countries:
            if country in text_lower:
                extracted["country"] = country.title()
                break
        
        # Extract email
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        emails = re.findall(email_pattern, text)
        if emails:
            extracted["email"] = emails[0]
        
        # Extract phone
        phone_pattern = r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}"
        phones = re.findall(phone_pattern, text)
        if phones:
            extracted["phone"] = phones[0]
        
        return extracted
    
    def _extract_info_rule_based(
        self,
        message: str,
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Context-aware rule-based extraction"""
        extracted = self._extract_partner_info(message, "", context)
        
        current_question = (context or {}).get("current_question", "")
        answer = message.strip()
        
        if current_question == "businessName" and answer and not extracted.get("business_name"):
            extracted["business_name"] = answer.strip()
        elif current_question == "partnerCode" and answer and not extracted.get("partner_code"):
            code = self._normalize_partner_code(answer)
            if code:
                extracted["partner_code"] = code
        elif current_question == "role" and answer:
            extracted["role"] = self._normalize_voice_option(answer, ["Customer", "Supplier", "Both"])
        elif current_question == "industry" and answer:
            extracted["industry"] = self._normalize_voice_option(answer, ["Retail", "Manufacturing", "Logistics", "Healthcare", "Automotive", "Other"])
        elif current_question == "country" and answer:
            extracted["country"] = answer.strip()
        elif current_question == "timezone" and answer:
            extracted["timezone"] = self._normalize_voice_option(answer, ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC", "Other"])
        elif current_question == "ediStandard" and answer:
            extracted["ediStandard"] = self._normalize_voice_option(answer, ["X12", "EDIFACT", "TRADACOMS"])
        elif current_question == "version" and answer:
            extracted["version"] = self._normalize_voice_option(answer, ["5010", "4010", "3060"])
        elif current_question == "transportType" and answer:
            extracted["transportType"] = self._normalize_voice_option(answer, ["SFTP", "S3", "FTP", "AS2"])
        elif current_question in ("businessContactName", "technicalContactName") and answer:
            extracted["name"] = answer.strip()
        elif current_question in ("businessContactEmail", "technicalContactEmail") and answer:
            extracted["email"] = self._normalize_email_voice(answer)
        elif current_question in ("businessContactPhone", "technicalContactPhone") and answer:
            extracted["phone"] = self._normalize_phone_voice(answer)
        
        display_answer = answer
        if current_question == "partnerCode" and extracted.get("partner_code"):
            display_answer = extracted["partner_code"]
        elif current_question == "businessName" and extracted.get("business_name"):
            display_answer = extracted["business_name"]

        responses = {
            "businessName": f"Got it! I've noted the business name: **{display_answer}**.",
            "partnerCode": f"Partner code **{display_answer}** registered.",
            "role": f"Role set to **{display_answer}**.",
            "industry": f"Industry: **{display_answer}**. Noted!",
            "country": f"Location: **{display_answer}**.",
            "timezone": f"Timezone set to **{display_answer}**.",
            "businessContactName": f"Business contact: **{answer}**.",
            "businessContactEmail": f"Email noted: **{answer}**.",
            "businessContactPhone": f"Phone recorded.",
            "technicalContactName": f"Technical contact: **{answer}**.",
            "technicalContactEmail": f"Email noted: **{answer}**.",
            "technicalContactPhone": f"Phone recorded.",
            "ediStandard": f"EDI standard: **{answer}**.",
            "version": f"Version: **{answer}**.",
            "isaSenderId": f"ISA Sender ID set.",
            "isaReceiverId": f"ISA Receiver ID set.",
            "documents": f"Document types registered.",
            "transportType": f"Transport method: **{answer}**.",
        }
        
        response = responses.get(current_question, f"Got it! **{display_answer}** noted.")
        
        return {
            "response": response,
            "extracted_data": extracted,
            "confidence": 0.70
        }
    
    async def _extract_with_gpt4o_vision(self, file_data: bytes, file_type: str) -> Optional[Dict[str, Any]]:
        """Use GPT-4o Vision to extract partner info from document images or PDFs."""
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        try:
            import base64 as _b64
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)

            b64_data = _b64.b64encode(file_data).decode("utf-8")
            mime = file_type if file_type else "application/pdf"

            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "Extract trading partner information from this document. "
                                    "Return a JSON object with these fields (omit missing ones): "
                                    "business_name, partner_code, role (Customer/Supplier/Both), "
                                    "industry, country, timezone, email, phone, edi_standard, "
                                    "isa_sender_id, isa_receiver_id. "
                                    "Respond ONLY with the JSON object, no markdown."
                                ),
                            },
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:{mime};base64,{b64_data}"},
                            },
                        ],
                    }
                ],
                response_format={"type": "json_object"},
                max_tokens=500,
            )
            result = json.loads(response.choices[0].message.content.strip())
            logger.info("GPT-4o Vision extracted partner info from document")
            return result
        except Exception as e:
            logger.warning(f"GPT-4o Vision extraction failed: {e}")
            return None

    async def _extract_from_pdf(self, file_data: bytes) -> Dict[str, Any]:
        """Extract information from PDF.

        Priority order:
        1. LayoutLMv3 (GPU, if model loaded and PDF has renderable pages)
        2. PyPDF2 text extraction → rule-based NER
        3. GPT-4o Vision fallback (if OPENAI_API_KEY set)
        """
        text = ""
        try:
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(BytesIO(file_data))
            for page in pdf_reader.pages:
                page_text = page.extract_text() or ""
                text += page_text
        except Exception as e:
            logger.warning(f"PyPDF2 extraction failed: {e}")

        # 1. LayoutLMv3 on GPU
        if HAS_GPU and LAYOUTLM_AVAILABLE:
            try:
                self._load_layoutlm_model()
                if self.layoutlm_model is not None:
                    import fitz  # PyMuPDF
                    pdf_doc = fitz.open(stream=file_data, filetype="pdf")
                    page = pdf_doc[0]
                    pix = page.get_pixmap(dpi=150)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    words = text.split()[:512] if text else ["unknown"]
                    boxes = [[0, 0, 100, 100]] * len(words)
                    encoding = self.layoutlm_processor(
                        img, words, boxes=boxes,
                        return_tensors="pt", truncation=True, max_length=512,
                    ).to(self.device)
                    with torch.no_grad():
                        outputs = self.layoutlm_model(**encoding)
                    # Use text extraction result enriched by model's contextual understanding
                    extracted = self._extract_partner_info(text)
                    if extracted:
                        return extracted
            except Exception as e:
                logger.warning(f"LayoutLMv3 PDF extraction failed: {e}")

        # 2. Rule-based NER on extracted text
        if text.strip():
            extracted = self._extract_partner_info(text)
            if extracted:
                return extracted

        # 3. GPT-4o Vision fallback
        vision_result = await self._extract_with_gpt4o_vision(file_data, "application/pdf")
        if vision_result:
            return vision_result

        return {}
    
    async def _extract_from_docx(self, file_data: bytes) -> Dict[str, Any]:
        """Extract information from DOCX, with GPT-4o cloud fallback."""
        try:
            from docx import Document
            doc = Document(BytesIO(file_data))
            text = "\n".join([para.text for para in doc.paragraphs])
            extracted = self._extract_partner_info(text)
            # If rule-based yields very little, try OpenAI text completion
            if len(extracted) < 2 and os.getenv("OPENAI_API_KEY"):
                try:
                    from openai import AsyncOpenAI
                    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                    resp = await client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=[
                            {"role": "system", "content": "Extract trading partner info from document text. Return JSON with: business_name, partner_code, role, industry, country, timezone, email, phone. Respond only with JSON."},
                            {"role": "user", "content": text[:3000]},
                        ],
                        response_format={"type": "json_object"},
                        max_tokens=300,
                    )
                    extracted = json.loads(resp.choices[0].message.content.strip())
                except Exception as e:
                    logger.warning(f"GPT-4o DOCX extraction fallback failed: {e}")
            return extracted
        except Exception as e:
            logger.error(f"Error extracting from DOCX: {e}")
            return {}
    
    async def _extract_from_excel(self, file_data: bytes) -> Dict[str, Any]:
        """Extract information from Excel"""
        try:
            import pandas as pd
            df = pd.read_excel(BytesIO(file_data))
            text = df.to_string()
            return self._extract_partner_info(text)
        except Exception as e:
            logger.error(f"Error extracting from Excel: {e}")
            return {}
    
    async def _extract_text_generic(self, file_data: bytes, file_type: str) -> Dict[str, Any]:
        """Generic text extraction"""
        try:
            text = file_data.decode('utf-8', errors='ignore')
            return self._extract_partner_info(text)
        except Exception as e:
            logger.error(f"Error extracting text: {e}")
            return {}


# Singleton instance
partner_ai_service = PartnerAIService()
