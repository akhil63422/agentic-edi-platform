import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  X, CheckCircle2, AlertTriangle, GitBranch, FileJson, Truck, BarChart3,
  ArrowUpFromLine,
} from 'lucide-react';
import { documentsService } from '@/services/documents';

// ─────────────────────────────────────────────────────────────────────────────
// Outbound pipeline: 4 steps (Route → Transform → Deliver → Monitor)
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, key: 'route',    label: 'ROUTE',    short: 'RTE', icon: GitBranch,  color: '#60a5fa', glow: '#60a5fa' },
  { num: 2, key: 'transform', label: 'TRANSFORM', short: 'XFM', icon: FileJson,   color: '#a78bfa', glow: '#a78bfa' },
  { num: 3, key: 'deliver',  label: 'DELIVER',  short: 'DLV', icon: Truck,      color: '#34d399', glow: '#34d399' },
  { num: 4, key: 'monitor',  label: 'MONITOR',  short: 'LOG', icon: BarChart3,  color: '#22d3ee', glow: '#22d3ee' },
];

const TERMINAL = ['Delivered', 'Failed'];
const ROW1 = STEPS;

// Map backend stage/status to step number (Created→1, Routing→2, Delivering→3, Delivered→4)
function statusToStep(status, stage) {
  const s = (stage || status || '').toLowerCase();
  if (s === 'delivered') return 4;
  if (s === 'delivering') return 3;
  if (s === 'routing') return 2;
  return 1; // Created or default
}

function getStepStatus(stepNum, currentStep, finalStatus) {
  if (finalStatus === 'Failed' && stepNum === currentStep) return 'error';
  if (stepNum < currentStep) return 'done';
  if (stepNum === currentStep) return TERMINAL.includes(finalStatus) ? 'done' : 'active';
  return 'idle';
}

const Particle = ({ delay = 0 }) => (
  <motion.div
    className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_3px_rgba(34,211,238,0.8)]"
    style={{ left: '-8px' }}
    animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
    transition={{ duration: 2.4, delay, repeat: Infinity, ease: 'linear' }}
  />
);

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

const StepNode = ({ step, status }) => {
  const Icon = step.icon;
  const isDone = status === 'done';
  const isActive = status === 'active';
  const isError = status === 'error';
  const isIdle = status === 'idle';

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="relative">
        {isActive && (
          <motion.div
            className="absolute -inset-2 rounded-xl"
            style={{ boxShadow: `0 0 20px 6px ${step.glow}66` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}
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
            backgroundColor: isDone ? '#052e16' : isActive ? '#0c1a2e' : isError ? '#2d0a0a' : '#0f172a',
            borderColor: isDone ? step.color : isActive ? step.color : isError ? '#ef4444' : '#1e293b',
            boxShadow: isDone ? `0 0 12px 2px ${step.color}55` : isActive ? `0 0 18px 4px ${step.color}77` : 'none',
          }}
          className="w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all duration-500 relative z-10"
        >
          {isDone && <CheckCircle2 className="w-5 h-5" style={{ color: step.color }} />}
          {isActive && (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
              <Icon className="w-5 h-5" style={{ color: step.color }} />
            </motion.div>
          )}
          {isError && <AlertTriangle className="w-5 h-5 text-red-400" />}
          {isIdle && <Icon className="w-4 h-4 text-slate-600" />}
        </motion.div>
      </div>
      <div className={`text-[9px] font-black font-mono px-1.5 py-0.5 rounded
        ${isDone ? 'text-green-400 bg-green-500/10' : isActive ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-600 bg-slate-800/50'}`}
        style={isDone ? { color: step.color } : {}}
      >
        {step.short}
      </div>
    </div>
  );
};

const STEP_LOGS = {
  1: '[RTE] Evaluating routing rules · selecting target system...',
  2: '[XFRM] Applying transformations if required...',
  3: '[DLV] Posting to ERP · delivering via transport...',
  4: '[LOG] Writing audit trail · monitoring ACK...',
};

