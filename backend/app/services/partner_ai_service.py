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
if HAS_GPU and TORCH_AVAILABLE:
    try:
        from transformers import pipeline, AutoTokenizer, AutoModelForCausalLM
        from transformers import WhisperProcessor, WhisperForConditionalGeneration
        HF_AVAILABLE = True
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
        self.whisper_model_name = "openai/whisper-base"
        self.document_model_name = "microsoft/layoutlmv3-base"
        
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
        Process chat message using conversational AI model
        
        Args:
            message: User's message
            conversation_history: Previous conversation messages
            context: Additional context about partner setup
            
        Returns:
            Dict with response and extracted information
        """
        try:
            if not HF_AVAILABLE:
                return self._extract_info_rule_based(message, context)
            
            self._load_chat_model()
            
            if self.chat_model is None:
                return self._extract_info_rule_based(message, context)
            
            # Build conversation prompt
            system_prompt = """You are an AI assistant helping to set up a trading partner for an EDI system.
Extract relevant information from the conversation and respond naturally.
Focus on: business name, partner code, role (Customer/Supplier/Both), industry, country, timezone, contacts, EDI standards, document types.
Be conversational and guide the user through the setup process."""
            
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            if conversation_history:
                messages.extend(conversation_history)
            
            messages.append({"role": "user", "content": message})
            
            # Format messages for the model
            if hasattr(self.chat_tokenizer, 'apply_chat_template'):
                prompt = self.chat_tokenizer.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True
                )
            else:
                # Fallback formatting
                prompt = "\n".join([f"{m['role']}: {m['content']}" for m in messages])
            
            # Generate response
            inputs = self.chat_tokenizer(prompt, return_tensors="pt").to(self.device)
            
            with torch.no_grad():
                outputs = self.chat_model.generate(
                    **inputs,
                    max_new_tokens=256,
                    temperature=0.7,
                    do_sample=True,
                    pad_token_id=self.chat_tokenizer.eos_token_id
                )
            
            response_text = self.chat_tokenizer.decode(outputs[0][inputs['input_ids'].shape[1]:], skip_special_tokens=True)
            
            # Extract structured information
            extracted_data = self._extract_partner_info(message, response_text, context)
            
            return {
                "response": response_text.strip(),
                "extracted_data": extracted_data,
                "confidence": 0.85
            }
            
        except Exception as e:
            logger.error(f"Error processing chat message: {e}")
            # Fallback to rule-based
            return self._extract_info_rule_based(message, context)
    
    async def process_voice_input(
        self,
        audio_data: bytes,
        audio_format: str = "wav"
    ) -> Dict[str, Any]:
        """
        Process voice input using Whisper model
        
        Args:
            audio_data: Audio file bytes
            audio_format: Audio format (wav, mp3, etc.)
            
        Returns:
            Dict with transcribed text and extracted information
        """
        try:
            if not HF_AVAILABLE:
                return {
                    "text": "",
                    "error": "Voice input requires a GPU. Please type your message instead."
                }
            
            self._load_whisper_model()
            
            if self.whisper_model is None:
                return {
                    "text": "",
                    "error": "Whisper model not loaded"
                }
            
            # Process audio
            import librosa
            import numpy as np
            
            # Load audio
            audio_array, sample_rate = librosa.load(BytesIO(audio_data), sr=16000)
            
            # Process with Whisper
            inputs = self.whisper_processor(
                audio_array,
                sampling_rate=sample_rate,
                return_tensors="pt"
            ).to(self.device)
            
            with torch.no_grad():
                generated_ids = self.whisper_model.generate(
                    inputs["input_features"],
                    max_length=448
                )
            
            transcription = self.whisper_processor.batch_decode(
                generated_ids,
                skip_special_tokens=True
            )[0]
            
            # Extract information from transcribed text
            extracted_data = self._extract_partner_info(transcription, "", {})
            
            return {
                "text": transcription,
                "extracted_data": extracted_data,
                "confidence": 0.90
            }
            
        except Exception as e:
            logger.error(f"Error processing voice input: {e}")
            return {
                "text": "",
                "error": str(e)
            }
    
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
    
    def _extract_partner_info(
        self,
        text: str,
        ai_response: str = "",
        context: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Extract structured partner information from text"""
        extracted = {}
        text_lower = text.lower()
        
        # Extract business name
        if not extracted.get("business_name"):
            # Look for common patterns
            patterns = [
                r"business name[:\s]+([A-Z][a-zA-Z\s&.,]+)",
                r"company[:\s]+([A-Z][a-zA-Z\s&.,]+)",
                r"legal name[:\s]+([A-Z][a-zA-Z\s&.,]+)",
            ]
            import re
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE)
                if match:
                    extracted["business_name"] = match.group(1).strip()
                    break
        
        # Extract partner code
        if not extracted.get("partner_code"):
            match = re.search(r"partner code[:\s]+([A-Z0-9]{1,10})", text, re.IGNORECASE)
            if match:
                extracted["partner_code"] = match.group(1).strip().upper()
        
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
            extracted["business_name"] = answer
        elif current_question == "partnerCode" and answer and not extracted.get("partner_code"):
            extracted["partner_code"] = answer.upper()
        elif current_question == "role" and answer:
            extracted["role"] = answer
        elif current_question == "industry" and answer:
            extracted["industry"] = answer
        elif current_question == "country" and answer:
            extracted["country"] = answer
        
        responses = {
            "businessName": f"Got it! I've noted the business name: **{answer}**.",
            "partnerCode": f"Partner code **{answer.upper()}** registered.",
            "role": f"Role set to **{answer}**.",
            "industry": f"Industry: **{answer}**. Noted!",
            "country": f"Location: **{answer}**.",
            "timezone": f"Timezone set to **{answer}**.",
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
        
        response = responses.get(current_question, f"Got it! **{answer}** noted.")
        
        return {
            "response": response,
            "extracted_data": extracted,
            "confidence": 0.70
        }
    
    async def _extract_from_pdf(self, file_data: bytes) -> Dict[str, Any]:
        """Extract information from PDF"""
        try:
            import PyPDF2
            pdf_reader = PyPDF2.PdfReader(BytesIO(file_data))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            return self._extract_partner_info(text)
        except Exception as e:
            logger.error(f"Error extracting from PDF: {e}")
            return {}
    
    async def _extract_from_docx(self, file_data: bytes) -> Dict[str, Any]:
        """Extract information from DOCX"""
        try:
            from docx import Document
            doc = Document(BytesIO(file_data))
            text = "\n".join([para.text for para in doc.paragraphs])
            return self._extract_partner_info(text)
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
