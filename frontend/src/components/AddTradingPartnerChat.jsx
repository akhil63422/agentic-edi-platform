import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Mic, MicOff, Upload, FileText, Bot, User, CheckCircle2, Loader2, Zap, Sparkles, Pencil, Check } from 'lucide-react';
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

// Preferred female voice names (varies by OS/browser)
const FEMALE_VOICE_NAMES = [
  'Samantha', 'Victoria', 'Karen', 'Kate', 'Fiona', 'Tessa', 'Moira', 'Emma',
  'Microsoft Zira', 'Microsoft Aria', 'Google US English', 'Samantha (Premium)',
  'Sara', 'Allison', 'Susan', 'Ellen', 'Karen (Enhanced)', 'Ava',
];

const getFemaleVoice = () => {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const enVoices = voices.filter((v) => v.lang.startsWith('en'));
  const preferred = enVoices.find((v) =>
    FEMALE_VOICE_NAMES.some((n) => v.name.toLowerCase().includes(n.toLowerCase()))
  );
  if (preferred) return preferred;
  const femaleLike = enVoices.find((v) =>
    /samantha|victoria|karen|kate|fiona|zira|aria|sara|emma|susan|ellen|ava|allison|moira|tessa/i.test(v.name)
  );
  return femaleLike || enVoices[0] || voices[0];
};

let currentTTSAudio = null;

const stopAllVoice = () => {
  window.speechSynthesis?.cancel();
  if (currentTTSAudio) {
    try {
      currentTTSAudio.pause();
      currentTTSAudio.currentTime = 0;
    } catch (_) {}
    currentTTSAudio = null;
  }
};

const speakWithFemaleVoice = async (text, onEnd) => {
  if (!text?.trim()) return;
  stopAllVoice();
  try {
    const blob = await partnerAIService.getTTSAudio(text);
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentTTSAudio = audio;
    audio.onended = () => {
      currentTTSAudio = null;
      URL.revokeObjectURL(url);
      onEnd?.();
    };
    audio.onerror = () => {
      currentTTSAudio = null;
      URL.revokeObjectURL(url);
      fallbackSpeak(text, onEnd);
    };
    await audio.play();
  } catch {
    fallbackSpeak(text, onEnd);
  }
};

