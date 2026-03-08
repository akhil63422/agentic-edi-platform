import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Download, RefreshCw, Send, AlertCircle, CheckCircle2,
  ChevronRight, ChevronDown, Loader2, Sparkles, XCircle, Info,
  ClipboardCheck, Wand2, Zap, Database, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { documentsService } from '@/services/documents';
import { OutboundProcessingModal } from '@/components/OutboundProcessingModal';

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

const confColor = (c) => {
  if (c >= 1.0) return '#4ade80';
  if (c >= 0.9) return '#4ade80';
  if (c >= 0.75) return '#facc15';
  return '#f87171';
};

// ─────────────────────────────────────────────────────────────────────────────
// Confidence ring  (animates to value)
// ─────────────────────────────────────────────────────────────────────────────
function ConfidenceRing({ value }) {
  const pct   = Math.round((value || 0) * 100);
  const r     = 34;
  const circ  = 2 * Math.PI * r;
  const dash  = Math.min(pct / 100, 1) * circ;
  const color = confColor(value || 0);
  const label = pct >= 100 ? 'Verified' : pct >= 90 ? 'High' : pct >= 75 ? 'Below Threshold' : 'Low Confidence';

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {pct >= 100 && (
          <motion.div
            className="absolute inset-0 rounded-full"
            animate={{ boxShadow: ['0 0 0px #4ade8055', '0 0 18px #4ade8088', '0 0 0px #4ade8055'] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <svg width="92" height="92" className="-rotate-90">
          <circle cx="46" cy="46" r={r} stroke="#1e293b" strokeWidth="7" fill="none" />
          <motion.circle
            cx="46" cy="46" r={r}
            stroke={color} strokeWidth="7" fill="none"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${circ}` }}
            animate={{ strokeDasharray: `${dash} ${circ}` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-black font-mono" style={{ color }}>
            {pct}%
          </span>
        </div>
      </div>
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Completed:    '#4ade80',
    'Needs Review': '#facc15',
    Failed:       '#f87171',
    Duplicate:    '#f87171',
    'Ready for Dispatch': '#22d3ee',
    Dispatched:  '#4ade80',
    Delivered:   '#4ade80',
    Routing:     '#94a3b8',
    Delivering:  '#94a3b8',
  };
  const c = map[status] || '#94a3b8';
  return (
    <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded border"
      style={{ background: c + '18', borderColor: c + '55', color: c }}>
      {status}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Syntax-coloured JSON renderer
// ─────────────────────────────────────────────────────────────────────────────
function JsonView({ data }) {
  const text = JSON.stringify(data, null, 2);
  const highlighted = text
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'text-pink-300';        // string
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'text-sky-300' : 'text-emerald-300'; // key vs value
        } else if (/true|false/.test(match)) cls = 'text-yellow-300';
        else if (/null/.test(match)) cls = 'text-slate-500';
        else cls = 'text-orange-300';     // number
        return `<span class="${cls}">${match}</span>`;
      });
  return (
    <pre
      className="font-mono text-[10px] leading-relaxed whitespace-pre-wrap break-all"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export const DocumentDetail = () => {
  const { id }   = useParams();
  const navigate = useNavigate();

  // ── server state ──────────────────────────────────────────────────────────
  const [loading, setLoading]       = useState(true);
  const [doc, setDoc]               = useState(null);
  const [exceptions, setExceptions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [partner, setPartner]       = useState(null);
  const [error, setError]           = useState(null);

  // ── local UI state ────────────────────────────────────────────────────────
  const [expanded, setExpanded]   = useState([]);             // set of segment keys
  const [resolved, setResolved]   = useState({});             // idx → 'applied'|'kept'
  const [showCorrections, setShowCorrections] = useState(true); // Check Corrections: show old/new fields
  const [canonical, setCanonical] = useState(null);
  const [localConf, setLocalConf] = useState(null);           // override after resolution

  // ── in-flight flags ───────────────────────────────────────────────────────
  const [applying, setApplying]   = useState(null);
  const [generating, setGenerating] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [sending, setSending]     = useState(false);
  const [outboundModal, setOutboundModal] = useState(null); // { outboundId, fileName }

  // ── load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await documentsService.getReview(id);
      setDoc(data.document);
      setExceptions(data.exceptions || []);
      setSuggestions(data.ai_suggestions || []);
      setPartner(data.partner);
      setCanonical(data.document?.canonical_json || null);
      setLocalConf(null);

      // Auto-expand segments flagged by AI suggestions
      const problemSegs = new Set((data.ai_suggestions || []).map(s => s.segment_id).filter(Boolean));
      const segs = data.document?.parsed_segments || [];
      const autoExpand = segs
        .map((s, i) => `${s.segment_id}-${i}`)
        .filter((_, i) => problemSegs.has(segs[i]?.segment_id));
      setExpanded(autoExpand.length ? autoExpand : segs.slice(0, 1).map((s, i) => `${s.segment_id}-${i}`));
    } catch {
      try {
        const plain = await documentsService.getById(id);
        setDoc(plain);
        setCanonical(plain?.canonical_json || null);
        setSuggestions([]);
        setExceptions([]);
      } catch {
        setError('Could not load document.');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── when AI fixed or all suggestions resolved → confidence → 1.0 ─────────
  useEffect(() => {
    if (doc?.metadata?.ai_fixed_errors?.length) {
      setLocalConf(1.0);
    } else if (suggestions.length > 0 && suggestions.every((_, i) => resolved[i])) {
      setLocalConf(1.0);
    }
  }, [doc?.metadata?.ai_fixed_errors, resolved, suggestions]);

  // ── actions ───────────────────────────────────────────────────────────────
  const handleApply = async (idx, sugg) => {
    setApplying(idx);
    try {
      if (sugg.segment_id && sugg.suggested_value) {
        await documentsService.applyCorrection(id, {
          segment_id: sugg.segment_id,
          field_name: sugg.field_name,
          old_value: sugg.current_value || '',
          new_value: sugg.suggested_value,
          apply_to_canonical: true,
        });
      }
      setResolved(r => ({ ...r, [idx]: 'applied' }));
      toast.success(`Correction applied — canonical JSON updated`);
      // Refresh to get updated canonical (backend regenerates it dynamically)
      const data = await documentsService.getReview(id);
      setDoc(data.document);
      setCanonical(data.document?.canonical_json ?? canonical);
    } catch {
      toast.error('Failed to apply correction');
    } finally {
      setApplying(null);
    }
  };

  const handleKeep = (idx, sugg) => {
    setResolved(r => ({ ...r, [idx]: 'kept' }));
    toast.info(`Original kept — ${sugg.field_name}`);
  };

  const handleGenerateCanonical = async () => {
    setGenerating(true);
    try {
      const result = await documentsService.generateCanonical(id);
      setCanonical(result.canonical);
      setLocalConf(1.0);
      toast.success('Canonical JSON generated — Ready for Dispatch');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to generate canonical JSON');
    } finally {
      setGenerating(false);
    }
  };

  const handleRerun = async () => {
    setRerunning(true);
    try {
      await documentsService.reprocess(id);
      toast.success('Pipeline re-started — processing in background');
      setTimeout(() => navigate(-1), 1800);
    } catch {
      toast.error('Failed to re-trigger pipeline');
    } finally {
      setRerunning(false);
    }
  };

  const handleCreateOutbound = async () => {
    if (!canonical) { toast.error('Generate the canonical JSON first'); return; }
    const status = doc?.status;
    if (!['Ready for Dispatch', 'Completed', 'Dispatched'].includes(status)) {
      toast.error('Generate canonical JSON first to enable Create Outbound.');
      return;
    }
    if (doc?.metadata?.outbound_transaction_id) {
      toast.info('Outbound already created. Redirecting...');
      navigate(`/document/${doc.metadata.outbound_transaction_id}`);
      return;
    }
    setSending(true);
    try {
      const result = await documentsService.createOutboundFromInbound(id);
      if (result?.success && result?.outbound_id) {
        toast.success('Outbound transmission created');
        setDoc(d => d ? { ...d, metadata: { ...d.metadata, outbound_transaction_id: result.outbound_id } } : d);
        setOutboundModal({ outboundId: result.outbound_id, fileName: doc?.file_name || `outbound_${id.slice(-8)}` });
      } else {
        toast.warning(result?.message || 'Failed to create outbound');
      }
    } catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d) => d?.msg || d).join('; ') : (typeof detail === 'string' ? detail : JSON.stringify(detail || 'Create outbound failed'));
      toast.error(msg || 'Create outbound failed');
    } finally {
      setSending(false);
    }
  };

  const handleDownloadAudit = () => {
    if (!doc) return;
    const blob = new Blob([JSON.stringify({ document: doc, exceptions, suggestions, canonical }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `audit_${id?.slice(-8)}.json` });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const toggleSeg = (key) => setExpanded(e => e.includes(key) ? e.filter(k => k !== key) : [...e, key]);

  // ── derived ───────────────────────────────────────────────────────────────
  const parsedSegs    = doc?.parsed_segments || [];
  const rawEDI        = doc?.raw_edi || '';
  const confidence    = localConf !== null ? localConf : (doc?.metadata?.ai_fixed_errors?.length ? 1.0 : (doc?.ai_confidence_score ?? 0));
  const docId         = doc?._id || id || '';
  const pendingCount  = suggestions.filter((_, i) => !resolved[i]).length;
  const allResolved   = suggestions.length > 0 && pendingCount === 0;
  const isInbound     = doc?.direction === 'Inbound';
  const outboundId   = doc?.metadata?.outbound_transaction_id;
  const canCreateOutbound = isInbound && !!canonical && ['Ready for Dispatch', 'Completed', 'Dispatched'].includes(doc?.status) && !outboundId;

  // map segment_id → list of suggestion indices
  const segSuggMap = {};
  suggestions.forEach((s, i) => {
    if (s.segment_id) {
      if (!segSuggMap[s.segment_id]) segSuggMap[s.segment_id] = [];
      segSuggMap[s.segment_id].push(i);
    }
  });

  // ── loading / error ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-[70vh]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-9 h-9 text-cyan-400 animate-spin" />
        <p className="text-xs font-mono text-slate-500">Loading review workspace…</p>
      </div>
    </div>
  );

  if (error || !doc) return (
    <div className="flex items-center justify-center h-[70vh]">
      <div className="text-center space-y-3">
        <XCircle className="w-9 h-9 text-red-400 mx-auto" />
        <p className="text-xs font-mono text-slate-400">{error || 'Document not found'}</p>
        <button onClick={() => navigate(-1)} className="text-xs font-mono text-cyan-400 hover:underline">← Go back</button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-5 space-y-4"
      style={{ background: 'linear-gradient(135deg,#020817 0%,#080e1c 60%,#020817 100%)' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate(-1)}
            className="mt-1 p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-black font-mono text-white text-base tracking-tight truncate max-w-xs">
                {docId.slice(-20).toUpperCase()}
              </h1>
              <StatusBadge status={doc?.metadata?.ai_fixed_errors?.length ? 'Completed' : doc.status} />
              {exceptions.length > 0 && !doc?.metadata?.ai_fixed_errors?.length && (
                <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded border border-red-500/40 bg-red-900/20 text-red-400">
                  Exception
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-slate-500 mt-1">
              {partner?.partner_code || doc.partner_code || 'Unknown'}
              {' · '}{doc.document_type}
              {' · '}{doc.received_at ? new Date(doc.received_at).toLocaleString() : '—'}
            </p>
          </div>
        </div>
        <ConfidenceRing value={confidence} />
      </div>

      {/* ── INBOUND / OUTBOUND STATUS BLOCKS ───────────────────────────────── */}
      {isInbound && (
        <div className="flex gap-4 flex-wrap">
          <div className="rounded-lg border border-slate-700 px-4 py-2.5 bg-slate-900/60">
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-0.5">Inbound Status</p>
            <p className="text-sm font-bold font-mono text-slate-200">{doc?.status || '—'}</p>
          </div>
          <div className="rounded-lg border border-slate-700 px-4 py-2.5 bg-slate-900/60">
            <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-0.5">Outbound Status</p>
            {outboundId ? (
              <a
                href={`#/document/${outboundId}`}
                onClick={(e) => { e.preventDefault(); navigate(`/document/${outboundId}`); }}
                className="text-sm font-bold font-mono text-cyan-400 hover:underline"
              >
                In Progress — {outboundId.slice(-12)}
              </a>
            ) : (
              <p className="text-sm font-mono text-slate-500">Not Created</p>
            )}
          </div>
        </div>
      )}
      {!isInbound && doc?.parent_transaction_id && (
        <div className="rounded-lg border border-slate-700 px-4 py-2.5 bg-slate-900/60 inline-block">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-0.5">Linked Inbound</p>
          <a
            href={`#/document/${doc.parent_transaction_id}`}
            onClick={(e) => { e.preventDefault(); navigate(`/document/${doc.parent_transaction_id}`); }}
            className="text-sm font-bold font-mono text-cyan-400 hover:underline"
          >
            {doc.parent_transaction_id}
          </a>
        </div>
      )}

      {/* ── FIXED BY AI BANNER ─────────────────────────────────────────────── */}
      {doc?.metadata?.ai_fixed_errors?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border p-4"
          style={{ background: '#05291640', borderColor: '#4ade8055' }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-green-300 text-sm">Fixed by AI</p>
                <p className="text-[11px] text-green-200/80 mt-0.5">
                  File corrected using AI. {doc.metadata.ai_fixed_errors.length} correction{doc.metadata.ai_fixed_errors.length > 1 ? 's' : ''} applied during processing.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCorrections(s => !s)}
              className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all"
              style={{
                background: showCorrections ? '#065f46' : '#0f172a',
                border: '1px solid #4ade8066',
                color: '#4ade80',
              }}>
              <Wrench className="w-4 h-4" />
              {showCorrections ? 'Hide Corrections' : 'Check Corrections'}
            </button>
          </div>

          {/* Old fields & New fields — toggleable */}
          {showCorrections && (
            <div className="mt-4 pt-4 border-t border-green-500/20 space-y-3">
              <p className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-widest">
                Corrections applied (Old → New)
              </p>
              <div className="grid gap-2">
                {doc.metadata.ai_fixed_errors.map((fix, i) => (
                  <div
                    key={i}
                    className="rounded-lg px-3 py-2.5 flex items-start gap-4 border"
                    style={{ borderColor: '#334155', background: '#0c1a2e' }}>
                    <div className="flex-1 min-w-0 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[9px] font-mono text-red-400/80 uppercase mb-0.5">Old field</p>
                        <p className="text-[11px] font-mono text-red-300 line-through break-all">{fix.old_value || '(empty)'}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-green-400/80 uppercase mb-0.5">New field</p>
                        <p className="text-[11px] font-mono text-green-300 font-medium break-all">{fix.new_value}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-[10px] font-bold font-mono text-cyan-400">{fix.segment_id}</span>
                      {fix.field_name && (
                        <p className="text-[9px] text-slate-500 mt-0.5">{fix.field_name}</p>
                      )}
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── AI Suggestion Pending (reference: exclamation icon, clear copy) ── */}
      <AnimatePresence mode="wait">
        {!doc?.metadata?.ai_fixed_errors?.length && !allResolved && pendingCount > 0 && (
          <motion.div key="pending"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="rounded-xl border p-4 flex items-start justify-between gap-4"
            style={{ background: '#fef9c3', borderColor: '#eab308', color: '#854d0e' }}>
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-900 text-sm">AI Suggestion Pending</p>
                <p className="text-[12px] text-amber-800/90 mt-0.5">
                  The AI detected a potential issue with{' '}
                  <span className="font-semibold text-amber-900">
                    {suggestions.filter((_, i) => !resolved[i]).map(s => s.field_name).join(', ')}
                  </span>
                  . Review the suggestion below and approve or override.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-lg px-3 py-2 border border-amber-300 bg-amber-50 text-center">
              <p className="text-[9px] font-mono text-amber-700 uppercase tracking-wider">AI Confidence</p>
              <p className="text-sm font-black font-mono text-amber-900">
                {Math.round((suggestions.find((_, i) => !resolved[i])?.confidence ?? 0) * 100)}%
              </p>
            </div>
          </motion.div>
        )}

        {!doc?.metadata?.ai_fixed_errors?.length && allResolved && pendingCount === 0 && suggestions.length > 0 && (
          <motion.div key="resolved"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border p-3.5 flex items-center gap-3"
            style={{ background: '#05291640', borderColor: '#4ade8055' }}>
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-sm font-medium text-green-300">
              All AI suggestions resolved. Generate canonical JSON and create outbound transmission.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── THREE PANES ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 560 }}>

        {/* ━━━ PANE 1: Raw EDI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="rounded-xl border border-slate-800 bg-[#080e1c] flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
            <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">Raw X12 Document</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <pre className="font-mono text-[9.5px] text-cyan-300/75 leading-relaxed whitespace-pre-wrap break-all">
              {rawEDI || '(empty)'}
            </pre>
          </div>
        </div>

        {/* ━━━ PANE 2: Parsed EDI Structure ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="rounded-xl border border-slate-800 bg-[#080e1c] flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-violet-400 shrink-0" />
            <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest">Parsed EDI Structure</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
            {parsedSegs.length === 0 && (
              <p className="text-[11px] font-mono text-slate-600 p-3 text-center">No segments available.</p>
            )}

            {parsedSegs.map((seg, si) => {
              const key         = `${seg.segment_id}-${si}`;
              const isOpen      = expanded.includes(key);
              const segData     = seg.data || {};
              const elements    = seg.elements || [];
              const suggIdxs    = segSuggMap[seg.segment_id] || [];
              const pendingSugg = suggIdxs.filter(i => !resolved[i]);
              const hasIssue    = pendingSugg.length > 0;

              return (
                <div key={key} className="rounded-lg border overflow-hidden transition-all duration-300"
                  style={{
                    borderColor: hasIssue ? '#f8717166' : '#1e293b',
                    background:  hasIssue ? '#2d0a0a22' : '#0f172a',
                    boxShadow:   hasIssue ? '0 0 0 1px #f8717122' : 'none',
                  }}>
                  {/* ── Row header ── */}
                  <button onClick={() => toggleSeg(key)}
                    className="w-full px-3 py-2 flex items-center justify-between transition-colors hover:bg-white/5"
                    style={{ borderLeft: hasIssue ? '3px solid #f87171' : '3px solid transparent' }}>
                    <div className="flex items-center gap-2">
                      {hasIssue
                        ? <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        : <span className="w-3.5 h-3.5 shrink-0" />}
                      <span className={`text-xs font-bold font-mono ${hasIssue ? 'text-red-300' : 'text-slate-300'}`}>
                        {seg.segment_id}
                      </span>
                      {hasIssue && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{ background: '#f8717125', color: '#f87171', border: '1px solid #f8717144' }}>
                          NEEDS REVIEW
                        </span>
                      )}
                    </div>
                    {isOpen
                      ? <ChevronDown className="w-3.5 h-3.5 text-slate-600" />
                      : <ChevronRight className="w-3.5 h-3.5 text-slate-600" />}
                  </button>

                  {/* ── Expanded content ── */}
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-1 pt-1">
                      {/* ── Parsed fields ── */}
                      {Object.entries(segData).map(([k, v]) => {
                        const relatedSugg = pendingSugg
                          .map(i => suggestions[i])
                          .find(s => String(s.current_value) === String(v) ||
                            s.field_name.toLowerCase().replace(/_/g, ' ') === k.toLowerCase().replace(/_/g, ' '));
                        return (
                          <div key={k}
                            className={`flex justify-between items-start gap-2 py-1 px-2 rounded text-[10px] ${relatedSugg ? 'bg-red-900/25' : ''}`}>
                            <span className="text-slate-500 capitalize shrink-0">{k.replace(/_/g, ' ')}</span>
                            <span className={`font-mono font-medium text-right ${relatedSugg ? 'text-red-300' : 'text-slate-300'}`}>
                              {fmt(v)}
                              {relatedSugg && <AlertCircle className="inline w-3 h-3 ml-1 text-red-400" />}
                            </span>
                          </div>
                        );
                      })}
                      {/* raw elements when no structured data */}
                      {Object.keys(segData).length === 0 && elements.map((el, ei) => (
                        <div key={ei} className="flex justify-between text-[10px] py-1 px-2">
                          <span className="text-slate-600">el-{ei + 1}</span>
                          <span className="font-mono text-slate-400">{fmt(el)}</span>
                        </div>
                      ))}

                      {/* ── AI Suggests (reference: Detected / Suggested in blue, Apply blue primary, Keep white) ── */}
                      {pendingSugg.map((idx) => {
                        const s = suggestions[idx];
                        return (
                          <motion.div key={idx}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            className="mt-2.5 rounded-lg p-3.5 space-y-2.5 border border-amber-300/50"
                            style={{ background: '#fffbeb' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-900">
                                AI Suggests:
                              </span>
                              <span className="ml-auto text-[9px] font-mono text-amber-600">
                                {Math.round((s.confidence || 0) * 100)}% confidence
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] font-medium text-slate-600 shrink-0">Detected:</span>
                                <span className="font-mono text-[11px] font-semibold text-slate-800 break-all">{fmt(s.current_value) || '(empty)'}</span>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-[10px] font-medium text-slate-600 shrink-0">Suggested:</span>
                                <span className="font-mono text-[11px] font-bold text-blue-600 break-all">{fmt(s.suggested_value) || '—'}</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed italic">{s.reason || s.issue}</p>

                            <div className="flex gap-2 pt-1">
                              <button disabled={applying === idx}
                                onClick={() => handleApply(idx, s)}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all bg-blue-600 hover:bg-blue-700 text-white">
                                {applying === idx
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Apply Suggestion
                              </button>
                              <button onClick={() => handleKeep(idx, s)}
                                className="flex-1 py-2 rounded-lg text-[11px] font-semibold transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50">
                                Keep Original
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}

                      {/* resolved indicator */}
                      {suggIdxs.length > 0 && pendingSugg.length === 0 && (
                        <div className="mt-1.5 px-2 py-1.5 rounded-lg border border-green-500/25 bg-green-900/10 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                          <span className="text-[10px] font-mono text-green-300">
                            {resolved[suggIdxs[0]] === 'applied' ? 'Correction applied' : 'Original kept'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* exceptions strip */}
            {exceptions.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1.5">
                <p className="text-[9px] font-black font-mono text-slate-700 uppercase tracking-widest">Exceptions</p>
                {exceptions.map((exc, i) => (
                  <div key={i} className="rounded-lg px-2.5 py-2 border border-red-500/20 bg-red-900/10">
                    <p className="text-[10px] font-bold font-mono text-red-400">{exc.exception_type}</p>
                    <p className="text-[9px] text-slate-500 mt-0.5 leading-relaxed">{exc.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ━━━ PANE 3: Canonical Business Object ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="rounded-xl border flex flex-col overflow-hidden transition-all duration-500"
          style={{
            borderColor: canonical ? '#a855f755' : '#1e293b',
            background: '#080e1c',
            boxShadow: canonical ? '0 0 30px #a855f718' : 'none',
          }}>
          <div className="px-4 py-2.5 border-b flex items-center gap-2 shrink-0"
            style={{ borderColor: canonical ? '#a855f733' : '#1e293b' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: canonical ? '#c084fc' : '#475569' }} />
            <span className="text-[10px] font-black font-mono text-slate-400 uppercase tracking-widest flex-1">
              Canonical Business Object
            </span>
            {canonical && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: '#7c3aed25', color: '#a855f7', border: '1px solid #7c3aed44' }}>
                READY
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {canonical ? (
              <JsonView data={canonical} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 py-10">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: '#7c3aed18', border: '1px solid #7c3aed44' }}>
                  <Database className="w-5 h-5 text-violet-400" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold font-mono text-slate-400">No canonical JSON yet.</p>
                  <p className="text-[10px] font-mono text-slate-600">
                    {pendingCount > 0
                      ? 'Apply AI suggestions or generate manually. Canonical updates when you apply corrections.'
                      : 'Generate from parsed segments to enable Create Outbound.'}
                  </p>
                </div>
                <button
                  onClick={handleGenerateCanonical}
                  disabled={generating || parsedSegs.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all"
                  style={{
                    background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                    color: '#fff',
                    border: '1px solid #7c3aed',
                    boxShadow: '0 0 20px #7c3aed44',
                    opacity: generating ? 0.7 : 1,
                  }}>
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {generating ? 'Generating…' : 'Generate Canonical JSON'}
                </button>
              </div>
            )}
          </div>

          {/* Regenerate button when canonical exists */}
          {canonical && (
            <div className="px-3 pb-3 pt-1 shrink-0 border-t border-slate-800/50">
              <button onClick={handleGenerateCanonical} disabled={generating}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-mono text-slate-500 hover:text-violet-300 transition-colors">
                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                {generating ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ACTION FOOTER ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-[#080e1c]/95 backdrop-blur px-5 py-4 flex items-center justify-between gap-4"
        style={{ boxShadow: '0 -4px 50px #000a' }}>
        <button onClick={handleDownloadAudit}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-[11px] font-mono hover:border-slate-500 hover:text-white transition-colors shrink-0">
          <Download className="w-3.5 h-3.5" />
          Download Audit Report
        </button>

        <div className="flex items-center gap-3">
          <button onClick={handleRerun} disabled={rerunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold font-mono transition-colors shrink-0"
            style={{ background: '#0c1a2e', border: '1px solid #22d3ee44', color: '#22d3ee' }}>
            {rerunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Re-run Translation
          </button>

          {/* Create Outbound Transmission — for inbound Ready for Dispatch */}
          {isInbound && (
            <button
              onClick={handleCreateOutbound}
              disabled={sending || !canCreateOutbound}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black font-mono transition-all shrink-0"
              style={{
                background: outboundId
                  ? '#052e16'
                  : canCreateOutbound
                  ? 'linear-gradient(135deg,#7c3aed,#6d28d9)'
                  : '#1e293b',
                border: outboundId
                  ? '1px solid #4ade8044'
                  : canCreateOutbound
                  ? '1px solid #7c3aed'
                  : '1px solid #334155',
                color: outboundId ? '#4ade80' : canCreateOutbound ? '#fff' : '#475569',
                boxShadow: canCreateOutbound && !outboundId ? '0 0 24px #7c3aed55' : 'none',
                cursor: !canCreateOutbound && !outboundId ? 'not-allowed' : 'pointer',
              }}>
              {sending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : outboundId
                ? <ClipboardCheck className="w-4 h-4" />
                : <Zap className="w-4 h-4" />}
              {sending ? 'Creating…' : outboundId ? 'Outbound Created' : 'Create Outbound Transmission'}
            </button>
          )}
        </div>
      </div>

      {/* Outbound Pipeline Popup — same layout as inbound */}
      {outboundModal && (
        <OutboundProcessingModal
          documentId={outboundModal.outboundId}
          fileName={outboundModal.fileName}
          inboundId={id}
          onClose={() => setOutboundModal(null)}
        />
      )}
    </div>
  );
};
