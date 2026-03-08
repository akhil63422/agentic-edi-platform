import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X, CheckCircle2, AlertTriangle, Zap, Shield, Cpu,
  Radio, CloudUpload, ClipboardList, ArrowDownToLine,
} from 'lucide-react';
import { documentsService } from '@/services/documents';

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline step definitions
// ─────────────────────────────────────────────────────────────────────────────
// Inbound pipeline: 5 steps only (Receive → Detect → Parse → ACK → Transform → Ready for Dispatch)
const STEPS = [
  { num: 1,  key: 'receive',    label: 'RECEIVE',        short: 'RCV', icon: CloudUpload, color: '#f87171', glow: '#f87171' },
  { num: 2,  key: 'detect',     label: 'DETECT STD',     short: 'DET', icon: Radio,       color: '#fb923c', glow: '#fb923c' },
  { num: 3,  key: 'parse',      label: 'PARSE+VALIDATE', short: 'PRS', icon: Shield,      color: '#facc15', glow: '#facc15' },
  { num: 4,  key: 'ack',        label: 'SEND ACK',       short: 'ACK', icon: Zap,         color: '#4ade80', glow: '#4ade80' },
  { num: 5,  key: 'transform',  label: 'TRANSFORM',      short: 'XFM', icon: Cpu,         color: '#2dd4bf', glow: '#2dd4bf' },
];

const TERMINAL = ['Ready for Dispatch', 'Completed', 'Needs Review', 'Failed', 'Duplicate'];
const ROW1 = STEPS; // All 5 steps in single row

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getStepStatus(stepNum, currentStep, finalStatus) {
  if (finalStatus === 'Failed' && stepNum === currentStep) return 'error';
  if (finalStatus === 'Duplicate' && stepNum === 1) return 'duplicate';
  if (stepNum < currentStep) return 'done';
  if (stepNum === currentStep) return TERMINAL.includes(finalStatus) ? 'done' : 'active';
  return 'idle';
}

// Floating particle component (travels along pipe)
const Particle = ({ delay = 0, row = 0 }) => (
  <motion.div
    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_3px_rgba(34,211,238,0.8)]"
    style={{ left: '-8px' }}
    animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
    transition={{ duration: 2.4, delay, repeat: Infinity, ease: 'linear' }}
  />
);

// Animated connecting line with flowing particles
const PipeLine = ({ active, done }) => (
  <div className="relative flex-1 mx-1 h-[2px] overflow-visible">
    <div className={`absolute inset-0 rounded-full transition-colors duration-500
      ${done ? 'bg-green-500/70' : active ? 'bg-cyan-500/50 animate-pulse' : 'bg-slate-700/60'}`}
    />
    {(active || done) && (
      <>
        <Particle delay={0} />
        <Particle delay={0.8} />
        <Particle delay={1.6} />
      </>
    )}
  </div>
);