const fallbackSpeak = (text, onEnd) => {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = getFemaleVoice();
  if (voice) u.voice = voice;
  u.rate = 0.92;
  u.pitch = 1.1;
  u.lang = 'en-US';
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
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

// --- Field validation (blocks workflow until valid) ---
const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;

const validateField = (questionId, answer, formData, question) => {
  const val = String(answer || '').trim();
  const opts = question?.options || [];

  if (question?.required && !val) {
    return { valid: false, error: 'This field is required.', speak: "Sorry, this field is required. Please give me a valid answer." };
  }
  if (!question?.required && !val) return { valid: true };

  switch (questionId) {
    case 'businessName':
      if (val.length < 2) return { valid: false, error: 'Business name must be at least 2 characters.', speak: "That's too short. Please give me the full business name." };
      if (val.length > 200) return { valid: false, error: 'Business name is too long.', speak: "That's too long. Please give me a shorter business name." };
      return { valid: true };

    case 'partnerCode': {
      const code = normalizePartnerCode(val) || val.replace(/\s/g, '').slice(0, 10).toUpperCase();
      if (!code || code.length < 1) return { valid: false, error: 'Partner code required.', speak: "I couldn't understand the partner code. Please say or type it again." };
      if (code.length !== 10) return { valid: false, error: 'Partner code must be exactly 10 characters.', speak: "Partner code must be exactly 10 characters. Please provide a 10-character code." };
      if (!/^[A-Za-z0-9]+$/.test(code)) return { valid: false, error: 'Partner code must be alphanumeric.', speak: "Partner code should only contain letters and numbers. Please try again." };
      return { valid: true };
    }

    case 'role':
    case 'ediStandard':
    case 'version':
    case 'transportType':
    case 'timezone': {
      const matched = matchVoiceToOptions(val, opts);
      if (!matched) return { valid: false, error: `Choose one of: ${opts.join(', ')}`, speak: `Sorry, I didn't recognize that. Please select one of the options: ${opts.slice(0, 3).join(', ')}.` };
      return { valid: true };
    }

    case 'industry':
      if (!val) return { valid: true };
      if (!matchVoiceToOptions(val, opts)) return { valid: false, error: `Choose one of: ${opts.join(', ')}`, speak: `Please select one of the options: ${opts.slice(0, 3).join(', ')}.` };
      return { valid: true };

    case 'country':
      if (val.length > 100) return { valid: false, error: 'Country name too long.', speak: "That's too long. Please give me a shorter country name." };
      return { valid: true };

    case 'businessContactEmail':
    case 'technicalContactEmail': {
      const email = normalizeEmailForVoice(val) || val;
      if (!email) return { valid: true };
      if (!EMAIL_REGEX.test(email)) return { valid: false, error: 'Invalid email.', speak: "That doesn't look like a valid email. Please say or type it again, like: example at company dot com." };
      return { valid: true };
    }

    case 'businessContactPhone':
    case 'technicalContactPhone': {
      const digits = (normalizePhoneForVoice(val) || val).replace(/\D/g, '');
      if (!digits) return { valid: true };
      if (digits.length < PHONE_MIN_DIGITS) return { valid: false, error: 'Phone needs at least 10 digits.', speak: "That phone number seems too short. Please say or type it again with at least 10 digits." };
      if (digits.length > PHONE_MAX_DIGITS) return { valid: false, error: 'Phone must be 10–15 digits.', speak: "That phone number is too long. Please provide 10 to 15 digits." };
      return { valid: true };
    }

    case 'businessContactName':
    case 'technicalContactName': {
      const invalidNamePhrases = ['now for the', 'what is', "what's", 'and their', 'their name', 'their email', 'their phone', 'the technical', 'the business', 'contact name', 'contact email', 'contact phone'];
      const valLower = val.toLowerCase();
      if (val.length > 100) return { valid: false, error: 'Name too long.', speak: "That name is too long. Please try again." };
      if (invalidNamePhrases.some((p) => valLower.includes(p) || valLower === p)) return { valid: false, error: "That doesn't look like a name.", speak: "That doesn't sound like a name. Please say or type the contact's name." };
      return { valid: true };
    }

    case 'isaSenderId':
    case 'isaReceiverId': {
      const words = String(val).trim().toLowerCase().split(/\s+/).filter(Boolean);
      const hasInvalidWord = words.some((w) => !DIGIT_WORDS[w] && !/^\d+$/.test(w));
      const digitsOnly = words.map((w) => DIGIT_WORDS[w] ?? w.replace(/\D/g, '')).join('');
      if (val.length < 1) return { valid: false, error: 'Required.', speak: "That's required. Please provide the ISA ID." };
      if (hasInvalidWord || digitsOnly.length === 0) return { valid: false, error: 'ISA ID must be numbers only. No letters or text allowed.', speak: "That's invalid. ISA ID must contain only numbers. No letters or text. Please provide a numeric ID." };
      if (digitsOnly.length > 15) return { valid: false, error: 'ISA ID max 15 digits.', speak: "That's too long. ISA ID must be 15 digits or less." };
      return { valid: true };
    }

    case 'documents': {
      const parts = val.split(/,\s*/).map((s) => s.trim()).filter(Boolean);
      const matched = parts.flatMap((p) => {
        const m = matchVoiceToOptions(p, opts);
        return m ? (Array.isArray(m) ? m : [m]) : [];
      });
      const unique = [...new Set(matched)];
      if (unique.length === 0) return { valid: false, error: 'Select at least one document type.', speak: "Please select at least one document type from the options below." };
      return { valid: true };
    }

    default:
      return { valid: true };
  }
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
        question: '✨ Great! Now, what trading partner code would you like to use? This must be exactly 10 characters (letters and numbers).',
        speak: "Great! What trading partner code would you like to use? It must be exactly 10 characters. You can type it or say it.",
        type: 'text',
        required: true,
        placeholder: 'e.g., WMT1234567 (10 chars)',
        maxLength: 10,
      },
      {
        id: 'role',
        question: 'What role does this partner play? Are they a Customer, Supplier, or Both?',
        speak: "What role does this partner play? Are they a Customer, Supplier, or Both? You can select one of the options below, or say your answer.",
        type: 'multi-select',
        options: ['Customer', 'Supplier', 'Both'],
        required: true,
      },
      {
        id: 'industry',
        question: 'What industry are they in?',
        speak: "What industry are they in? You can select an option or tell me.",
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
        speak: "What timezone are they in? Select one below or say it.",
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
        speak: "Moving on to EDI configuration. What EDI standard do they use? You can select X12, EDIFACT, or TRADACOMS.",
        type: 'multi-select',
        options: ['X12', 'EDIFACT', 'TRADACOMS'],
        required: true,
      },
      {
        id: 'version',
        question: 'What version?',
        speak: "What version? Select 5010, 4010, or 3060.",
        type: 'multi-select',
        options: ['5010', '4010', '3060'],
        required: true,
      },
      {
        id: 'isaSenderId',
        question: 'What is the ISA Sender ID? (Numbers only)',
        speak: "What is the ISA Sender ID? Numbers only, no letters.",
        type: 'text',
        required: true,
        placeholder: 'e.g., 1234567890',
      },
      {
        id: 'isaReceiverId',
        question: 'What is the ISA Receiver ID? (Numbers only)',
        speak: "What is the ISA Receiver ID? Numbers only, no letters.",
        type: 'text',
        required: true,
        placeholder: 'e.g., 0090123456',
      },
    ],
  },
  {
    section: 'documents',
    questions: [
      {
        id: 'documents',
        question: 'What document types will you exchange? You can select multiple.',
        speak: "What document types will you exchange? You can select multiple options below, or say them. For example, 850 and 810.",
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
        speak: "How will files be transferred? Select SFTP, S3, FTP, or AS2.",
        type: 'multi-select',
        options: ['SFTP', 'S3', 'FTP', 'AS2'],
        required: true,
      },
    ],
  },
];

