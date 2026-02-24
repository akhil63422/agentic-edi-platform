import React, { useState, memo, useMemo, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useGamificationStore } from '@/store/gamificationStore';
import { AchievementBadge } from '@/components/gamification/AchievementBadge';
import { 
  LayoutDashboard, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  AlertTriangle, 
  Users, 
  FileText, 
  Settings, 
  Search, 
  Bell, 
  Activity,
  Link2,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Info,
  Clock,
  X,
  Zap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

export const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const exceptionCount = 7; // Mock data
  const { level, experience, totalScore, achievements, badges, streak } = useGamificationStore();
  
  useEffect(() => {
    // Initialize gamification on mount
    // This could load from backend API in the future
  }, []);
  
  // Mock notifications data
  const [notifications, setNotifications] = useState([
    {
      id: 'notif1',
      type: 'exception',
      title: 'New Exception Requires Review',
      message: 'Low confidence exception detected for PO_8932 from Walmart',
      timestamp: '2 minutes ago',
      read: false,
      link: '/exceptions',
    },
    {
      id: 'notif2',
      type: 'success',
      title: 'Document Processed Successfully',
      message: 'X12 810 invoice INV_4521 has been successfully processed',
      timestamp: '15 minutes ago',
      read: false,
      link: '/document/INV_4521',
    },
    {
      id: 'notif3',
      type: 'warning',
      title: 'Transport Connection Issue',
      message: 'SFTP connection timeout for Home Depot partner',
      timestamp: '1 hour ago',
      read: true,
      link: '/partners',
    },
    {
      id: 'notif4',
      type: 'info',
      title: 'AI Mapping Suggestion',
      message: 'AI suggested a new mapping for WMT_MAPPING_001 with 87% confidence',
      timestamp: '2 hours ago',
      read: true,
      link: '/mapper',
    },
    {
      id: 'notif5',
      type: 'success',
      title: 'Partner Activated',
      message: 'Amazon trading partner has been successfully activated',
      timestamp: '3 hours ago',
      read: true,
      link: '/partners',
    },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, read: true } : notif
      )
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
  };

  const handleDeleteNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const handleNotificationClick = (notification) => {
    handleMarkAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'exception':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info':
        return <Info className="w-4 h-4 text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-purple-400" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'exception':
        return 'bg-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/30';
      case 'success':
        return 'bg-green-500/20 border-green-500/50 shadow-lg shadow-green-500/30';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 shadow-lg shadow-yellow-500/30';
      case 'info':
        return 'bg-cyan-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/30';
      default:
        return 'bg-black/40 border-cyan-500/30';
    }
  };
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/mapper', icon: Link2, label: 'Visual Mapper' },
    { path: '/playground', icon: FlaskConical, label: 'Playground' },
    { path: '/inbound', icon: ArrowDownToLine, label: 'Inbound EDI' },
    { path: '/outbound', icon: ArrowUpFromLine, label: 'Outbound EDI' },
    { path: '/exceptions', icon: AlertTriangle, label: 'Exceptions', badge: exceptionCount },
    { path: '/partners', icon: Users, label: 'Trading Partners' },
    { path: '/audit', icon: FileText, label: 'Audit Logs' },
    { path: '/analytics', icon: Activity, label: 'Analytics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];
  
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-black relative overflow-hidden" style={{ isolation: 'isolate' }}>
      {/* Animated Background Grid */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Vertical Line Navigation Bar - Left Side, Between Logo and Profile */}
      <aside className="fixed left-0 top-0 bottom-0 w-24 z-50 pointer-events-none flex items-center justify-center">
        {/* Vertical line indicator */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-2/3 bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent" />
        
        {/* Navigation Items in a vertical line */}
        <nav className="relative w-full pointer-events-auto flex flex-col items-center gap-4 py-20">
          {navItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <motion.div
                key={item.path}
                className="relative group"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
              >
                <NavLink
                  to={item.path}
                  className="relative flex flex-col items-center"
                >
                  {/* Icon Container */}
                  <motion.div
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-br from-cyan-500/40 via-purple-500/40 to-pink-500/40 border-cyan-400 shadow-lg shadow-cyan-500/70'
                        : 'bg-black/60 border-cyan-500/50 hover:border-cyan-400 hover:bg-black/80 hover:shadow-lg hover:shadow-cyan-500/50'
                    }`}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Glow effect */}
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500/30 via-purple-500/30 to-pink-500/30 animate-pulse" />
                    )}
                    
                    {/* Icon */}
                    <Icon 
                      className={`w-7 h-7 relative z-10 transition-all ${
                        isActive
                          ? 'text-white drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                          : 'text-cyan-400/80 group-hover:text-cyan-300 group-hover:drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]'
                      }`}
                    />
                    
                    {/* Badge */}
                    {item.badge !== undefined && item.badge > 0 && (
                      <div className="absolute -top-1 -right-1 z-20">
                        <Badge 
                          className="bg-gradient-to-r from-red-600 to-pink-600 text-white border-2 border-red-400/70 shadow-lg shadow-red-500/70 font-black text-[10px] px-1.5 py-0 min-w-[18px] h-[18px] flex items-center justify-center"
                        >
                          {item.badge}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Active indicator ring */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-cyan-400"
                        animate={{
                          scale: [1, 1.2, 1],
                          opacity: [0.5, 0, 0.5],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </motion.div>
                  
                  {/* Text Label - Only visible on hover - Appears to the right */}
                  <div className="absolute left-full ml-3 whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                    <div className="px-3 py-1.5 rounded-lg bg-black/95 border border-cyan-500/50 shadow-lg shadow-cyan-500/30 backdrop-blur-sm">
                      <span className={`text-xs font-black font-mono tracking-wide uppercase ${
                        isActive
                          ? 'text-cyan-300 drop-shadow-[0_0_4px_rgba(6,182,212,0.6)]'
                          : 'text-cyan-300/90'
                      }`}>
                        {item.label}
                      </span>
                    </div>
                    {/* Arrow pointer pointing left (towards icon) */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-cyan-500/50 border-b-4 border-b-transparent" />
                  </div>
                </NavLink>
              </motion.div>
            );
          })}
        </nav>
      </aside>
      
      {/* Logo Section - Top Left (Icon Only) */}
      <div className="fixed top-6 left-6 z-50 pointer-events-auto">
        <motion.div
          className="relative cursor-pointer"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/30 via-purple-500/30 to-pink-500/30 opacity-50 animate-pulse" />
            <div className="relative w-14 h-14 bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center border-2 border-cyan-400 shadow-lg shadow-cyan-500/70">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
        </motion.div>
      </div>
      
      {/* User Profile Section - Bottom Left (Icon Only) */}
      <div className="fixed bottom-6 left-6 z-50 pointer-events-auto">
        <motion.div
          className="relative cursor-pointer group"
          onClick={() => navigate('/profile')}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Status indicator */}
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full shadow-lg shadow-green-400/70 z-20 border-2 border-black" />
          
          <Avatar className="w-14 h-14 border-2 border-purple-500/70 shadow-lg shadow-purple-500/50 relative z-10">
            <AvatarFallback className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-600 text-white text-base font-black">
              AK
            </AvatarFallback>
          </Avatar>
          
          {/* Level badge on hover */}
          <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            <Badge className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white text-[10px] px-1.5 py-0 border border-yellow-400/50">
              Lv {level}
            </Badge>
          </div>
        </motion.div>
      </div>
      
      {/* Main Content - Full width with left padding to avoid nav overlap */}
      <div className="w-full flex flex-col overflow-hidden relative z-10" style={{ paddingLeft: '6rem' }}>
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin bg-gradient-to-br from-slate-900 via-blue-950 to-black">
          {children}
        </main>
      </div>
    </div>
  );
};
