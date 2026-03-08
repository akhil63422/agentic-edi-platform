import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Play, Save, Download, Upload, Trash2,
  Eye, EyeOff, Maximize2, Minimize2,
  Trophy, Target, Zap, Activity,
  CheckCircle, AlertCircle, RotateCcw, Cpu,
  Loader2, Award, Sparkles, X, ChevronRight,
} from 'lucide-react';
import { useMapperStore, NODE_LIBRARY, ICON_MAP } from '../store/mapperStore';
import api from '../services/api';

/* ─── colour maps — 2-colour palette: cyan & purple ─── */
const _C = (cyan, purple) => ({ cyan, purple, blue:cyan, green:cyan, emerald:cyan, indigo:purple, violet:purple, pink:purple, amber:purple, yellow:purple, orange:purple });
const BG   = _C('bg-cyan-500',          'bg-purple-500');
const BDR  = _C('border-cyan-500/60',   'border-purple-500/60');
const SHAD = _C('shadow-cyan-500/20',   'shadow-purple-500/20');
const HBDR = _C('hover:border-cyan-400','hover:border-purple-400');
const RING = _C('ring-cyan-500/50',     'ring-purple-500/50');
const DOT  = _C('bg-cyan-400',          'bg-purple-400');

const resolveIcon = (name) => ICON_MAP[name] || Cpu;

/* ══════════════════════ SVG Connections ══════════════════════ */
const Connections = ({ nodes, connections, executionResults }) => (
  <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
    <defs>
      <filter id="glow"><feGaussianBlur stdDeviation="3" result="g"/><feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    {connections.map((conn) => {
      const from = nodes.find(n => n.id === conn.from);
      const to   = nodes.find(n => n.id === conn.to);
      if (!from || !to) return null;

      const x1 = from.x + 110, y1 = from.y;
      const x2 = to.x - 110,   y2 = to.y;
      const mx = (x1 + x2) / 2;
      const d  = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;

      const res = executionResults[from.id];
      const isSuccess = res?.status === 'success';
      const isRunning = res?.status === 'running';
      const color = isSuccess ? '#06b6d4' : isRunning ? '#a855f7' : '#334155';

      return (
        <g key={conn.id}>
          {(isSuccess || isRunning) && <path d={d} stroke={color} strokeWidth="6" fill="none" opacity="0.15" filter="url(#glow)"/>}
          <path d={d} stroke={color} strokeWidth="2.5" fill="none" strokeDasharray={isSuccess || isRunning ? '0' : '6 4'}/>
          {isSuccess && (
            <>
              <circle r="4" fill="#06b6d4"><animateMotion dur="1.8s" repeatCount="indefinite" path={d}/></circle>
              <circle r="2" fill="#fff"><animateMotion dur="1.8s" repeatCount="indefinite" path={d}/></circle>
            </>
          )}
          {isRunning && (
            <circle r="3" fill="#a855f7" opacity="0.8"><animateMotion dur="1s" repeatCount="indefinite" path={d}/></circle>
          )}
        </g>
      );
    })}
  </svg>
);