// Map question ID -> { section, question } for edit navigation
const getQuestionIndexById = (id) => {
  for (let s = 0; s < CONVERSATION_FLOW.length; s++) {
    const qs = CONVERSATION_FLOW[s].questions;
    for (let q = 0; q < qs.length; q++) {
      if (qs[q].id === id) return { section: s, question: q };
    }
  }
  return null;
};

// Review fields config: id, label, getValue from formData
const REVIEW_FIELDS = [
  { id: 'businessName', label: 'Business Name', getValue: (fd) => fd.businessName },
  { id: 'partnerCode', label: 'Partner Code', getValue: (fd) => fd.partnerCode },
  { id: 'role', label: 'Role', getValue: (fd) => fd.role },
  { id: 'industry', label: 'Industry', getValue: (fd) => fd.industry },
  { id: 'country', label: 'Country', getValue: (fd) => fd.country },
  { id: 'timezone', label: 'Timezone', getValue: (fd) => fd.timezone },
  { id: 'businessContactName', label: 'Business Contact Name', getValue: (fd) => fd.businessContact?.name },
  { id: 'businessContactEmail', label: 'Business Contact Email', getValue: (fd) => fd.businessContact?.email },
  { id: 'businessContactPhone', label: 'Business Contact Phone', getValue: (fd) => fd.businessContact?.phone },
  { id: 'technicalContactName', label: 'Technical Contact Name', getValue: (fd) => fd.technicalContact?.name },
  { id: 'technicalContactEmail', label: 'Technical Contact Email', getValue: (fd) => fd.technicalContact?.email },
  { id: 'technicalContactPhone', label: 'Technical Contact Phone', getValue: (fd) => fd.technicalContact?.phone },
  { id: 'ediStandard', label: 'EDI Standard', getValue: (fd) => fd.ediStandard },
  { id: 'version', label: 'Version', getValue: (fd) => fd.version },
  { id: 'isaSenderId', label: 'ISA Sender ID', getValue: (fd) => fd.isaSenderId },
  { id: 'isaReceiverId', label: 'ISA Receiver ID', getValue: (fd) => fd.isaReceiverId },
  { id: 'documents', label: 'Documents', getValue: (fd) => Array.isArray(fd.documents) ? fd.documents.join(', ') : fd.documents },
  { id: 'transportType', label: 'Transport', getValue: (fd) => fd.transportType },
];

