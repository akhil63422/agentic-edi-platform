import React, { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const KPI3DCard = memo(({ title, value, subtitle, trend, trendValue, variant = 'default', icon: Icon, description, details }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-5 h-5" />;
    if (trend === 'down') return <TrendingDown className="w-5 h-5" />;
    return <Minus className="w-5 h-5" />;
  };
  
  const getTrendColor = () => {
    if (trend === 'up') return 'text-green-400';
    if (trend === 'down') return 'text-red-400';
    return 'text-cyan-400/70';
  };
  
  const getCardColors = () => {
    switch (variant) {
      case 'warning':
        return {
          border: 'border-yellow-500/70',
          glow: 'shadow-yellow-500/50',
          iconBg: 'from-yellow-500/30 to-amber-500/30',
          iconBorder: 'border-yellow-500/50',
          iconColor: 'text-yellow-400',
          gradient: 'from-yellow-600/20 to-amber-600/20',
        };
      case 'success':
        return {
          border: 'border-green-500/70',
          glow: 'shadow-green-500/50',
          iconBg: 'from-green-500/30 to-emerald-500/30',
          iconBorder: 'border-green-500/50',
          iconColor: 'text-green-400',
          gradient: 'from-green-600/20 to-emerald-600/20',
        };
      case 'error':
        return {
          border: 'border-red-500/70',
          glow: 'shadow-red-500/50',
          iconBg: 'from-red-500/30 to-pink-500/30',
          iconBorder: 'border-red-500/50',
          iconColor: 'text-red-400',
          gradient: 'from-red-600/20 to-pink-600/20',
        };
      default:
        return {
          border: 'border-cyan-500/70',
          glow: 'shadow-cyan-500/50',
          iconBg: 'from-cyan-500/30 to-blue-500/30',
          iconBorder: 'border-cyan-500/50',
          iconColor: 'text-cyan-400',
          gradient: 'from-cyan-600/20 to-blue-600/20',
        };
    }
  };
  
  const colors = useMemo(() => getCardColors(), [variant]);
  
  return (
    <>
      <motion.div
        className="relative cursor-pointer"
        whileHover={{ scale: 1.05, z: 50 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        style={{ perspective: '1000px' }}
      >
        {/* 3D Card Container */}
        <motion.div
          className="relative w-full h-48 rounded-xl overflow-hidden"
          style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          whileHover={{ rotateY: 5, rotateX: -5 }}
          transition={{ duration: 0.2 }}
        >
          {/* Card Background with Gradient */}
          <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} border-2 ${colors.border} rounded-xl`} />
          
          {/* Glow Effect - Reduced animation */}
          <div className={`absolute inset-0 rounded-xl ${colors.glow} shadow-2xl opacity-60`} />
          
          {/* Animated Grid Pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.3) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.3) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px',
            }}
          />
          
          {/* Content */}
          <div className="relative z-10 h-full flex items-center p-6">
            {/* Left Side - Content */}
            <div className="flex-1 flex flex-col justify-between h-full">
              {/* Title */}
              <div>
                <p className="text-xs font-mono font-black text-cyan-300/80 uppercase tracking-wider mb-4">
                  {title}
                </p>
              </div>
              
              {/* Value, Description, Trend, and Click Indicator */}
              <div className="space-y-3">
                {/* Main Value */}
                <h3 className="text-6xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono leading-none">
                  {value}
                </h3>
                
                {/* Description */}
                {subtitle && (
                  <p className="text-sm text-purple-300/70 font-mono">{subtitle}</p>
                )}
                
                {/* Trend and Click Indicator */}
                <div className="flex items-center gap-4 mt-4">
                  {trendValue && (
                    <div className={`flex items-center space-x-1 text-lg font-black font-mono ${getTrendColor()}`}>
                      {getTrendIcon()}
                      <span>{trendValue}</span>
                    </div>
                  )}
                  <div className="text-xs text-cyan-400/70 font-mono flex items-center gap-1">
                    CLICK →
                  </div>
                </div>
              </div>
            </div>
            
            {/* Right Side - 3D Icon */}
            <div className="flex-shrink-0 ml-6">
              <motion.div
                className={`relative w-36 h-36 rounded-2xl bg-gradient-to-br ${colors.iconBg} border-2 ${colors.iconBorder} flex items-center justify-center shadow-2xl`}
                style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
                whileHover={{ 
                  rotateY: 15,
                  rotateX: 15,
                  scale: 1.1,
                }}
                transition={{ duration: 0.2 }}
              >
                {/* Icon Glow - Static for performance */}
                <div className={`absolute inset-0 rounded-2xl ${colors.glow} opacity-30`} />
                
                {/* Icon */}
                <Icon className={`w-20 h-20 ${colors.iconColor} relative z-10 drop-shadow-2xl`} />
                
                {/* 3D Depth Effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      
      {/* 3D Popup Modal */}
      <AnimatePresence>
        {isOpen && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent className="max-w-4xl bg-gradient-to-br from-slate-900 via-blue-950 to-black border-2 border-cyan-500/50 p-0 overflow-hidden">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotateY: -20 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotateY: 20 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                style={{ transformStyle: 'preserve-3d' }}
                className="relative"
              >
                {/* Background Glow */}
                <motion.div
                  className={`absolute inset-0 ${colors.glow} blur-3xl opacity-50`}
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                
                {/* Header */}
                <DialogHeader className="p-8 border-b-2 border-cyan-500/30 bg-black/40 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Large 3D Icon */}
                      <motion.div
                        className={`relative w-24 h-24 rounded-2xl bg-gradient-to-br ${colors.iconBg} border-2 ${colors.iconBorder} flex items-center justify-center shadow-2xl`}
                        animate={isOpen ? {
                          rotateY: [0, 360],
                        } : {}}
                        transition={isOpen ? {
                          rotateY: { duration: 10, repeat: Infinity, ease: "linear" }
                        } : { duration: 0 }}
                        style={{ willChange: 'transform' }}
                      >
                        <div className={`absolute inset-0 rounded-2xl ${colors.glow} opacity-50`} />
                        <Icon className={`w-12 h-12 ${colors.iconColor} relative z-10`} />
                      </motion.div>
                      
                      <div>
                        <DialogTitle className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono uppercase">
                          {title}
                        </DialogTitle>
                        <p className="text-cyan-300/70 mt-1 font-mono">{description || subtitle}</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsOpen(false)}
                      className="hover:bg-red-500/20 border-2 border-red-500/30 text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </DialogHeader>
                
                {/* Content */}
                <div className="p-8 relative z-10">
                  {/* Main Metric Display */}
                  <div className="text-center mb-8">
                    <motion.div
                      className="inline-block"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    >
                      <h2 className="text-7xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono mb-4">
                        {value}
                      </h2>
                    </motion.div>
                    
                    {trendValue && (
                      <motion.div
                        className={`flex items-center justify-center space-x-2 text-2xl font-black font-mono ${getTrendColor()}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        {getTrendIcon()}
                        <span>{trendValue}</span>
                      </motion.div>
                    )}
                  </div>
                  
                  {/* Details Section */}
                  {details && (
                    <motion.div
                      className="grid grid-cols-2 gap-4 mt-8"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      {details.map((detail, index) => (
                        <motion.div
                          key={index}
                          className="p-4 rounded-lg bg-black/40 border-2 border-cyan-500/30"
                          whileHover={{ scale: 1.05, borderColor: 'rgba(6, 182, 212, 0.6)' }}
                        >
                          <p className="text-xs font-mono text-cyan-400/70 uppercase mb-1">
                            {detail.label}
                          </p>
                          <p className="text-lg font-bold text-cyan-300 font-mono">
                            {detail.value}
                          </p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                  
                  {/* Additional Info */}
                  <motion.div
                    className="mt-8 p-6 rounded-lg bg-gradient-to-r from-cyan-600/10 to-purple-600/10 border-2 border-cyan-500/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 }}
                  >
                    <p className="text-sm text-cyan-300/80 font-mono leading-relaxed">
                      {description || `Detailed information about ${title.toLowerCase()}. This metric represents important operational data for your EDI platform.`}
                    </p>
                  </motion.div>
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
});

KPI3DCard.displayName = 'KPI3DCard';
