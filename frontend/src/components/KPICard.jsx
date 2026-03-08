import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

export const KPICard = ({ title, value, subtitle, trend, trendValue, variant = 'default', icon: Icon }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };
  
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-400';
    if (trend === 'down') return 'text-red-400';
    return 'text-cyan-400/70';
  };
  
  const getCardStyle = () => {
    if (variant === 'warning') return 'border-2 border-yellow-500/50 bg-yellow-500/10 shadow-lg shadow-yellow-500/20';
    if (variant === 'success') return 'border-2 border-green-500/50 bg-green-500/10 shadow-lg shadow-green-500/20';
    if (variant === 'error') return 'border-2 border-red-500/50 bg-red-500/10 shadow-lg shadow-red-500/20';
    return 'border-2 border-cyan-500/30 bg-black/40 shadow-lg shadow-cyan-500/10';
  };
  
  const getIconBg = () => {
    if (variant === 'warning') return 'bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border-yellow-500/50';
    if (variant === 'success') return 'bg-gradient-to-br from-green-500/20 to-green-600/20 border-green-500/50';
    if (variant === 'error') return 'bg-gradient-to-br from-red-500/20 to-red-600/20 border-red-500/50';
    return 'bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border-cyan-500/50';
  };
  
  const getIconColor = () => {
    if (variant === 'warning') return 'text-yellow-400';
    if (variant === 'success') return 'text-green-400';
    if (variant === 'error') return 'text-red-400';
    return 'text-cyan-400';
  };
  
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className={`${getCardStyle()} transition-all duration-200 backdrop-blur-sm`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs font-mono font-bold text-cyan-400/70 mb-2 uppercase tracking-wider">{title}</p>
              <div className="flex items-baseline space-x-2">
                <h3 className="text-3xl font-bold text-white">{value}</h3>
                {trendValue && (
                  <div className={`flex items-center space-x-1 text-sm font-bold font-mono ${getTrendColor()}`}>
                    {getTrendIcon()}
                    <span>{trendValue}</span>
                  </div>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-purple-300/70 mt-2 font-mono">{subtitle}</p>
              )}
            </div>
            {Icon && (
              <motion.div 
                className={`ml-4 p-3 rounded-lg border-2 ${getIconBg()}`}
                animate={{ 
                  boxShadow: [
                    '0 0 10px rgba(6, 182, 212, 0.3)',
                    '0 0 20px rgba(168, 85, 247, 0.3)',
                    '0 0 10px rgba(6, 182, 212, 0.3)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Icon className={`w-6 h-6 ${getIconColor()}`} />
              </motion.div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
