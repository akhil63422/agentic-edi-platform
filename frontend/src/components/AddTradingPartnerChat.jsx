import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Mic, MicOff, Upload, FileText, Bot, User, CheckCircle2, Loader2, Zap, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { partnerAIService } from '@/services/partnerAI';

const DIGIT_WORDS = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', oh: '0' };

// Normalize voice input for partner code (handles "1 2 3", "one two three", etc.)
const normalizePartnerCode = (text) => {
  const parts = String(text || '').trim().toLowerCase().split(/\s+/);
  const result = parts.map((p) => DIGIT_WORDS[p] ?? p.replace(/\D/g, '')).join('');
  return result.slice(0, 10).toUpperCase() || text.replace(/\s/g, '').slice(0, 10).toUpperCase();
};

// Common voice→text corrections for email (e.g. "aunty" often misheard for "akhil")
const EMAIL_VOICE_CORRECTIONS = { aunty: 'akhil', aali: 'akhil' };

// Normalize voice for email - fix "aunty 6390 a gmail.com" → "akhil6390@gmail.com" (at/a → @, dot → .)
const normalizeEmailForVoice = (text) => {
  if (!text?.trim()) return text;
  let t = String(text).trim();
  t = t.replace(/\s+dot\s+/gi, '.').replace(/\s+at\s+/gi, ' @ ');
  const match = t.match(/^(.+?)\s+(?:a|at)\s+(\w+(?:\.\w+)*)$/i);
  if (match) {
    let local = match[1].replace(/\s/g, '');
    const domain = match[2].replace(/\s/g, '');
    Object.entries(EMAIL_VOICE_CORRECTIONS).forEach(([wrong, right]) => {
      local = local.replace(new RegExp(wrong, 'gi'), right);
    });
    return `${local}@${domain}`;
  }
  return t.replace(/\s/g, '').replace(/\.+/g, '.');
};

// Normalize voice for phone - "one two three four five six seven eight nine zero" → digits
const normalizePhoneForVoice = (text) => {
  if (!text?.trim()) return text;
  const parts = String(text).trim().toLowerCase().split(/\s+/);
  const result = parts.map((p) => DIGIT_WORDS[p] ?? p.replace(/\D/g, '')).join('');
  return result.slice(0, 20) || text.replace(/\s/g, '').replace(/\D/g, '').slice(0, 20) || text;
};

