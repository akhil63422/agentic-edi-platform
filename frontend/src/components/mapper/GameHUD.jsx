import React from 'react';
import { Trophy, Zap, Target, Star, TrendingUp } from 'lucide-react';
import { useMapperStore } from '../../store/mapperStore';

export const GameHUD = () => {
  const { score, level, experience, accuracy, totalMappings, badges, errorFreeRuns } = useMapperStore();
  const expProgress = (experience % 100);

  return (
    <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-xs text-cyan-400 font-mono uppercase tracking-widest">Level {level}</div>
            <div className="text-white font-bold text-sm">Mapping Commander</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-cyan-400 font-mono text-lg font-bold">{score}</div>
          <div className="text-xs text-slate-400 font-mono">XP</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1 font-mono">
          <span>EXP</span>
          <span>{expProgress}/100</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-cyan-900/50">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${expProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/50">
          <Target className="w-3.5 h-3.5 text-green-400 mx-auto mb-1" />
          <div className="text-green-400 font-mono text-sm font-bold">{accuracy}%</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Accuracy</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/50">
          <Zap className="w-3.5 h-3.5 text-yellow-400 mx-auto mb-1" />
          <div className="text-yellow-400 font-mono text-sm font-bold">{totalMappings}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Maps</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/50">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400 mx-auto mb-1" />
          <div className="text-cyan-400 font-mono text-sm font-bold">{errorFreeRuns}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Streak</div>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 text-center border border-slate-700/50">
          <Star className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
          <div className="text-purple-400 font-mono text-sm font-bold">{badges.length}</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider">Badges</div>
        </div>
      </div>
    </div>
  );
};
