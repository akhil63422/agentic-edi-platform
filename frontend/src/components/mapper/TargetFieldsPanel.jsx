import React from 'react';
import { FileOutput, GripVertical } from 'lucide-react';
import { useMapperStore } from '../../store/mapperStore';

const typeColors = {
  string: 'text-green-400 bg-green-500/10 border-green-500/30',
  date: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  number: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  decimal: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
};

export const TargetFieldsPanel = ({ onDrop, onDragOver }) => {
  const { targetFields, mappings } = useMapperStore();

  const isMapped = (fieldId) => mappings.some(m => m.targetId === fieldId);
  const getSourceForTarget = (targetId) => {
    const mapping = mappings.find(m => m.targetId === targetId);
    return mapping?.sourceId || null;
  };

  return (
    <div className="bg-slate-900/80 border border-purple-500/30 rounded-xl backdrop-blur-sm flex flex-col h-full">
      <div className="p-3 border-b border-purple-500/20">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
            <FileOutput className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Target Fields</h3>
            <p className="text-xs text-slate-400 font-mono">Canonical Format</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {targetFields.map((field) => {
          const mapped = isMapped(field.id);
          const sourceId = getSourceForTarget(field.id);
          return (
            <div
              key={field.id}
              onDrop={(e) => onDrop(e, field)}
              onDragOver={onDragOver}
              className={`group p-2.5 rounded-lg border transition-all duration-200
                ${mapped
                  ? 'bg-purple-500/10 border-purple-500/40 shadow-sm shadow-purple-500/10'
                  : 'bg-slate-800/60 border-slate-700/50 hover:border-purple-500/40 hover:bg-slate-800/80 border-dashed'
                }`}
            >
              <div className="flex items-center gap-2">
                <GripVertical className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-xs font-semibold">{field.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${typeColors[field.type] || typeColors.string}`}>
                      {field.type}
                    </span>
                    {mapped && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        linked
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">{field.description}</div>
                  {mapped && sourceId && (
                    <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                      ← {sourceId}
                    </div>
                  )}
                  {!mapped && (
                    <div className="text-[10px] text-slate-600 mt-0.5 italic">Drop source field here</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