// Strip emojis and normalize text for clean TTS output
const toSpeakableText = (text) => {
  if (!text?.trim()) return '';
  return String(text)
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Match voice input to multi-select options (e.g. "customer" -> "Customer", "america new york" -> "America/New_York")
const matchVoiceToOptions = (text, options = []) => {
  if (!text?.trim() || !options?.length) return null;
  const q = String(text).trim().toLowerCase().replace(/\s+/g, ' ');
  const lowerOptions = options.map((o) => ({ original: o, lower: o.toLowerCase().replace(/[_\-\/]/g, ' '), key: o.split(/[\s\(]/)[0]?.toLowerCase() }));
  // Exact or starts-with match
  for (const { original, lower, key } of lowerOptions) {
    if (lower === q || lower.startsWith(q) || q === key || q.startsWith(key)) return original;
  }
  // Partial match (e.g. "retail" in "Retail", "customer" in "Customer")
  for (const { original, lower, key } of lowerOptions) {
    if (lower.includes(q) || q.includes(key) || (q.length >= 2 && key?.includes(q))) return original;
  }
  // Multi-select: "850 and 810" or "850, 810" -> match each part
  const parts = q.split(/\s+and\s+|\s*,\s*|\s+/).filter((p) => p.length >= 2);
  const matched = [...new Set(parts.map((p) => lowerOptions.find(({ lower, key }) => lower.includes(p) || key?.includes(p) || p.includes(key))).filter(Boolean).map(({ original }) => original))];
  return matched.length > 0 ? (matched.length === 1 ? matched[0] : matched) : null;
};

// Conversation flow configuration
const CONVERSATION_FLOW = [
  {
    section: 'business',
    questions: [
      {
        id: 'businessName',
        question: "🎮 INITIALIZING PARTNER CONFIGURATION PROTOCOL...\n\nHey there! I'm your AI assistant. Let's set up a new trading partner together! 🚀\n\nFirst, what's the legal business name of the trading partner?",
        speak: "Hey there! I'm your AI assistant. Let's set up a new trading partner together. First, what's the legal business name of the trading partner?",
        type: 'text',
        required: true,
        placeholder: 'e.g., Walmart Inc.',
      },
      {
        id: 'partnerCode',
        question: '✨ Great! Now, what trading partner code would you like to use? This is an internal identifier (max 10 characters).',
        type: 'text',
        required: true,
        placeholder: 'e.g., WMT',
        maxLength: 10,
      },
      {
        id: 'role',
        question: 'What role does this partner play? Are they a Customer, Supplier, or Both?',
        type: 'multi-select',
        options: ['Customer', 'Supplier', 'Both'],
        required: true,
      },
      {
        id: 'industry',
        question: 'What industry are they in?',
        type: 'multi-select',
        options: ['Retail', 'Manufacturing', 'Logistics', 'Healthcare', 'Automotive', 'Other'],
        required: false,
      },
      {
        id: 'country',
        question: 'What country or region are they located in?',
        type: 'text',
        required: false,
        placeholder: 'e.g., United States',
      },
      {
        id: 'timezone',
        question: 'What timezone are they in?',
        type: 'multi-select',
        options: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC', 'Other'],
        required: false,
      },
    ],
  },
  {
    section: 'businessContact',
    questions: [
      {
        id: 'businessContactName',
        question: "Let's set up the business contact. What's their name?",
        type: 'text',
        required: false,
        placeholder: 'e.g., John Doe',
      },
      {
        id: 'businessContactEmail',
        question: 'What is their email address?',
        type: 'text',
        required: false,
        placeholder: 'john.doe@company.com',
      },
      {
        id: 'businessContactPhone',
        question: 'And their phone number?',
        type: 'text',
        required: false,
        placeholder: '+1 (555) 123-4567',
      },
    ],
  },
  {
    section: 'technicalContact',
    questions: [
      {
        id: 'technicalContactName',
        question: "Now for the technical contact. What's their name?",
        type: 'text',
        required: false,
        placeholder: 'e.g., Jane Smith',
      },
      {
        id: 'technicalContactEmail',
        question: 'What is their email address?',
        type: 'text',
        required: false,
        placeholder: 'jane.smith@company.com',
      },
      {
        id: 'technicalContactPhone',
        question: 'And their phone number?',
        type: 'text',
        required: false,
        placeholder: '+1 (555) 987-6543',
      },
    ],
  },
  {
    section: 'ediProfile',
    questions: [
      {
        id: 'ediStandard',
        question: 'Moving on to EDI configuration. What EDI standard do they use?',
        type: 'multi-select',
        options: ['X12', 'EDIFACT', 'TRADACOMS'],
        required: true,
      },
      {
        id: 'version',
        question: 'What version?',
        type: 'multi-select',
        options: ['5010', '4010', '3060'],
        required: true,
      },
      {
        id: 'isaSenderId',
        question: 'What is the ISA Sender ID?',
        type: 'text',
        required: true,
        placeholder: 'e.g., SENDER',
      },
      {
        id: 'isaReceiverId',
        question: 'What is the ISA Receiver ID?',
        type: 'text',
        required: true,
        placeholder: 'e.g., WALMART',
      },
    ],
  },
  {
    section: 'documents',
    questions: [
      {
        id: 'documents',
        question: 'What document types will you exchange? You can select multiple.',
        type: 'multi-select',
        options: ['850 (Purchase Order)', '810 (Invoice)', '856 (Advance Ship Notice)', '997 (Functional Acknowledgment)'],
        required: true,
        multiple: true,
      },
    ],
  },
  {
    section: 'transport',
    questions: [
      {
        id: 'transportType',
        question: 'How will files be transferred?',
        type: 'multi-select',
        options: ['SFTP', 'S3', 'FTP', 'AS2'],
        required: true,
      },
    ],
  },
];

export const AddTradingPartnerChat = ({ open, onClose, onComplete, voiceMode = true }) => {
  const [messages, setMessages] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState({ section: 0, question: 0 });
  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [aiStatus, setAiStatus] = useState('checking'); // 'active' | 'fallback' | 'checking'
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const formDataRef = useRef(formData);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
  const speechUtteranceRef = useRef(null);
  const isProcessingRef = useRef(false);
  formDataRef.current = formData;
  currentQuestionIndexRef.current = currentQuestionIndex;
  isProcessingRef.current = isProcessing;

  // Check AI backend status on mount
  useEffect(() => {
    const checkAI = async () => {
      try {
        const result = await partnerAIService.getStatus();
        setAiStatus(result?.available ? 'active' : 'fallback');
      } catch {
        setAiStatus('fallback');
      }
    };
    if (open) checkAI();
  }, [open]);

  // Initialize conversation
  useEffect(() => {
    if (open && messages.length === 0) {
      const firstQuestion = CONVERSATION_FLOW[0].questions[0];
      setMessages([
        {
          id: '1',
          type: 'ai',
          content: firstQuestion.question,
          speak: firstQuestion.speak,
          questionId: firstQuestion.id,
          questionType: firstQuestion.type,
          options: firstQuestion.options,
        },
      ]);
    }
  }, [open]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-start listening when TTS ends (voice mode only)
  const startAutoListening = useCallback(() => {
    if (!voiceMode || !recognitionRef.current) return;
    if (isProcessingRef.current) return;
    try {
      window.speechSynthesis?.cancel();
      setIsListening(true);
      toast.info('Listening... Speak now.');
      recognitionRef.current.start();
    } catch (e) {
      console.warn('Auto-start listen failed:', e);
      setIsListening(false);
    }
  }, [voiceMode]);

  const startAutoListeningRef = useRef(startAutoListening);
  startAutoListeningRef.current = startAutoListening;

  // Voice output (TTS): speak the question, then auto-start listening when done
  useEffect(() => {
    if (!voiceMode || !open || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.type !== 'ai' || !last.questionId || !last.content) return;
    if (last.id?.startsWith('summary-') || last.id?.startsWith('complete-')) return;
    const speakable = last.speak ? last.speak : toSpeakableText(last.content);
    if (!speakable) return;
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakable);
    u.rate = 0.95;
    u.pitch = 1;
    u.volume = 1;
    u.lang = 'en-US';
    u.onend = () => {
      // Auto-start listening after TTS ends (small delay for browser)
      setTimeout(() => startAutoListeningRef.current?.(), 400);
    };
    speechUtteranceRef.current = u;
    window.speechSynthesis.speak(u);
    return () => window.speechSynthesis.cancel();
  }, [messages, voiceMode, open]);

  // Browser fallback: SpeechRecognition (Chrome)
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript?.trim()) {
          setInputValue(transcript);
          const idx = currentQuestionIndexRef.current;
          const q = CONVERSATION_FLOW[idx?.section]?.questions[idx?.question];
          let answerText = transcript.trim();
          if (q?.id === 'partnerCode') answerText = normalizePartnerCode(answerText) || answerText;
          else if (/Email|email/i.test(q?.id || '')) answerText = normalizeEmailForVoice(answerText) || answerText;
          else if (/Phone|phone/i.test(q?.id || '')) answerText = normalizePhoneForVoice(answerText) || answerText;
          else if (q?.options?.length) {
            const matched = matchVoiceToOptions(answerText, q.options);
            answerText = Array.isArray(matched) ? matched.join(', ') : (matched || answerText);
          }
          setTimeout(() => handleAnswer(answerText, idx).catch(console.error), 100);
        }
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const startListening = async () => {
    if (isListening) return;
    if (voiceMode && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsListening(true);
    toast.info('Listening... Speak now.');

    // Try backend Whisper first (server-side, more accurate)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
        try {
          const result = await partnerAIService.processVoice(blob);
          if (result?.success && result?.text?.trim()) {
            setIsListening(false);
            const extracted = result.extracted_data || {};
            const updates = {};
            if (extracted.business_name) updates.businessName = extracted.business_name;
            if (extracted.partner_code) updates.partnerCode = extracted.partner_code.toUpperCase();
            if (extracted.role) updates.role = extracted.role;
            if (extracted.industry) updates.industry = extracted.industry;
            if (extracted.country) updates.country = extracted.country;
            const fd = formDataRef.current;
            if (extracted.email) updates.businessContact = { ...(fd.businessContact || {}), email: extracted.email };
            if (extracted.phone) updates.businessContact = { ...(updates.businessContact || fd.businessContact || {}), phone: extracted.phone };
            if (Object.keys(updates).length) setFormData((prev) => ({ ...prev, ...updates }));
            const idx = currentQuestionIndexRef.current;
            const q = CONVERSATION_FLOW[idx.section]?.questions[idx.question];
            let answerText = result.text?.trim() || '';
            if (q?.id === 'partnerCode') answerText = normalizePartnerCode(answerText) || answerText;
            else if (/Email|email/i.test(q?.id || '')) answerText = normalizeEmailForVoice(answerText) || answerText;
            else if (/Phone|phone/i.test(q?.id || '')) answerText = normalizePhoneForVoice(answerText) || answerText;
            else if (q?.options?.length) {
              const matched = matchVoiceToOptions(answerText, q.options);
              answerText = Array.isArray(matched) ? matched.join(', ') : (matched || answerText);
            }
            await handleAnswer(answerText, idx);
            toast.success('Voice recognized by AI');
          } else {
            throw new Error(result?.error || 'No transcription');
          }
        } catch (err) {
          console.warn('Backend voice failed, using browser:', err);
          if (recognitionRef.current) recognitionRef.current.start();
          else {
            setIsListening(false);
            toast.error('Voice not available. Please type your answer.');
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      // Auto-stop after 10s
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      }, 10000);
    } catch (err) {
      console.warn('Microphone access failed:', err);
      if (recognitionRef.current) {
        recognitionRef.current.start();
      } else {
        setIsListening(false);
        toast.error('Microphone access denied. Please type your answer.');
      }
    }
  };

  const stopListening = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current?.state === 'listening') {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    toast.info('Processing document with AI...');

    try {
      // Use AI service to process document
      const result = await partnerAIService.processDocument(file);
      
      if (result.success && result.extracted_data) {
        const extractedData = result.extracted_data;
        
        setUploadedFiles(prev => [...prev, { 
          name: file.name, 
          extracted: extractedData,
          confidence: result.confidence 
        }]);
        
        // Auto-fill form data from extracted fields
        const updates = {};
        
        // Map extracted data to form fields
        if (extractedData.business_name) {
          updates.businessName = extractedData.business_name;
        }
        if (extractedData.partner_code) {
          updates.partnerCode = extractedData.partner_code;
        }
        if (extractedData.role) {
          updates.role = extractedData.role;
        }
        if (extractedData.industry) {
          updates.industry = extractedData.industry;
        }
        if (extractedData.country) {
          updates.country = extractedData.country;
        }
        if (extractedData.email) {
          updates.businessContact = {
            ...(formData.businessContact || {}),
            email: extractedData.email,
          };
        }
        if (extractedData.phone) {
          updates.businessContact = {
            ...(updates.businessContact || formData.businessContact || {}),
            phone: extractedData.phone,
          };
        }
        
        setFormData(prev => ({ ...prev, ...updates }));
        
        // Show AI response in chat
        setMessages(prev => [...prev, {
          id: `ai-extract-${Date.now()}`,
          type: 'ai',
          content: `📄 I've extracted information from ${file.name}:\n\n${Object.entries(extractedData).map(([key, value]) => `• ${key}: ${value}`).join('\n')}\n\n✅ Data has been auto-filled in the form!`,
        }]);
        
        toast.success(`Document processed! Extracted ${Object.keys(extractedData).length} fields with ${(result.confidence * 100).toFixed(0)}% confidence.`);
      } else {
        toast.error('Failed to extract data from document');
      }
    } catch (error) {
      console.error('Error processing document:', error);
      toast.error('Error processing document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOptionSelect = (option) => {
    const currentSection = CONVERSATION_FLOW[currentQuestionIndex.section];
    const currentQuestion = currentSection.questions[currentQuestionIndex.question];
    
    if (currentQuestion.multiple) {
      // Multi-select
      setSelectedOptions(prev => 
        prev.includes(option) 
          ? prev.filter(o => o !== option)
          : [...prev, option]
      );
    } else {
      // Single select
      setSelectedOptions([option]);
      handleAnswer(option);
    }
  };

  const handleAnswer = async (answer, overrideIndex = null) => {
    if (!answer || !answer.trim()) return;
    if (isProcessing) return; // Prevent multiple simultaneous calls
    const idx = overrideIndex ?? currentQuestionIndex;
    const currentSection = CONVERSATION_FLOW[idx.section];
    const currentQuestion = currentSection?.questions[idx.question];
    
    if (!currentQuestion) return;
    
    // Add user message immediately
    const userMessageId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMessageId,
      type: 'user',
      content: answer,
    }]);

    // Update form data based on section first
    const updates = {};
    
    if (currentSection.section === 'businessContact') {
      const fieldMap = {
        'businessContactName': 'name',
        'businessContactEmail': 'email',
        'businessContactPhone': 'phone',
      };
      const fieldName = fieldMap[currentQuestion.id] || currentQuestion.id.replace('businessContact', '').toLowerCase();
      updates.businessContact = {
        ...(formData.businessContact || {}),
        [fieldName]: answer,
      };
    } else if (currentSection.section === 'technicalContact') {
      const fieldMap = {
        'technicalContactName': 'name',
        'technicalContactEmail': 'email',
        'technicalContactPhone': 'phone',
      };
      const fieldName = fieldMap[currentQuestion.id] || currentQuestion.id.replace('technicalContact', '').toLowerCase();
      updates.technicalContact = {
        ...(formData.technicalContact || {}),
        [fieldName]: answer,
      };
    } else if (currentQuestion.id === 'documents') {
      updates.documents = answer.split(', ').map(doc => doc.split(' ')[0]);
    } else if (currentQuestion.id === 'partnerCode') {
      updates.partnerCode = normalizePartnerCode(answer);
    } else {
      updates[currentQuestion.id] = answer;
    }
    
    setFormData(prev => ({ ...prev, ...updates }));

    // Process with AI to extract information (non-blocking, don't wait for it)
    setIsProcessing(true);
    
    // Process AI in background without blocking (optional - failures don't block flow)
    (async () => {
      try {
        const conversationHistory = messages
          .filter(m => m.type === 'user' || m.type === 'ai')
          .map(m => ({
            role: m.type === 'user' ? 'user' : 'assistant',
            content: String(m.content || '')
          }))
          .slice(-10);

        // Sanitize context - only plain serializable values (avoids 422)
        const safeFormData = {};
        try {
          Object.keys(formData || {}).forEach((k) => {
            const v = formData[k];
            if (v !== undefined && v !== null && typeof v !== 'function') {
              if (typeof v === 'object' && !Array.isArray(v) && v.constructor?.name !== 'Object') return;
              safeFormData[k] = v;
            }
          });
        } catch (_) {}
        const context = {
          current_section: currentSection.section,
          current_question: currentQuestion.id,
          form_data: safeFormData,
        };

        const result = await partnerAIService.processChat(
          String(answer || ''),
          conversationHistory,
          context
        );

        if (result && result.success && result.extracted_data) {
          const aiUpdates = {};
          const extracted = result.extracted_data;
          
          if (extracted.business_name) aiUpdates.businessName = extracted.business_name;
          if (extracted.partner_code) aiUpdates.partnerCode = extracted.partner_code.toUpperCase();
          if (extracted.role) aiUpdates.role = extracted.role;
          if (extracted.industry) aiUpdates.industry = extracted.industry;
          if (extracted.country) aiUpdates.country = extracted.country;
          if (extracted.timezone) aiUpdates.timezone = extracted.timezone;
          if (extracted.email) {
            aiUpdates.businessContact = {
              ...(formData.businessContact || {}),
              email: extracted.email,
            };
          }
          if (extracted.phone) {
            aiUpdates.businessContact = {
              ...(aiUpdates.businessContact || formData.businessContact || {}),
              phone: extracted.phone,
            };
          }

          setFormData(prev => ({ ...prev, ...aiUpdates }));
        }

        if (result && result.response && result.response.trim()) {
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            type: 'ai',
            content: result.response,
          }]);
        }
      } catch (error) {
        console.error('Error processing with AI:', error);
        // Silently continue - AI is optional
      }
    })();

    // Move to next question immediately (don't wait for AI)
    moveToNextQuestion(idx);
  };

  const moveToNextQuestion = (fromIndex = null) => {
    setIsProcessing(true);
    const idx = fromIndex ?? currentQuestionIndex;
    setTimeout(() => {
      let nextSection = idx.section;
      let nextQuestion = idx.question + 1;

      // Check if we've completed all questions in current section
      if (nextQuestion >= CONVERSATION_FLOW[nextSection].questions.length) {
        nextSection++;
        nextQuestion = 0;
      }

      // Check if we've completed all sections
      if (nextSection >= CONVERSATION_FLOW.length) {
        // Show summary before completing
        const summary = generateSummary();
        setMessages(prev => [...prev, {
          id: `summary-${Date.now()}`,
          type: 'ai',
          content: summary,
        }]);
        
        setTimeout(() => {
          handleComplete();
        }, 2000);
        return;
      }

      const nextQ = CONVERSATION_FLOW[nextSection].questions[nextQuestion];
      
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        type: 'ai',
        content: nextQ.question,
        speak: nextQ.speak,
        questionId: nextQ.id,
        questionType: nextQ.type,
        options: nextQ.options,
      }]);

      setCurrentQuestionIndex({ section: nextSection, question: nextQuestion });
      setInputValue('');
      setSelectedOptions([]);
      setIsProcessing(false);
    }, 500);
  };

  const generateSummary = () => {
    const sections = [
      formData.businessName && `Business: ${formData.businessName} (${formData.partnerCode || 'N/A'})`,
      formData.role && `Role: ${formData.role}`,
      formData.ediStandard && `EDI: ${formData.ediStandard} ${formData.version || ''}`,
      formData.documents && formData.documents.length > 0 && `Documents: ${formData.documents.join(', ')}`,
      formData.transportType && `Transport: ${formData.transportType}`,
    ].filter(Boolean);
    
    return `🎉 Perfect! Here's a summary of what we've set up:\n\n${sections.map(s => `✓ ${s}`).join('\n')}\n\n⚡ Finalizing your trading partner setup...`;
  };

  const handleSendMessage = async (e, message = inputValue) => {
    // Prevent any form submission or navigation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
    }
    
    if (!message.trim() && selectedOptions.length === 0) return;
    if (isProcessing) return;

    const answer = selectedOptions.length > 0 ? selectedOptions.join(', ') : message;
    const currentAnswer = answer.trim(); // Store before clearing
    
    if (!currentAnswer) return;
    
    // Clear input immediately
    setInputValue('');
    setSelectedOptions([]);
    
    // Use requestAnimationFrame to ensure state updates happen after preventDefault
    requestAnimationFrame(async () => {
      try {
        await handleAnswer(currentAnswer);
      } catch (error) {
        console.error('Error sending message:', error);
        toast.error('Error sending message. Please try again.');
        setIsProcessing(false);
      }
    });
  };

  const handleComplete = async () => {
    setIsProcessing(true);
    
    setMessages(prev => [...prev, {
      id: `complete-${Date.now()}`,
      type: 'ai',
      content: "⚡ Perfect! I've gathered all the information. Let me finalize the setup...\n\n🎮 Processing configuration...",
    }]);

    try {
      const finalData = {
        ...formData,
        status: formData.status || 'Draft',
        businessContact: formData.businessContact || { name: '', email: '', phone: '' },
        technicalContact: formData.technicalContact || { name: '', email: '', phone: '' },
        delimiters: formData.delimiters || { element: '*', segment: '~', subElement: '>' },
        erpContext: formData.erpContext || {
          partnerERP: { system: 'Unknown', version: '', customName: '', hasCustomizations: false, notes: '' },
          targetSystem: { system: '', integrationMethod: '', dataOwner: '' },
        },
        documents: formData.documents || [],
        mappings: formData.mappings || [],
        testResults: formData.testResults || [],
        monitoringEnabled: formData.monitoringEnabled !== undefined ? formData.monitoringEnabled : true,
      };
      
      const result = await onComplete(finalData);
      
      if (result?.success) {
        const successMsg = "Trading partner added successfully! Your partner has been saved to the database.";
        setMessages(prev => [...prev, {
          id: `success-${Date.now()}`,
          type: 'ai',
          content: `✅ ${successMsg}`,
        }]);
        if (voiceMode && 'speechSynthesis' in window) {
          const u = new SpeechSynthesisUtterance(successMsg);
          u.rate = 0.95;
          u.lang = 'en-US';
          window.speechSynthesis.speak(u);
        }
        setTimeout(() => onClose?.(), 2500);
      }
    } catch (error) {
      console.error('Error completing partner setup:', error);
      toast.error('Error saving partner. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentQuestion = CONVERSATION_FLOW[currentQuestionIndex.section]?.questions[currentQuestionIndex.question];
  const progress = ((currentQuestionIndex.section * 100 + (currentQuestionIndex.question + 1) * (100 / CONVERSATION_FLOW[currentQuestionIndex.section]?.questions.length)) / CONVERSATION_FLOW.length);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <style>{`
        [data-radix-dialog-overlay] {
          background: rgba(0, 0, 0, 0.9) !important;
          backdrop-filter: blur(4px);
          z-index: 9998 !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
        }
        [data-radix-dialog-content] {
          z-index: 9999 !important;
          position: fixed !important;
          left: 50% !important;
          top: 50% !important;
          transform: translate(-50%, -50%) !important;
          max-height: 90vh !important;
          overflow-y: auto !important;
        }
      `}</style>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 bg-gradient-to-br from-slate-900 via-blue-950 to-black border-2 border-cyan-500/30 overflow-hidden relative shadow-2xl shadow-cyan-500/20">
        {/* Animated Background */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
        
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
        
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-cyan-500/30 relative z-10 bg-black/70">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl flex items-center gap-2 font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Bot className="w-6 h-6 text-cyan-400" />
                </motion.div>
                <span className="text-cyan-400">AI</span>
                <span className="text-purple-400">PARTNER</span>
                <span className="text-pink-400">SETUP</span>
              </DialogTitle>
              <p className="text-sm text-cyan-300 mt-1 font-mono flex items-center gap-2">
                {'>'} Initializing partner configuration protocol...
                {aiStatus === 'active' && (
                  <Badge className="text-xs bg-green-500/20 border-green-500/50 text-green-300">AI Active</Badge>
                )}
                {aiStatus === 'fallback' && (
                  <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-300">AI Fallback</Badge>
                )}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="mt-4">
            <div className="relative">
              <Progress 
                value={progress} 
                className="h-3 bg-black/50 border border-cyan-500/30"
              />
              <motion.div
                className="absolute top-0 left-0 h-3 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-full"
                style={{ width: `${progress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-cyan-400 font-mono font-bold">{Math.round(progress)}% COMPLETE</span>
              <span className="text-purple-400 font-mono">SECTION {currentQuestionIndex.section + 1}/{CONVERSATION_FLOW.length}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/30 relative z-10">
          <AnimatePresence>
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'ai' && (
                  <motion.div 
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0 border-2 border-cyan-400 shadow-lg shadow-cyan-500/50"
                    animate={{ 
                      boxShadow: [
                        '0 0 10px rgba(6, 182, 212, 0.5)',
                        '0 0 20px rgba(168, 85, 247, 0.5)',
                        '0 0 10px rgba(6, 182, 212, 0.5)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Bot className="w-5 h-5 text-white" />
                  </motion.div>
                )}
                
                <motion.div 
                  className={`max-w-[80%] rounded-lg p-4 ${
                    message.type === 'user'
                      ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white border-2 border-purple-400 shadow-lg shadow-purple-500/50'
                      : 'bg-black/70 border-2 border-cyan-500/30 shadow-lg shadow-cyan-500/20'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <p className={`text-sm whitespace-pre-wrap ${
                    message.type === 'user' ? 'text-white font-medium' : 'text-cyan-100'
                  }`}>{message.content}</p>
                  
                  {/* Options for multi-select */}
                  {message.questionType === 'multi-select' && message.options && (
                    <div className="mt-3 space-y-2">
                      {message.options.map((option, optIdx) => {
                        const isSelected = selectedOptions.includes(option);
                        return (
                          <motion.button
                            key={option}
                            onClick={() => handleOptionSelect(option)}
                            whileHover={{ scale: 1.05, x: 5 }}
                            whileTap={{ scale: 0.95 }}
                            className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all font-medium ${
                              isSelected
                                ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/50'
                                : 'bg-black/40 text-cyan-300 border-cyan-500/30 hover:border-cyan-400 hover:bg-black/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-mono">{option}</span>
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 500 }}
                                >
                                  <CheckCircle2 className="w-5 h-5 text-white" />
                                </motion.div>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}

                  {/* File upload indicator */}
                  {message.file && (
                    <motion.div 
                      className="mt-2 flex items-center gap-2 text-xs text-cyan-300"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <FileText className="w-3 h-3" />
                      {message.file}
                    </motion.div>
                  )}
                </motion.div>

                {message.type === 'user' && (
                  <motion.div 
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 border-2 border-purple-400 shadow-lg shadow-purple-500/50"
                    animate={{ 
                      boxShadow: [
                        '0 0 10px rgba(168, 85, 247, 0.5)',
                        '0 0 20px rgba(236, 72, 153, 0.5)',
                        '0 0 10px rgba(168, 85, 247, 0.5)'
                      ]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <User className="w-5 h-5 text-white" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isProcessing && (
            <motion.div 
              className="flex gap-3 justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center border-2 border-cyan-400 shadow-lg shadow-cyan-500/50">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-black/70 border-2 border-cyan-500/30 rounded-lg p-4">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Uploaded Files Summary - hidden in voice-only mode */}
        {!voiceMode && uploadedFiles.length > 0 && (
          <motion.div 
            className="px-6 py-3 border-t border-cyan-500/30 bg-black/70 relative z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-cyan-400 font-mono font-bold">EXTRACTED FROM:</span>
              {uploadedFiles.map((file, idx) => (
                <Badge 
                  key={idx} 
                  className="text-xs bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/50 text-green-300 font-mono"
                >
                  <FileText className="w-3 h-3 mr-1" />
                  {file.name}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        {/* Input Area */}
        <div 
          className="px-6 py-6 border-t border-cyan-500/30 bg-black/70 relative z-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {voiceMode ? (
            /* Voice-only layout: large centered mic button */
            <div className="flex flex-col items-center justify-center gap-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex flex-col items-center gap-3"
              >
                <Button
                  type="button"
                  onClick={isListening ? stopListening : (voiceMode ? startAutoListening : startListening)}
                  disabled={isProcessing}
                  className={`h-24 w-24 rounded-full ${
                    isListening 
                      ? 'bg-red-600/40 border-4 border-red-500 text-red-400 animate-pulse shadow-lg shadow-red-500/50' 
                      : 'bg-purple-600/30 border-4 border-purple-500/70 text-purple-300 hover:bg-purple-600/40 hover:border-purple-400 shadow-lg shadow-purple-500/30'
                  }`}
                  title={isListening ? 'Stop Recording' : 'Tap to speak'}
                >
                  {isListening ? (
                    <MicOff className="w-12 h-12" />
                  ) : (
                    <Mic className="w-12 h-12" />
                  )}
                </Button>
                <span className="text-sm font-medium text-cyan-300/90">
                  {isListening ? 'Listening... Speak now' : 'Tap to speak your answer'}
                </span>
              </motion.div>
              {selectedOptions.length > 0 && currentQuestion?.multiple && (
                <motion.div 
                  className="flex items-center gap-2 flex-wrap justify-center"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <span className="text-xs text-cyan-400 font-mono font-bold">SELECTED:</span>
                  {selectedOptions.map((option, idx) => (
                    <Badge key={idx} className="text-xs bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 font-mono">
                      {option}
                    </Badge>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    onClick={(e) => handleSendMessage(e)}
                    className="text-xs h-8 bg-green-600/80 hover:bg-green-500/80 text-white border border-green-400 font-mono"
                  >
                    Confirm
                  </Button>
                </motion.div>
              )}
            </div>
          ) : (
            /* Input mode: upload, text input, send */
            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xlsx,.xls,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    type="button"
                    size="icon"
                    className="flex-shrink-0 bg-green-600/20 border-2 border-green-500/50 text-green-400 hover:bg-green-600/30 hover:border-green-400"
                    title="Upload Document"
                  >
                    <Upload className="w-4 h-4" />
                  </Button>
                </motion.div>
              </label>
              <Input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation?.();
                    handleSendMessage(e);
                    return false;
                  }
                }}
                placeholder={
                  currentQuestion?.type === 'multi-select' && currentQuestion.multiple
                    ? 'Select options above or type your answer...'
                    : currentQuestion?.placeholder || 'Type your answer...'
                }
                disabled={isProcessing || (currentQuestion?.type === 'multi-select' && !currentQuestion.multiple)}
                className="flex-1 bg-black/60 border-2 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-500/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/50 font-mono"
              />
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                <Button
                  type="button"
                  onClick={(e) => handleSendMessage(e)}
                  disabled={
                    isProcessing ||
                    (!inputValue.trim() && selectedOptions.length === 0) ||
                    (currentQuestion?.type === 'multi-select' && !currentQuestion.multiple && selectedOptions.length === 0)
                  }
                  className="flex-shrink-0 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white border-2 border-cyan-400 shadow-lg shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>
          )}

          {/* Selected Options Display - input mode only */}
          {!voiceMode && selectedOptions.length > 0 && currentQuestion?.multiple && (
            <motion.div 
              className="mt-2 flex items-center gap-2 flex-wrap"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-xs text-cyan-400 font-mono font-bold">SELECTED:</span>
              {selectedOptions.map((option, idx) => (
                <motion.div
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                >
                  <Badge className="text-xs bg-gradient-to-r from-cyan-500/30 to-purple-500/30 border-2 border-cyan-400/50 text-cyan-300 font-mono">
                    {option}
                    <button
                      onClick={() => setSelectedOptions(prev => prev.filter((_, i) => i !== idx))}
                      className="ml-2 hover:text-red-400 transition-colors"
                    >
                      ×
                    </button>
                  </Badge>
                </motion.div>
              ))}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  size="sm"
                  onClick={(e) => handleSendMessage(e)}
                  className="text-xs h-7 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white border-2 border-green-400 shadow-lg shadow-green-500/50 font-mono font-bold"
                >
                  CONFIRM
                </Button>
              </motion.div>
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