export const OutboundProcessingModal = ({ documentId, fileName, inboundId, onClose }) => {
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState(['[INIT] Outbound pipeline started...']);
  const intervalRef = useRef(null);
  const logRef = useRef(null);
  const prevStep = useRef(0);

  useEffect(() => {
    if (!documentId) return;

    const poll = async () => {
      try {
        const data = await documentsService.getById(documentId, true);
        setDoc(data);

        const stage = data?.stage || data?.status;
        const step = statusToStep(data?.status, stage);
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
          const finalLine = data.status === 'Delivered'
            ? '[DONE] ✓ Outbound transmission delivered — parent inbound marked Dispatched.'
            : '[ERR]  Outbound pipeline failed — see validation report.';
          setLogs(prev => [...prev, finalLine]);
        }
      } catch {
        setError('Connection lost.');
        clearInterval(intervalRef.current);
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 1500);
    return () => clearInterval(intervalRef.current);
  }, [documentId]);

  const currentStep = doc ? statusToStep(doc.status, doc.stage) : 1;
  const finalStatus = doc?.status;
  const isDone = TERMINAL.includes(finalStatus);
  const progress = Math.min(Math.round((currentStep / 4) * 100), 100);

  const erpPosted = doc?.erp_posted;
  const statusColor = finalStatus === 'Delivered' ? '#4ade80' : finalStatus === 'Failed' ? '#f87171' : '#22d3ee';
  const statusLabel = finalStatus === 'Delivered' ? 'DELIVERY COMPLETE'
    : finalStatus === 'Failed' ? 'PIPELINE FAILED'
    : `PROCESSING — STEP ${currentStep}/4`;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
          onClick={isDone ? onClose : undefined}
        />
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
          <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.03]"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)' }} />
          {['top-0 left-0 border-t-2 border-l-2 rounded-tl-xl', 'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
            'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl', 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl'
          ].map((cls, i) => (
            <div key={i} className={`absolute w-6 h-6 ${cls}`} style={{ borderColor: statusColor + '88' }} />
          ))}

          {/* Header */}
          <div className="relative z-10 px-6 pt-5 pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <motion.div className="inline-flex items-center gap-2 mb-2"
                  animate={{ opacity: isDone ? 1 : [1, 0.5, 1] }}
                  transition={{ duration: 1.2, repeat: isDone ? 0 : Infinity }}>
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
                  <span className="text-xs font-black font-mono tracking-widest" style={{ color: statusColor }}>{statusLabel}</span>
                </motion.div>
                <h2 className="text-xl font-black font-mono text-white tracking-tight">OUTBOUND PIPELINE</h2>
                <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-sm">{fileName || documentId}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {isDone && (
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                )}
                <div className="text-right">
                  <div className="text-3xl font-black font-mono" style={{ color: statusColor }}>{progress}%</div>
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">complete</div>
                </div>
              </div>
            </div>
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

          {/* Pipeline Track */}
          <div className="relative z-10 px-6 py-4">
            <div className="flex items-center">
              {ROW1.map((step, i) => (
                <React.Fragment key={step.num}>
                  <StepNode step={step} status={getStepStatus(step.num, currentStep, finalStatus)} />
                  {i < ROW1.length - 1 && (
                    <PipeLine done={currentStep > step.num + 1 || (isDone && currentStep >= step.num + 1)} active={currentStep === step.num + 1 && !isDone} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Active step highlight */}
          <AnimatePresence mode="wait">
            {!isDone && (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="relative z-10 mx-6 mb-4 px-4 py-3 rounded-xl border"
                style={{ borderColor: (STEPS[currentStep - 1]?.color ?? '#22d3ee') + '44', background: (STEPS[currentStep - 1]?.color ?? '#22d3ee') + '0d' }}
              >
                <div className="flex items-center gap-3">
                  <motion.div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: STEPS[currentStep - 1]?.color ?? '#22d3ee' }}
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
                  <div>
                    <p className="text-sm font-black font-mono text-white">{STEPS[currentStep - 1]?.label ?? '—'}</p>
                    <p className="text-[11px] font-mono text-slate-400">{STEP_LOGS[currentStep]?.replace(/^\[\w+\]\s+/, '') ?? 'Processing…'}</p>
                  </div>
                  <motion.div className="ml-auto text-xs font-mono font-bold px-2 py-1 rounded"
                    style={{ color: STEPS[currentStep - 1]?.color ?? '#22d3ee', backgroundColor: (STEPS[currentStep - 1]?.color ?? '#22d3ee') + '15' }}
                    animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
                    ACTIVE
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Console log */}
          <div ref={logRef} className="relative z-10 mx-6 mb-4 h-20 overflow-y-auto rounded-lg bg-black/60 border border-slate-800/80 p-3 font-mono">
            {logs.map((line, i) => (
              <motion.p key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className={`text-[10px] leading-5 ${
                  line.includes('[DONE]') ? 'text-green-400' :
                  line.includes('[ERR]') ? 'text-red-400' : 'text-cyan-400/70'
                }`}>
                {line}
              </motion.p>
            ))}
            {!isDone && (
              <motion.span className="inline-block w-2 h-3 bg-cyan-400 ml-1 align-middle"
                animate={{ opacity: [1, 0] }} transition={{ duration: 0.6, repeat: Infinity }} />
            )}
          </div>

          {/* Stats bar */}
          <div className="relative z-10 mx-6 mb-5 grid grid-cols-4 gap-2">
            {[
              { label: 'ERP POST', value: erpPosted ? 'SENT' : isDone ? 'SKIP' : '…', ok: erpPosted },
              { label: 'DOC TYPE', value: doc?.document_type || '—', ok: !!doc?.document_type },
              { label: 'PARENT', value: inboundId ? inboundId.slice(-12) : '—', ok: !!inboundId },
              { label: 'STATUS', value: doc?.status || '…', ok: finalStatus === 'Delivered' },
            ].map(stat => (
              <div key={stat.label} className="flex flex-col items-center justify-center py-2 px-1 rounded-lg border text-center"
                style={{ borderColor: stat.ok ? '#4ade8030' : '#1e293b', background: stat.ok ? '#052e1610' : '#0f172a' }}>
                <span className={`text-sm font-black font-mono ${stat.ok ? 'text-green-400' : 'text-slate-400'}`}>{stat.value}</span>
                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mt-0.5">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="relative z-10 px-6 pb-5 flex items-center justify-between">
            <div className="text-[10px] font-mono text-slate-600">DOC · {documentId?.slice(-12)?.toUpperCase() ?? '—'}</div>
            {isDone ? (
              <div className="flex items-center gap-3">
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  onClick={() => { onClose(); navigate('/outbound'); }}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl font-black font-mono text-sm transition-all"
                  style={{ background: 'linear-gradient(135deg,#4ade8022,#4ade8011)', border: '1px solid #4ade8066', color: '#4ade80', boxShadow: '0 0 20px #4ade8022' }}
                >
                  <ArrowUpFromLine className="w-4 h-4" />
                  Go to Outbound ▸
                </motion.button>
                <button onClick={onClose}
                  className="px-6 py-2 rounded-xl font-black font-mono text-sm transition-all"
                  style={{ background: `linear-gradient(135deg, ${statusColor}22, ${statusColor}11)`, border: `1px solid ${statusColor}44`, color: statusColor, boxShadow: `0 0 20px ${statusColor}22` }}>
                  CLOSE ▸
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500">
                <motion.div className="w-1.5 h-1.5 rounded-full bg-cyan-400" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                LIVE · polling every 1.5s
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
