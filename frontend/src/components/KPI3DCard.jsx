import React, { useState, useMemo, memo } from 'react';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const KPI3DCard = memo(({ title, value, subtitle, trend, trendValue, variant = 'default', icon: Icon, description, details }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };
  
  const getTrendColor = () => {
    if (trend === 'up') return 'text-emerald-500';
    if (trend === 'down') return 'text-red-500';
    return 'text-slate-400';
  };
  
  const getCardColors = () => {
    switch (variant) {
      case 'warning':
        return { iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500', border: 'border-amber-500/20' };
      case 'success':
        return { iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500', border: 'border-emerald-500/20' };
      case 'error':
        return { iconBg: 'bg-red-500/10', iconColor: 'text-red-500', border: 'border-red-500/20' };
      default:
        return { iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500', border: 'border-blue-500/20' };
    }
  };
  
  const colors = useMemo(() => getCardColors(), [variant]);
  
  return (
    <>
      <div
        className="relative w-full rounded-xl border border-slate-700/80 bg-slate-900/80 p-6 cursor-pointer hover:border-slate-600 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{title}</p>
            <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
            {trendValue && (
              <div className={`flex items-center gap-1 mt-2 text-sm font-medium ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.iconColor}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </div>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border border-slate-700">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg ${colors.iconBg} flex items-center justify-center ${colors.iconColor}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold text-white">{title}</DialogTitle>
                <p className="text-sm text-slate-400">{description || subtitle}</p>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="text-center">
              <h2 className="text-4xl font-bold text-white mb-2">{value}</h2>
              {trendValue && (
                <div className={`flex items-center justify-center gap-2 text-lg font-medium ${getTrendColor()}`}>
                  {getTrendIcon()}
                  <span>{trendValue}</span>
                </div>
              )}
            </div>
            {details && details.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {details.map((detail, index) => (
                  <div key={index} className="p-4 rounded-lg bg-slate-800/80 border border-slate-700">
                    <p className="text-xs text-slate-400 uppercase mb-1">{detail.label}</p>
                    <p className="text-lg font-semibold text-white">{detail.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

KPI3DCard.displayName = 'KPI3DCard';
