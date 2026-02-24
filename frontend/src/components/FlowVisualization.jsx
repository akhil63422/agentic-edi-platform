import React, { useState, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Package, Brain, FileJson, FileText, ArrowRight, X, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const FlowVisualization = memo(() => {
  const [selectedStep, setSelectedStep] = useState(null);
  
  const flowSteps = [
    { 
      icon: Cloud, 
      label: 'SFTP/S3', 
      description: 'Inbound Files',
      color: 'cyan',
      gradient: 'from-blue-500/30 to-cyan-500/30',
      border: 'border-blue-500/70',
      glow: 'shadow-blue-500/50',
      iconColor: 'text-blue-400',
      details: 'Secure file transfer protocol for receiving EDI documents from trading partners',
      stats: [
        { label: 'Files Received', value: '1,234' },
        { label: 'Avg Size', value: '2.4 MB' },
        { label: 'Success Rate', value: '99.8%' },
      ]
    },
    { 
      icon: Package, 
      label: 'EDI Parser', 
      description: 'X12/EDIFACT',
      color: 'purple',
      gradient: 'from-purple-500/30 to-pink-500/30',
      border: 'border-purple-500/70',
      glow: 'shadow-purple-500/50',
      iconColor: 'text-purple-400',
      details: 'Intelligent parsing engine that extracts structured data from EDI formats',
      stats: [
        { label: 'Documents Parsed', value: '1,198' },
        { label: 'Parse Time', value: '0.8s' },
        { label: 'Accuracy', value: '99.5%' },
      ]
    },
    { 
      icon: Brain, 
      label: 'Agentic AI', 
      description: 'Smart Processing',
      color: 'gradient',
      gradient: 'from-cyan-500/40 via-purple-500/40 to-pink-500/40',
      border: 'border-cyan-500/70',
      glow: 'shadow-cyan-500/70',
      iconColor: 'text-white',
      highlight: true,
      details: 'Advanced AI agent that intelligently processes, validates, and routes EDI documents',
      stats: [
        { label: 'AI Decisions', value: '9,213' },
        { label: 'Confidence', value: '98.2%' },
        { label: 'Auto-Resolved', value: '87%' },
      ]
    },
    { 
      icon: FileJson, 
      label: 'Canonical JSON', 
      description: 'Normalized Data',
      color: 'green',
      gradient: 'from-green-500/30 to-emerald-500/30',
      border: 'border-green-500/70',
      glow: 'shadow-green-500/50',
      iconColor: 'text-green-400',
      details: 'Standardized JSON format that normalizes data from various EDI standards',
      stats: [
        { label: 'JSON Generated', value: '1,156' },
        { label: 'Schema Version', value: 'v2.1' },
        { label: 'Compliance', value: '100%' },
      ]
    },
    { 
      icon: FileText, 
      label: 'ERP Integration', 
      description: 'Business System',
      color: 'orange',
      gradient: 'from-orange-500/30 to-amber-500/30',
      border: 'border-orange-500/70',
      glow: 'shadow-orange-500/50',
      iconColor: 'text-orange-400',
      details: 'Seamless integration with enterprise resource planning systems',
      stats: [
        { label: 'ERP Syncs', value: '1,145' },
        { label: 'Sync Time', value: '1.2s' },
        { label: 'Success Rate', value: '99.9%' },
      ]
    },
  ];
  
  return (
    <>
      <Card className="bg-black/60 border-2 border-cyan-500/30 shadow-2xl shadow-cyan-500/10">
        <CardHeader className="border-b-2 border-cyan-500/30 bg-black/60">
          <CardTitle className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono uppercase">
            AGENTIC EDI FLOW
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="relative">
            {/* Flow steps */}
            <div className="relative flex items-start justify-between">
              {flowSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <React.Fragment key={index}>
                    <motion.div 
                      className="flex flex-col items-center cursor-pointer relative z-10"
                      style={{ width: '18%' }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setSelectedStep(step)}
                    >
                      {/* 3D Icon Container - Optimized */}
                      <motion.div
                        className={`relative w-28 h-28 rounded-2xl bg-gradient-to-br ${step.gradient} border-2 ${step.border} flex items-center justify-center shadow-2xl ${step.glow} overflow-hidden`}
                        style={{ willChange: 'transform' }}
                        animate={step.highlight ? {
                          rotateY: [0, 360],
                        } : {}}
                        transition={step.highlight ? {
                          rotateY: { duration: 8, repeat: Infinity, ease: "linear" }
                        } : { duration: 0 }}
                        whileHover={{
                          scale: 1.1,
                        }}
                      >
                        {/* Static Glow Effect */}
                        <div className={`absolute inset-0 rounded-2xl ${step.glow} opacity-30`} />
                        
                        {/* Inner Glow Ring - Static */}
                        <div className={`absolute inset-2 rounded-xl border-2 ${step.border} opacity-40`} />
                        
                        {/* Icon */}
                        <div className="relative z-10">
                          <Icon className={`w-14 h-14 ${step.iconColor} drop-shadow-2xl`} />
                        </div>
                        
                        {/* AI Badge for Agentic AI - Static */}
                        {step.highlight && (
                          <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center border-2 border-yellow-400 shadow-lg shadow-yellow-500/70 z-20">
                            <Zap className="w-4 h-4 text-white" />
                          </div>
                        )}
                        
                        {/* 3D Depth Effect */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-transparent to-transparent" />
                      </motion.div>
                      
                      {/* Label */}
                      <div className="mt-6 text-center">
                        <p className={`text-sm font-black font-mono uppercase tracking-wide ${step.highlight ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : 'text-cyan-300'}`}>
                          {step.label}
                        </p>
                        <p className="text-xs text-purple-300/70 mt-1 font-mono">{step.description}</p>
                      </div>
                      
                      {/* Click Indicator */}
                      <div className="absolute -bottom-6 text-xs text-cyan-400/50 font-mono">
                        CLICK
                      </div>
                    </motion.div>
                    
                    {/* Static Arrow - positioned between steps */}
                    {index < flowSteps.length - 1 && (
                      <div
                        className="absolute top-14 -translate-x-1/2 z-0"
                        style={{ 
                          // Position arrows evenly between items
                          // With justify-between, items are distributed evenly
                          // Arrows at: 20%, 40%, 60%, 80% (midpoints between 5 evenly spaced items)
                          left: `${((index + 1) * 100) / flowSteps.length}%`
                        }}
                      >
                        <ArrowRight className="w-8 h-8 text-cyan-400 drop-shadow-lg opacity-70" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* 3D Popup Modal */}
      <AnimatePresence>
        {selectedStep && (
          <Dialog open={!!selectedStep} onOpenChange={() => setSelectedStep(null)}>
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
                  className={`absolute inset-0 ${selectedStep.glow} blur-3xl opacity-50`}
                  animate={{
                    scale: [1, 1.1, 1],
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
                
                {/* Header */}
                <DialogHeader className="p-8 border-b-2 border-cyan-500/30 bg-black/40 relative z-10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      {/* Large 3D Icon */}
                      <motion.div
                        className={`relative w-32 h-32 rounded-3xl bg-gradient-to-br ${selectedStep.gradient} border-2 ${selectedStep.border} flex items-center justify-center shadow-2xl`}
                        animate={selectedStep.highlight ? {
                          rotateY: [0, 360],
                        } : {}}
                        transition={selectedStep.highlight ? {
                          rotateY: { duration: 10, repeat: Infinity, ease: "linear" }
                        } : { duration: 0 }}
                        style={{ willChange: 'transform' }}
                      >
                        <div className={`absolute inset-0 rounded-3xl ${selectedStep.glow} opacity-50`} />
                        {selectedStep.icon && (
                          <selectedStep.icon className={`w-16 h-16 ${selectedStep.iconColor} relative z-10 drop-shadow-2xl`} />
                        )}
                        {selectedStep.highlight && (
                          <div className="absolute -top-3 -right-3 w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center border-2 border-yellow-400 shadow-lg shadow-yellow-500/70 z-20">
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </motion.div>
                      
                      <div>
                        <DialogTitle className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono uppercase mb-2">
                          {selectedStep.label}
                        </DialogTitle>
                        <p className="text-cyan-300/70 text-lg font-mono">{selectedStep.description}</p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedStep(null)}
                      className="hover:bg-red-500/20 border-2 border-red-500/30 text-red-400"
                    >
                      <X className="w-5 h-5" />
                    </Button>
                  </div>
                </DialogHeader>
                
                {/* Content */}
                <div className="p-8 relative z-10">
                  {/* Description */}
                  <motion.div
                    className="mb-8 p-6 rounded-lg bg-gradient-to-r from-cyan-600/10 to-purple-600/10 border-2 border-cyan-500/30"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-lg text-cyan-300/90 font-mono leading-relaxed">
                      {selectedStep.details}
                    </p>
                  </motion.div>
                  
                  {/* Stats Grid */}
                  {selectedStep.stats && (
                    <motion.div
                      className="grid grid-cols-3 gap-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      {selectedStep.stats.map((stat, index) => (
                        <motion.div
                          key={index}
                          className="p-6 rounded-lg bg-black/40 border-2 border-cyan-500/30 text-center"
                          whileHover={{ scale: 1.05, borderColor: 'rgba(6, 182, 212, 0.6)' }}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                        >
                          <p className="text-xs font-mono text-cyan-400/70 uppercase mb-2 tracking-wider">
                            {stat.label}
                          </p>
                          <p className="text-3xl font-black bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent font-mono">
                            {stat.value}
                          </p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
});

FlowVisualization.displayName = 'FlowVisualization';