// Individual step node
const StepNode = ({ step, status }) => {
  const Icon = step.icon;
  const isDone      = status === 'done';
  const isActive    = status === 'active';
  const isError     = status === 'error';
  const isDuplicate = status === 'duplicate';
  const isIdle      = status === 'idle';

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      {/* Hex node */}
      <div className="relative">
        {/* Outer glow pulse for active */}
        {isActive && (
          <motion.div
            className="absolute -inset-2 rounded-xl"
            style={{ boxShadow: `0 0 20px 6px ${step.glow}66` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
        {/* Done ripple */}
        {isDone && (
          <motion.div
            className="absolute -inset-1 rounded-xl border"
            style={{ borderColor: step.color + '44' }}
            initial={{ scale: 0.8, opacity: 1 }}
            animate={{ scale: 1.4, opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}

        <motion.div
          initial={false}
          animate={{
            backgroundColor: isDone
              ? '#052e16'
              : isActive
              ? '#0c1a2e'
              : isError || isDuplicate
              ? '#2d0a0a'
              : '#0f172a',
            borderColor: isDone
              ? step.color
              : isActive
              ? step.color
              : isError || isDuplicate
              ? '#ef4444'
              : '#1e293b',
            boxShadow: isDone
              ? `0 0 12px 2px ${step.color}55`
              : isActive
              ? `0 0 18px 4px ${step.color}77`
              : 'none',
          }}
          className="w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all duration-500 relative z-10"
        >
          {isDone && <CheckCircle2 className="w-5 h-5" style={{ color: step.color }} />}
          {isActive && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            >
              <Icon className="w-5 h-5" style={{ color: step.color }} />
            </motion.div>
          )}
          {(isError || isDuplicate) && <AlertTriangle className="w-5 h-5 text-red-400" />}
          {isIdle && <Icon className="w-4 h-4 text-slate-600" />}
        </motion.div>
      </div>

      {/* Step number badge */}
      <div className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded
        ${isDone ? 'text-green-400 bg-green-500/10' : isActive ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-600 bg-slate-800/50'}`}
        style={isDone ? { color: step.color } : {}}
      >
        {step.short}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────
export const ProcessingModal = ({ documentId, fileName, onClose }) => {
  const navigate          = useNavigate();
  const [doc, setDoc]     = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs]   = useState(['[INIT] Pipeline boot sequence started...']);
  const intervalRef       = useRef(null);
  const logRef            = useRef(null);
  const prevStep          = useRef(0);

  // Fake realtime log lines per step
  const STEP_LOGS = {
    1:  '[RECV] File received · dedup hash computed · queued for processing',
    2:  '[SCAN] Probing envelope headers · detecting ISA/UNB markers...',
    3:  '[PARSE] Splitting segments · running 47 validation rules...',
    4:  '[ACK]  Generating 997 Functional Acknowledgement...',
    5:  '[XFRM] Mapping segments → canonical JSON model...',
    6:  '[ROUTE] Evaluating 12 routing rules · selecting target...',
    7:  '[ERP]  Connecting to ERP endpoint · posting canonical payload...',
    8:  '[REPLY] Generating outbound reply document via template...',
    9:  '[DLVR] Staging outbound delivery queue...',
    10: '[LOG]  Writing audit trail · running anomaly detection...',
  };

  useEffect(() => {
    if (!documentId) return;

    const poll = async () => {
      try {
        const data = await documentsService.getById(documentId, true);
        setDoc(data);

        const step = data?.processing_step ?? 1;
        if (step !== prevStep.current) {
          prevStep.current = step;
          const line = STEP_LOGS[step];
          if (line) {
            setLogs(prev => [...prev.slice(-20), line]);
            setTimeout(() => logRef.current?.scrollTo({ top: 9999, behavior: 'smooth' }), 50);
          }
        }

        if (TERMINAL.includes(data?.status)) {
          clearInterval(intervalRef.current);
          const aiFixed = (data?.metadata?.ai_fixed_errors || []).length;
          const finalLine = data.status === 'Ready for Dispatch' || data.status === 'Completed'
            ? aiFixed
              ? '[DONE] ✓ File corrected using AI — ready for dispatch.'
              : '[DONE] ✓ Inbound complete — ready for dispatch. Go to Inbound.'
            : data.status === 'Needs Review'
            ? '[DONE] ✓ File corrected using AI — ready for dispatch.'
            : data.status === 'Duplicate'
            ? '[SKIP] Duplicate document detected — pipeline halted.'
            : '[ERR]  Pipeline failed — see validation report.';
          setLogs(prev => [...prev, finalLine]);
        }
      } catch {
        setError('Connection lost to processing engine.');
        clearInterval(intervalRef.current);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 1500);
    return () => clearInterval(intervalRef.current);
  }, [documentId]);

  const currentStep = doc?.processing_step ?? 1;
  const finalStatus = doc?.status;
  const isDone      = TERMINAL.includes(finalStatus);
  const progress    = Math.min(Math.round((currentStep / 5) * 100), 100);

  const confidence  = doc?.ai_confidence_score ?? 0;
  const ackSent     = doc?.acknowledgment_sent;
  const erpPosted   = doc?.erp_posted;
  const replyId     = doc?.metadata?.reply_document_id;
  const segments    = (doc?.parsed_segments ?? []).length;
  const valErrors   = (doc?.validation_results ?? []).filter(v => v.type === 'error' || v.severity === 'High' || v.severity === 'Critical').length;
  const anomaly     = doc?.metadata?.is_anomaly;

  const statusColor = finalStatus === 'Ready for Dispatch' || finalStatus === 'Completed' ? '#4ade80'
    : finalStatus === 'Needs Review' ? '#facc15'
    : finalStatus === 'Failed' || finalStatus === 'Duplicate' ? '#f87171'
    : '#22d3ee';

  const aiFixedCount = (doc?.metadata?.ai_fixed_errors || []).length;
  const statusLabel = finalStatus === 'Ready for Dispatch' || finalStatus === 'Completed' || finalStatus === 'Needs Review'
    ? (aiFixedCount ? 'FILE CORRECTED' : 'READY FOR DISPATCH')
    : finalStatus === 'Failed' ? 'PIPELINE FAILED'
    : finalStatus === 'Duplicate' ? 'DUPLICATE DETECTED'
    : `PROCESSING — STEP ${currentStep}/5`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
          onClick={isDone ? onClose : undefined}
        />

        {/* Main panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 24 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="relative z-10 w-full max-w-3xl overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #020817 0%, #0a0f1e 50%, #020817 100%)',
            border: `1px solid ${statusColor}33`,
            boxShadow: `0 0 60px ${statusColor}22, 0 0 120px ${statusColor}11, inset 0 1px 0 ${statusColor}22`,
          }}
        >
          {/* Scanline overlay */}
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)',
            }}
          />

          {/* Corner brackets */}
          {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
            'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl'
          ].map((cls, i) => (
            <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: statusColor + '88' }} />
          ))}

          {/* ── Header ── */}
          <div className="relative z-10 px-6 pt-5 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                {/* Status badge */}
                <motion.div
                  animate={{ opacity: isDone ? 1 : [1, 0.5, 1] }}
                  transition={{ duration: 1.2, repeat: isDone ? 0 : Infinity }}
                  className="inline-flex items-center gap-2 mb-2"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                  <span className="text-xs font-black font-mono tracking-widest" style={{ color: statusColor }}>
                    {statusLabel}
                  </span>
                </motion.div>
                <h2 className="text-xl font-black font-mono text-white tracking-tight">EDI PIPELINE</h2>
                <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-sm">{fileName || documentId}</p>
              </div>

              <div className="flex flex-col items-end gap-2">
                {isDone && (
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
                {/* Progress ring-ish number */}
                <div className="text-right">
                  <div className="text-3xl font-black font-mono" style={{ color: statusColor }}>{progress}%</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">complete</div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${statusColor}88, ${statusColor})` }}
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* ── Pipeline Track (5 steps only) ── */}
          <div className="relative z-10 px-6 py-4">
            <div className="flex items-center">
              {ROW1.map((step, i) => (
                <React.Fragment key={step.num}>
                  <StepNode step={step} status={getStepStatus(step.num, currentStep, finalStatus)} />
                  {i < ROW1.length - 1 && (
                    <PipeLine
                      done={currentStep > step.num + 1 || (isDone && currentStep >= step.num + 1)}
                      active={currentStep === step.num + 1 && !isDone}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ── Active step highlight ── */}
          <AnimatePresence mode="wait">
            {!isDone && (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="relative z-10 mx-6 mb-4 px-4 py-3 rounded-xl border"
                style={{
                  borderColor: (STEPS[currentStep - 1]?.color ?? '#22d3ee') + '44',
                  background: (STEPS[currentStep - 1]?.color ?? '#22d3ee') + '0d',
                }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-1.5 h-8 rounded-full"
                    style={{ backgroundColor: STEPS[currentStep - 1]?.color ?? '#22d3ee' }}
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                  />
                  <div>
                    <p className="text-sm font-black font-mono text-white">
                      {STEPS[currentStep - 1]?.label ?? '—'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">
                      {STEP_LOGS[currentStep]?.replace(/^\[\w+\]\s+/, '') ?? 'Processing…'}
                    </p>
                  </div>
                  <motion.div
                    className="ml-auto text-xs font-mono font-bold px-2 py-1 rounded"
                    style={{
                      color: STEPS[currentStep - 1]?.color ?? '#22d3ee',
                      backgroundColor: (STEPS[currentStep - 1]?.color ?? '#22d3ee') + '15',
                    }}
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                  >
                    ACTIVE
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Console log ── */}
          <div
            ref={logRef}
            className="relative z-10 mx-6 mb-4 h-20 overflow-y-auto rounded-lg bg-black/60 border border-slate-800/80 p-3 font-mono"
          >
            {logs.map((line, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                className={`text-[10px] leading-5 ${
                  line.includes('[DONE]') ? 'text-green-400' :
                  line.includes('[WARN]') ? 'text-yellow-400' :
                  line.includes('[ERR]') || line.includes('[SKIP]') ? 'text-red-400' :
                  'text-cyan-400/70'
                }`}
              >
                {line}
              </motion.p>
            ))}
            {!isDone && (
              <motion.span
                className="inline-block w-2 h-3 bg-cyan-400 ml-1 align-middle"
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.6, repeat: Infinity }}
              />
            )}
          </div>

          {/* ── Stats bar ── */}
          <div className="relative z-10 mx-6 mb-5 grid grid-cols-4 gap-2">
            {[
              { label: 'SEGMENTS', value: segments > 0 ? segments : '—', ok: segments > 0 },
              { label: 'CONFIDENCE', value: confidence > 0 ? `${(confidence * 100).toFixed(0)}%` : 'N/A', ok: confidence >= 0.85 },
              { label: 'ACK', value: ackSent ? `${doc?.acknowledgment_type ?? '997'}` : isDone ? 'SKIP' : '…', ok: ackSent },
              { label: 'ERP POST', value: erpPosted ? 'SENT' : isDone ? 'SKIP' : '…', ok: erpPosted },
            ].map(stat => (
              <div key={stat.label}
                className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center"
                style={{
                  borderColor: stat.ok ? '#4ade8030' : '#1e293b',
                  background: stat.ok ? '#052e1610' : '#0f172a',
                }}
              >
                <span className={`text-sm font-black font-mono ${stat.ok ? 'text-green-400' : 'text-slate-400'}`}>
                  {stat.value}
                </span>
                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* ── Final result card ── */}
          <AnimatePresence>
            {isDone && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative z-10 mx-6 mb-5 overflow-hidden"
              >
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    borderColor: statusColor + '33',
                    background: statusColor + '0d',
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {finalStatus === 'Completed' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" style={{ color: statusColor }} />
                      )}
                      <span className="text-sm font-black font-mono" style={{ color: statusColor }}>
                        {finalStatus === 'Ready for Dispatch' || finalStatus === 'Completed' || finalStatus === 'Needs Review'
                          ? ((doc?.metadata?.ai_fixed_errors || []).length
                              ? 'FILE CORRECTED USING AI'
                              : 'READY FOR DISPATCH')
                          : finalStatus === 'Duplicate' ? 'DUPLICATE — PIPELINE HALTED' :
                         'PIPELINE FAILURE'}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {doc?.document_type} · {doc?.metadata?.detected_standard}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Reply Doc', value: replyId ? 'GENERATED' : 'NONE', ok: !!replyId },
                      { label: 'Val Errors', value: valErrors === 0 ? 'CLEAR' : `${valErrors} ERR`, ok: valErrors === 0 },
                      { label: 'Anomaly', value: anomaly ? 'FLAGGED ⚠' : 'CLEAR', ok: !anomaly },
                    ].map(s => (
                      <div key={s.label}
                        className="rounded-lg px-3 py-2 text-center border"
                        style={{ borderColor: (s.ok ? '#4ade80' : '#f87171') + '22', background: (s.ok ? '#052e16' : '#2d0a0a') + '44' }}
                      >
                        <div className={`text-xs font-black font-mono ${s.ok ? 'text-green-400' : 'text-red-400'}`}>{s.value}</div>
                        <div className="text-[9px] font-mono text-slate-500 uppercase mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Footer ── */}
          <div className="relative z-10 px-6 pb-5 flex items-center justify-between">
            <div className="text-[10px] font-mono text-slate-600">
              DOC · {documentId?.slice(-12)?.toUpperCase() ?? '—'}
            </div>
            {isDone ? (
              <div className="flex items-center gap-3">
                {/* Go to Inbound — primary action when inbound complete */}
                {(finalStatus === 'Ready for Dispatch' || finalStatus === 'Completed' || finalStatus === 'Needs Review') && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    onClick={() => {
                      onClose();
                      navigate('/inbound');
                    }}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-black font-mono text-sm transition-all"
                    style={{
                      background: 'linear-gradient(135deg,#4ade8022,#4ade8011)',
                      border: '1px solid #4ade8066',
                      color: '#4ade80',
                      boxShadow: '0 0 20px #4ade8022',
                    }}
                  >
                    <ArrowDownToLine className="w-4 h-4" />
                    Go to Inbound ▸
                  </motion.button>
                )}
                {/* Check Corrections — when AI fixed errors */}
                {(doc?.metadata?.ai_fixed_errors || []).length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => {
                      onClose();
                      navigate(`/document/${documentId}`);
                    }}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-black font-mono text-sm transition-all"
                    style={{
                      background: 'linear-gradient(135deg,#22d3ee22,#22d3ee11)',
                      border: '1px solid #22d3ee66',
                      color: '#22d3ee',
                      boxShadow: '0 0 20px #22d3ee22',
                    }}
                  >
                    <ClipboardList className="w-4 h-4" />
                    Check Corrections ▸
                  </motion.button>
                )}
                <button
                  onClick={onClose}
                  className="px-6 py-2 rounded-xl font-black font-mono text-sm transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${statusColor}22, ${statusColor}11)`,
                    border: `1px solid ${statusColor}44`,
                    color: statusColor,
                    boxShadow: `0 0 20px ${statusColor}22`,
                  }}
                >
                  CLOSE ▸
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
                LIVE · polling every 1.5s
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
