import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  AlertTriangle, 
  Users, 
  FileText, 
  Settings, 
  Activity,
  Link2,
  FlaskConical,
  Zap
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export const Layout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [logoError, setLogoError] = useState(false);
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/inbound', icon: ArrowDownToLine, label: 'Inbound EDI' },
    { path: '/outbound', icon: ArrowUpFromLine, label: 'Outbound EDI' },
    { path: '/exceptions', icon: AlertTriangle, label: 'Error Dashboard' },
    { path: '/partners', icon: Users, label: 'Partner Portal' },
    { path: '/mapper', icon: Link2, label: 'Visual Mapper' },
    { path: '/playground', icon: FlaskConical, label: 'Playground' },
    { path: '/audit', icon: FileText, label: 'Audit Trail' },
    { path: '/analytics', icon: Activity, label: 'SLA Dashboard' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];
  
  return (
    <div className="flex h-screen bg-slate-950 relative overflow-hidden">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 z-50 bg-slate-900/95 border-r border-slate-700/80 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-slate-700/80">
          <div 
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            {logoError ? (
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
            ) : (
              <img
                src="/logo.png"
                alt="Agent Eddy"
                className="w-10 h-10 rounded-lg object-contain shrink-0"
                onError={() => setLogoError(true)}
              />
            )}
            <div>
              <h1 className="text-lg font-semibold text-white">Agent Eddy</h1>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors border-l-2 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border-blue-500'
                    : 'border-transparent text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge className="ml-auto bg-amber-500/20 text-amber-400 border-0 text-xs">
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        {/* User Profile */}
        <div className="p-4 border-t border-slate-700/80">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer hover:bg-slate-800/80 transition-colors"
            onClick={() => navigate('/profile')}
          >
            <Avatar className="w-10 h-10">
              <AvatarFallback className="bg-slate-700 text-slate-300 text-sm font-medium">
                AK
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">Account</p>
              <p className="text-xs text-slate-500 truncate">Settings</p>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col ml-64">
        <main className="flex-1 overflow-y-auto scrollbar-thin bg-slate-950">
          {children}
        </main>
      </div>
    </div>
  );
};