export const AddTradingPartnerChat = ({ open, onClose, onComplete }) => {
  const [messages, setMessages] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState({ section: 0, question: 0 });
  const [inputValue, setInputValue] = useState('');
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [formData, setFormData] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [aiStatus, setAiStatus] = useState('checking'); // 'active' | 'fallback' | 'checking'
  const [reviewMode, setReviewMode] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const formDataRef = useRef(formData);
  const currentQuestionIndexRef = useRef(currentQuestionIndex);
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

  // Load TTS voices when dialog opens (Chrome loads voices async)
  useEffect(() => {
    if (open && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
    }
  }, [open]);

  // Initialize conversation when dialog opens
  useEffect(() => {
    if (open) {
      setReviewMode(false);
      if (messages.length === 0) {
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
    }
  }, [open]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-start listening when TTS ends
  const startAutoListening = useCallback(() => {
    if (!recognitionRef.current) return;
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
  }, []);

  const startAutoListeningRef = useRef(startAutoListening);
  startAutoListeningRef.current = startAutoListening;

  // Voice output (TTS): speak the question, then auto-start listening when done (skip auto-listen for select-only questions)
  useEffect(() => {
    if (!open || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last?.type !== 'ai' || !last.questionId || !last.content) return;
    if (last.id?.startsWith('summary-') || last.id?.startsWith('complete-')) return;
    const speakable = last.speak ? last.speak : toSpeakableText(last.content);
    if (!speakable) return;
    const isSelectOnly = last.options && last.options.length > 0;
    speakWithFemaleVoice(speakable, () => {
      if (!isSelectOnly) setTimeout(() => startAutoListeningRef.current?.(), 400);
    });
    return () => window.speechSynthesis?.cancel();
  }, [messages, open]);

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
          setInputValue(answerText);
          const display = answerText.slice(0, 50) + (answerText.length > 50 ? '...' : '');
          toast.info(`Heard: "${display}". Edit if needed, then click Send.`, {
            duration: 5000,
            action: { label: 'Send now', onClick: () => handleSendMessage(null, answerText) },
          });
        }
        setIsListening(false);
      };
      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const startListening = async () => {
    if (isListening) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
        toast.info('Transcribing...', { duration: 2000 });
        try {
          const idx = currentQuestionIndexRef.current;
          const q = CONVERSATION_FLOW[idx?.section]?.questions[idx?.question];
          const result = await partnerAIService.processVoice(blob, { current_question: q?.id });
          if (result?.success && result?.text?.trim()) {
            setIsListening(false);
            let answerText = result.text.trim();
            if (q?.id === 'partnerCode') answerText = normalizePartnerCode(answerText) || answerText;
            else if (/Email|email/i.test(q?.id || '')) answerText = normalizeEmailForVoice(answerText) || answerText;
            else if (/Phone|phone/i.test(q?.id || '')) answerText = normalizePhoneForVoice(answerText) || answerText;
            else if (q?.options?.length) {
              const matched = matchVoiceToOptions(answerText, q.options);
              answerText = Array.isArray(matched) ? matched.join(', ') : (matched || answerText);
            }
            setInputValue(answerText);
            const display = answerText.slice(0, 50) + (answerText.length > 50 ? '...' : '');
            toast.info(`Heard: "${display}". Edit if needed, then click Send.`, {
              duration: 5000,
              action: { label: 'Send now', onClick: () => handleSendMessage(null, answerText) },
            });
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
    if (isProcessing) return;
    stopAllVoice();
    const idx = overrideIndex ?? currentQuestionIndex;
    const currentSection = CONVERSATION_FLOW[idx.section];
    const currentQuestion = currentSection?.questions[idx.question];
    
    if (!currentQuestion) return;
    
    // Validate before accepting - block workflow on failure
    const validation = validateField(currentQuestion.id, answer, formDataRef.current, currentQuestion);
    if (!validation.valid) {
      const errorContent = `❌ ${validation.error}\n\nPlease try again.`;
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'ai',
        content: errorContent,
        speak: validation.speak,
        questionId: currentQuestion.id,
        questionType: currentQuestion.type,
        options: currentQuestion.options,
      }]);
      return;
    }
    
    // Add user message
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
    } else if (currentQuestion.id === 'isaSenderId' || currentQuestion.id === 'isaReceiverId') {
      const words = String(answer).trim().toLowerCase().split(/\s+/).filter(Boolean);
      updates[currentQuestion.id] = words.map((w) => DIGIT_WORDS[w] ?? w.replace(/\D/g, '')).join('');
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

    // If editing from review, return to review step instead of continuing
    if (editingFromReview) {
      setEditingFromReview(false);
      setReviewMode(true);
      setIsProcessing(false);
      return;
    }
    moveToNextQuestion(idx);
  };

  const moveToNextQuestion = (fromIndex = null) => {
    setIsProcessing(true);
    const idx = fromIndex ?? currentQuestionIndex;
    const delayMs = 2000;
    setTimeout(() => {
      let nextSection = idx.section;
      let nextQuestion = idx.question + 1;

      // Check if we've completed all questions in current section
      if (nextQuestion >= CONVERSATION_FLOW[nextSection].questions.length) {
        nextSection++;
        nextQuestion = 0;
      }

      // Check if we've completed all sections -> go to Review & Edit step
      if (nextSection >= CONVERSATION_FLOW.length) {
        const summary = generateSummary();
        setMessages(prev => [...prev, {
          id: `summary-${Date.now()}`,
          type: 'ai',
          content: summary.replace('Finalizing your trading partner setup...', 'Please review your answers below. You can edit any field before submitting.'),
        }]);
        setTimeout(() => {
          setReviewMode(true);
          setIsProcessing(false);
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
    }, delayMs);
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

  const handleEditField = (fieldId) => {
    const idx = getQuestionIndexById(fieldId);
    if (!idx) return;
    stopAllVoice();
    setReviewMode(false);
    setEditingFromReview(true);
    setCurrentQuestionIndex(idx);
    const q = CONVERSATION_FLOW[idx.section].questions[idx.question];
    setMessages(prev => [...prev, {
      id: `edit-${Date.now()}`,
      type: 'ai',
      content: `Let's update ${REVIEW_FIELDS.find((f) => f.id === fieldId)?.label || fieldId}.\n\n${q.question}`,
      speak: `Let's update ${REVIEW_FIELDS.find((f) => f.id === fieldId)?.label || fieldId}. ${q.speak || q.question}`,
      questionId: q.id,
      questionType: q.type,
      options: q.options,
    }]);
    setInputValue('');
    setSelectedOptions([]);
  };

  const handleComplete = async () => {
    setIsProcessing(true);
    stopAllVoice();
    
    setMessages(prev => [...prev, {
      id: `complete-${Date.now()}`,
      type: 'ai',
      content: "Perfect! I've got everything I need. Let me save your partner to the database...",
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
        stopAllVoice();
        onClose?.();
      }
    } catch (error) {
      console.error('Error completing partner setup:', error);
      toast.error('Error saving partner. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentQuestion = CONVERSATION_FLOW[currentQuestionIndex.section]?.questions[currentQuestionIndex.question];
  const progress = reviewMode ? 100 : ((currentQuestionIndex.section * 100 + (currentQuestionIndex.question + 1) * (100 / CONVERSATION_FLOW[currentQuestionIndex.section]?.questions.length)) / CONVERSATION_FLOW.length);

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) stopAllVoice(); onClose?.(); }}>
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
              <span className="text-purple-400 font-mono">{reviewMode ? 'REVIEW & EDIT' : `SECTION ${currentQuestionIndex.section + 1}/${CONVERSATION_FLOW.length}`}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Chat Messages or Review & Edit */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-black/30 relative z-10">
          {reviewMode ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <p className="text-cyan-200 font-mono text-sm mb-4">
                Review your answers. Voice input can sometimes capture incorrect values. Click Edit to correct any field.
              </p>
              <div className="grid gap-3">
                {REVIEW_FIELDS.map(({ id, label, getValue }) => {
                  const val = getValue(formData);
                  const display = val != null && val !== '' ? String(val) : '—';
                  return (
                    <motion.div
                      key={id}
                      className="flex items-center justify-between gap-4 p-4 rounded-lg bg-black/50 border border-cyan-500/30 hover:border-cyan-400/50 transition-colors"
                      whileHover={{ scale: 1.01 }}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-cyan-400 font-mono text-xs block mb-1">{label}</span>
                        <span className="text-cyan-100 text-sm truncate block">{display}</span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditField(id)}
                        className="flex-shrink-0 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400"
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="border-cyan-500/50 text-cyan-300"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={() => handleComplete()}
                  className="bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white border-2 border-cyan-400"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Submit Partner
                </Button>
              </div>
            </motion.div>
          ) : (
          <>
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
          </>
          )}
        </div>

        {/* Uploaded Files Summary */}
        {uploadedFiles.length > 0 && (
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

        {/* Input Area - voice + keyboard combined (hidden in review mode) */}
        {!reviewMode && (
        <div 
          className="px-6 py-4 border-t border-cyan-500/30 bg-black/70 relative z-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
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
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                type="button"
                size="icon"
                onClick={isListening ? stopListening : startAutoListening}
                disabled={isProcessing || (currentQuestion?.options?.length > 0)}
                className={`flex-shrink-0 ${
                  isListening 
                    ? 'bg-red-600/30 border-2 border-red-500 text-red-400 animate-pulse' 
                    : 'bg-purple-600/20 border-2 border-purple-500/50 text-purple-400 hover:bg-purple-600/30 hover:border-purple-400'
                }`}
                title={currentQuestion?.options?.length > 0 ? 'Select an option above' : (isListening ? 'Stop' : 'Voice input')}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>
            </motion.div>
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
                currentQuestion?.options?.length > 0
                  ? 'Select an option above (voice disabled for this question)'
                  : currentQuestion?.placeholder || 'Type or speak your answer...'
              }
              disabled={isProcessing || (currentQuestion?.options?.length > 0)}
              className="flex-1 bg-black/60 border-2 border-cyan-500/30 text-cyan-100 placeholder:text-cyan-500/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/50 font-mono"
            />
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <Button
                type="button"
                onClick={(e) => handleSendMessage(e)}
                disabled={
                  isProcessing ||
                  (currentQuestion?.options?.length > 0 ? selectedOptions.length === 0 : !inputValue.trim() && selectedOptions.length === 0)
                }
                className="flex-shrink-0 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white border-2 border-cyan-400 shadow-lg shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>

          {/* Selected Options Display */}
          {selectedOptions.length > 0 && currentQuestion?.multiple && (
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
        )}
      </DialogContent>
    </Dialog>
  );
};