/* ══════════════════════ Workflow Node ══════════════════════ */
const WorkflowNode = ({ node, isSelected, executionResult, onSelect, onDragStart, onPortDragStart, onPortDrop }) => {
  const Icon = resolveIcon(node.icon);
  const isRunning = executionResult?.status === 'running';

  return (
    <div
      className={`absolute cursor-grab active:cursor-grabbing select-none transition-shadow duration-200 ${isSelected ? 'z-20' : 'z-10'}`}
      style={{ left: node.x, top: node.y, transform: 'translate(-50%,-50%)' }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node); onDragStart(e, node.id); }}
    >
      <div className={`relative bg-slate-900/90 backdrop-blur-sm border-2 rounded-xl p-4 min-w-[210px]
        shadow-lg transition-all duration-200
        ${BDR[node.color] || 'border-slate-600'} ${SHAD[node.color] || ''}
        ${isSelected ? `ring-2 ${RING[node.color] || 'ring-cyan-400/50'} scale-[1.04]` : 'hover:scale-[1.02]'}
        ${isRunning ? 'animate-pulse ring-2 ring-purple-400/60' : ''}`}
      >
        {/* execution badge */}
        {executionResult && (
          <div className={`absolute -top-2.5 -right-2.5 rounded-full p-1.5 border-2 border-slate-900
            ${executionResult.status === 'success' ? 'bg-cyan-500' : executionResult.status === 'running' ? 'bg-purple-500 animate-spin-slow' : 'bg-red-500'}`}>
            {executionResult.status === 'success' && <CheckCircle className="text-white w-3.5 h-3.5"/>}
            {executionResult.status === 'running' && <Loader2 className="text-white w-3.5 h-3.5 animate-spin"/>}
            {executionResult.status === 'error' && <AlertCircle className="text-white w-3.5 h-3.5"/>}
          </div>
        )}

        {/* input ports */}
        {node.inputs?.map((inp, i) => (
          <div key={inp}
            onMouseUp={(e) => { e.stopPropagation(); onPortDrop(node.id); }}
            className="absolute w-4 h-4 bg-cyan-500 rounded-full border-2 border-slate-900 -left-2 shadow-md shadow-cyan-500/40 hover:scale-125 transition-transform cursor-crosshair"
            style={{ top: `${40 + i * 22}%` }} />
        ))}

        {/* output ports */}
        {node.outputs?.map((out, i) => (
          <div key={out}
            onMouseDown={(e) => { e.stopPropagation(); onPortDragStart(node.id); }}
            className="absolute w-4 h-4 bg-purple-500 rounded-full border-2 border-slate-900 -right-2 shadow-md shadow-purple-500/40 hover:scale-125 transition-transform cursor-crosshair"
            style={{ top: `${40 + i * 22}%` }} />
        ))}

        {/* content */}
        <div className="flex items-center gap-3 mb-1.5">
          <div className={`${BG[node.color] || 'bg-slate-600'} p-2 rounded-lg shadow-inner`}>
            <Icon className="text-white w-5 h-5"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{node.label}</p>
            <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">{node.type}</p>
          </div>
        </div>

        {/* config summary */}
        {Object.keys(node.config).length > 0 && (
          <div className="mt-2 bg-slate-950/60 rounded-lg p-2 space-y-0.5">
            {Object.entries(node.config).slice(0, 3).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[10px]">
                <span className="text-slate-500">{k}</span>
                <span className="text-cyan-400 font-mono truncate ml-2 max-w-[100px]">{typeof v === 'object' ? String(v.value ?? '') : String(v)}</span>
              </div>
            ))}
          </div>
        )}

        {executionResult?.duration && (
          <div className="mt-1.5 text-[10px] text-slate-500 font-mono flex items-center gap-1">
            <Zap className="w-2.5 h-2.5 text-cyan-400"/> {executionResult.duration}ms
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════ Node Library Sidebar ══════════════════════ */
const NodeLibrary = ({ onAdd, onClose }) => {
  const [search, setSearch] = useState('');
  const filtered = NODE_LIBRARY.map(cat => ({
    ...cat,
    nodes: cat.nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()) || n.description?.toLowerCase().includes(search.toLowerCase())),
  })).filter(cat => cat.nodes.length > 0);

  return (
    <div className="w-72 bg-slate-900/95 backdrop-blur-sm border-r border-cyan-500/20 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center"><Cpu className="w-3.5 h-3.5 text-white"/></div>
            <h2 className="text-white font-bold text-sm">Node Library</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-slate-800"><EyeOff className="w-4 h-4"/></button>
        </div>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500/50"/>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {filtered.map((cat) => (
          <div key={cat.category}>
            <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">{cat.category}</h3>
            <div className="space-y-1.5">
              {cat.nodes.map((node, i) => {
                const Icon = resolveIcon(node.icon);
                return (
                  <button key={i} onClick={() => onAdd(node)}
                    className={`w-full bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 text-left transition-all ${HBDR[node.color] || 'hover:border-cyan-400'} hover:bg-slate-800 group`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`${BG[node.color] || 'bg-slate-600'} p-1.5 rounded-lg group-hover:scale-110 transition-transform`}>
                        <Icon className="text-white w-4 h-4"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold">{node.label}</p>
                        <p className="text-slate-500 text-[10px] truncate">{node.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════ Config Field Renderer ══════════════════════ */
const ConfigField = ({ name, field, onChange }) => {
  const label = (
    <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider mb-1 block">{name}</label>
  );

  if (field.type === 'select') {
    return (
      <div>
        {label}
        <select value={field.value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50">
          {field.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center justify-between">
        {label}
        <button onClick={() => onChange(!field.value)}
          className={`relative w-10 h-5 rounded-full transition-colors ${field.value ? 'bg-cyan-500' : 'bg-slate-700'}`}>
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${field.value ? 'translate-x-5' : 'translate-x-0.5'}`}/>
        </button>
      </div>
    );
  }

  if (field.type === 'slider') {
    return (
      <div>
        <div className="flex items-center justify-between">
          <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">{name}</label>
          <span className="text-cyan-400 text-xs font-mono font-bold">{field.value}%</span>
        </div>
        <input type="range" min={field.min || 0} max={field.max || 100} value={field.value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="w-full accent-cyan-500 mt-1"/>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {label}
        <textarea rows={3} value={field.value} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50 resize-none"/>
      </div>
    );
  }

  if (field.type === 'code') {
    return (
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">{name}</label>
          <span className="text-[9px] text-slate-600 font-mono">{field.language}</span>
        </div>
        <textarea rows={4} value={field.value} onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-green-400 text-xs font-mono focus:outline-none focus:border-cyan-500/50 resize-none"/>
      </div>
    );
  }

  // default: text
  return (
    <div>
      {label}
      <input type="text" value={field.value} onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || ''}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"/>
    </div>
  );
};

/* ══════════════════════ Node Config Sidebar ══════════════════════ */
const NodeConfig = ({ node, onDelete, onUpdateLabel, onUpdateConfigValue }) => {
  const Icon = resolveIcon(node.icon);
  return (
    <div className="w-80 bg-slate-900/95 backdrop-blur-sm border-l border-cyan-500/20 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">Node Configuration</h3>
          <button onClick={() => onDelete(node.id)}
            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5"/>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* header */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className={`${BG[node.color] || 'bg-slate-600'} p-2.5 rounded-lg`}>
              <Icon className="text-white w-5 h-5"/>
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{node.label}</p>
              <p className="text-slate-500 text-[10px] font-mono uppercase tracking-wider">{node.type}</p>
            </div>
          </div>
        </div>

        {/* name */}
        <div>
          <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider mb-1 block">Node Name</label>
          <input type="text" value={node.label} onChange={(e) => onUpdateLabel(node.id, e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-cyan-500/50"/>
        </div>

        {/* dynamic config fields */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 space-y-3">
          <h4 className="text-white text-xs font-semibold">Settings</h4>
          {Object.entries(node.config).map(([key, field]) => (
            <ConfigField key={key} name={key} field={field}
              onChange={(val) => onUpdateConfigValue(node.id, key, val)}/>
          ))}
        </div>

        <button className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all">
          <Play className="w-3.5 h-3.5"/> Test This Node
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════ MiniMap ══════════════════════ */
const MiniMap = ({ nodes }) => {
  if (nodes.length === 0) return null;
  return (
    <div className="absolute bottom-14 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg p-2 w-44 h-28 z-20">
      <div className="relative w-full h-full bg-slate-900/80 rounded overflow-hidden">
        {nodes.map(n => (
          <div key={n.id} className={`absolute rounded-sm ${DOT[n.color] || 'bg-slate-400'}`}
            style={{ left: `${Math.min(95, (n.x / 1200) * 100)}%`, top: `${Math.min(95, (n.y / 600) * 100)}%`, width: 8, height: 6 }}/>
        ))}
      </div>
    </div>
  );
};

/* ══════════════════════ Achievement Toast ══════════════════════ */
const AchievementToast = ({ achievement }) => {
  if (!achievement) return null;
  return (
    <div className="fixed top-20 right-6 z-50 animate-slide-in">
      <div className="bg-slate-900/95 border-2 border-purple-500/60 rounded-xl p-4 shadow-2xl shadow-purple-500/20 flex items-center gap-3 min-w-[280px]">
        <div className="text-3xl">{achievement.icon}</div>
        <div>
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-purple-400"/>
            <span className="text-purple-400 text-[10px] font-mono uppercase tracking-wider">Achievement Unlocked!</span>
          </div>
          <p className="text-white font-bold text-sm">{achievement.name}</p>
          <p className="text-slate-400 text-[10px]">{achievement.description} • +{achievement.xp} XP</p>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════ AI Mapping Suggestions Panel ══════════════════════ */
const AIMappingPanel = ({ onClose }) => {
  const [sourceFields, setSourceFields] = useState('BEG.3, N1.2, IT1.7, IT1.4, TDS.1');
  const [docType, setDocType] = useState('850');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [error, setError] = useState(null);

  const getSuggestions = async () => {
    setLoading(true);
    setError(null);
    setSuggestions(null);
    try {
      const fields = sourceFields.split(',').map(f => f.trim()).filter(Boolean);
      const res = await api.post('/mappings/suggest', {
        source_fields: fields,
        document_type: docType,
        standard: 'X12',
      });
      setSuggestions(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Suggestion request failed');
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = (c) => {
    if (c >= 0.85) return 'text-cyan-400';
    if (c >= 0.65) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="absolute top-0 right-0 w-96 h-full bg-slate-900/98 backdrop-blur-sm border-l border-purple-500/30 z-40 flex flex-col shadow-2xl shadow-purple-500/10">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white"/>
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">AI Mapping Suggestions</h3>
            <p className="text-slate-500 text-[10px] font-mono">text-embedding-3-small + GPT-4o</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
          <X className="w-4 h-4"/>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider mb-1 block">Source EDI Fields (comma-separated)</label>
          <textarea
            value={sourceFields}
            onChange={(e) => setSourceFields(e.target.value)}
            rows={3}
            placeholder="BEG.3, N1.2, IT1.7..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50 resize-none"
          />
        </div>

        <div>
          <label className="text-slate-400 text-[10px] font-mono uppercase tracking-wider mb-1 block">Transaction Set</label>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50"
          >
            {['850','856','810','855','997'].map(t => (
              <option key={t} value={t}>X12 {t}</option>
            ))}
          </select>
        </div>

        <button
          onClick={getSuggestions}
          disabled={loading || !sourceFields.trim()}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-xs font-bold hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 transition-all shadow-lg shadow-purple-500/20"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Sparkles className="w-3.5 h-3.5"/>}
          {loading ? 'Generating...' : 'Get AI Suggestions'}
        </button>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0"/>
            <span className="text-red-400 text-xs">{error}</span>
          </div>
        )}

        {suggestions && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-slate-400 text-[10px] font-mono uppercase tracking-wider">Suggestions</p>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                {suggestions.method || 'ai'}
              </span>
            </div>
            {suggestions.suggestions?.map((s, i) => (
              <div key={i} className="bg-slate-800/60 border border-slate-700/40 rounded-lg p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-mono font-semibold">{s.source_field}</span>
                  <span className={`text-xs font-mono font-bold ${confidenceColor(s.confidence)}`}>
                    {(s.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3 text-purple-400 flex-shrink-0"/>
                  <span className="text-purple-300 text-xs font-mono">{s.suggested_target}</span>
                </div>
                {s.alternatives?.length > 0 && (
                  <div className="text-slate-500 text-[10px] font-mono">
                    Alt: {s.alternatives[0].field} ({(s.alternatives[0].confidence * 100).toFixed(0)}%)
                  </div>
                )}
                <div className="text-slate-600 text-[9px] font-mono truncate">{s.reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */
const Mapper = () => {
  const {
    nodes, connections, selectedNode, isExecuting, executionResults,
    showNodeLibrary, zoom, connectingFrom, recentAchievement,
    score, level, experience, accuracy, workflowsRun, streak, achievements,
    setSelectedNode, setShowNodeLibrary, setZoom, setConnectingFrom,
    addNode, deleteNode, updateNodePosition, updateNodeLabel, updateNodeConfigValue,
    addConnection, executeWorkflow, saveWorkflow, resetCanvas, resetToDefault,
  } = useMapperStore();

  const canvasRef  = useRef(null);
  const dragRef    = useRef({ active: false, nodeId: null, offsetX: 0, offsetY: 0 });
  const [saveMsg, setSaveMsg] = useState(null);
  const [showAIMapping, setShowAIMapping] = useState(false);

  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg') {
      setSelectedNode(null);
      if (connectingFrom) setConnectingFrom(null);
    }
  }, [setSelectedNode, connectingFrom, setConnectingFrom]);

  const handleNodeDragStart = useCallback((e, nodeId) => {
    if (connectingFrom) return;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const rect = canvasRef.current.getBoundingClientRect();
    dragRef.current = { active: true, nodeId, offsetX: e.clientX - rect.left - node.x * zoom, offsetY: e.clientY - rect.top - node.y * zoom };
  }, [nodes, zoom, connectingFrom]);

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current.active) return;
    const rect = canvasRef.current.getBoundingClientRect();
    updateNodePosition(dragRef.current.nodeId, (e.clientX - rect.left - dragRef.current.offsetX) / zoom, (e.clientY - rect.top - dragRef.current.offsetY) / zoom);
  }, [zoom, updateNodePosition]);

  const handleMouseUp = useCallback(() => { dragRef.current.active = false; }, []);

  const handlePortDragStart = useCallback((nodeId) => { setConnectingFrom(nodeId); }, [setConnectingFrom]);
  const handlePortDrop = useCallback((nodeId) => { if (connectingFrom && connectingFrom !== nodeId) { addConnection(connectingFrom, nodeId); } setConnectingFrom(null); }, [connectingFrom, addConnection, setConnectingFrom]);

  const handleSave = () => {
    saveWorkflow();
    setSaveMsg('Workflow saved!');
    setTimeout(() => setSaveMsg(null), 2000);
  };

  const exportWorkflow = () => {
    const config = { version: '1.0', nodes: nodes.map(({ ...n }) => n), connections, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'edi-workflow.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const expProgress = experience % 100;

  return (
    <div className="w-full h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
      <AchievementToast achievement={recentAchievement}/>

      {/* ── Toolbar ── */}
      <div className="bg-slate-900/90 backdrop-blur-sm border-b border-cyan-500/20 px-4 py-2.5 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-3">
          {!showNodeLibrary && (
            <button onClick={() => setShowNodeLibrary(true)}
              className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-cyan-500/40 transition-all">
              <Eye className="w-4 h-4"/>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
              <Zap className="w-4 h-4 text-white"/>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm tracking-tight">EDI Workflow Builder</h1>
              <p className="text-slate-500 text-[10px] font-mono">Visual Pipeline • Drag & Connect</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-4">
            <button onClick={handleSave} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-[11px] font-medium hover:border-cyan-500/40 transition-all relative">
              <Save className="w-3 h-3"/> Save
              {saveMsg && <span className="absolute -bottom-6 left-0 text-green-400 text-[10px] font-mono whitespace-nowrap">{saveMsg}</span>}
            </button>
            <button onClick={exportWorkflow} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-[11px] font-medium hover:border-cyan-500/40 transition-all">
              <Download className="w-3 h-3"/> Export
            </button>
            <button onClick={resetToDefault} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg text-[11px] font-medium hover:border-slate-500 transition-all">
              <RotateCcw className="w-3 h-3"/> Reset
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-purple-500/20 to-purple-700/20 rounded-lg border border-purple-500/30">
              <Trophy className="w-3 h-3 text-purple-400"/>
              <span className="text-purple-400 font-mono text-[11px] font-bold">Lv {level}</span>
              <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden ml-1">
                <div className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full transition-all" style={{ width: `${expProgress}%` }}/>
              </div>
              <span className="text-purple-300/60 text-[9px] font-mono">{experience} XP</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 rounded-lg border border-slate-700/50">
              <Target className="w-3 h-3 text-cyan-400"/>
              <span className="text-cyan-400 font-mono text-[11px] font-bold">{accuracy}%</span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 rounded-lg border border-slate-700/50">
              <Activity className="w-3 h-3 text-purple-400"/>
              <span className="text-purple-400 font-mono text-[11px] font-bold">{streak} streak</span>
            </div>
            {Object.keys(achievements).length > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800/80 rounded-lg border border-purple-500/30">
                <Award className="w-3 h-3 text-purple-400"/>
                <span className="text-purple-400 font-mono text-[11px] font-bold">{Object.keys(achievements).length}</span>
              </div>
            )}
        </div>

          <button onClick={() => setShowAIMapping(v => !v)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${showAIMapping ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-purple-500/40 hover:text-white'}`}>
            <Sparkles className="w-3.5 h-3.5"/> AI Suggest
          </button>
          <button onClick={executeWorkflow} disabled={isExecuting || nodes.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-xs font-bold hover:from-cyan-400 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20">
            {isExecuting ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Play className="w-3.5 h-3.5"/>}
            {isExecuting ? 'Executing...' : 'Execute Workflow'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0">
        {showNodeLibrary && <NodeLibrary onAdd={(tpl) => addNode(tpl, 300 + Math.random() * 200, 200 + Math.random() * 150)} onClose={() => setShowNodeLibrary(false)}/>}

        {/* Canvas */}
        <div ref={canvasRef}
          className={`flex-1 relative overflow-auto ${connectingFrom ? 'cursor-crosshair' : 'cursor-default'}`}
          style={{ backgroundImage: 'radial-gradient(circle, rgba(6,182,212,0.08) 1px, transparent 1px)', backgroundSize: '32px 32px' }}
          onMouseDown={handleCanvasMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

          {connectingFrom && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-purple-500/20 border border-purple-500/40 rounded-lg px-3 py-1">
              <p className="text-purple-400 text-[10px] font-mono">Click an input port (cyan dot) on another node to connect</p>
            </div>
          )}

          <Connections nodes={nodes} connections={connections} executionResults={executionResults}/>

          <div className="relative" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', zIndex: 2, minWidth: 1400, minHeight: 700 }}>
            {nodes.map((node) => (
              <WorkflowNode key={node.id} node={node}
                isSelected={selectedNode?.id === node.id}
                executionResult={executionResults[node.id]}
                onSelect={setSelectedNode}
                onDragStart={handleNodeDragStart}
                onPortDragStart={handlePortDragStart}
                onPortDrop={handlePortDrop}/>
            ))}
                </div>

          <MiniMap nodes={nodes}/>

          {/* Zoom */}
          <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-lg p-1.5 flex items-center gap-1 z-20">
            <button onClick={() => setZoom(zoom - 0.1)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><Minimize2 className="w-3.5 h-3.5"/></button>
            <span className="text-white text-[10px] font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(zoom + 0.1)} className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"><Maximize2 className="w-3.5 h-3.5"/></button>
                </div>

          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-800 border-2 border-dashed border-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-slate-600"/>
                </div>
                <h3 className="text-white text-lg font-bold mb-1">Start Building Your Workflow</h3>
                <p className="text-slate-500 text-sm mb-4">Drag nodes from the library to create your EDI transformation</p>
                <button onClick={resetToDefault}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 transition-all">
                  Load Sample Workflow
                </button>
              </div>
                  </div>
                )}
                </div>

        {selectedNode && !showAIMapping && <NodeConfig node={selectedNode} onDelete={deleteNode} onUpdateLabel={updateNodeLabel} onUpdateConfigValue={updateNodeConfigValue}/>}
        {showAIMapping && <AIMappingPanel onClose={() => setShowAIMapping(false)}/>}
          </div>
    </div>
  );
};

export default Mapper;
