# Agentic EDI Platform - Complete Source Code

## Project Structure

```
/app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           # Shadcn UI components
│   │   │   ├── Layout.jsx
│   │   │   ├── KPICard.jsx
│   │   │   ├── FlowVisualization.jsx
│   │   │   └── ActivityTable.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DocumentDetail.jsx
│   │   │   └── Mapper.jsx
│   │   ├── App.js
│   │   ├── index.css
│   │   └── index.js
│   ├── tailwind.config.js
│   └── package.json
└── backend/
    └── (FastAPI backend)
```

---

## Frontend Source Code

### 1. index.css - Design System & Tokens

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
    margin: 0;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen",
        "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue",
        sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

code {
    font-family:
        'Monaco', 'Courier New', source-code-pro, Menlo, Consolas, monospace;
}

@layer base {
    :root {
        /* Background colors */
        --background: 210 20% 98%;  /* Very light blue-gray #F8FAFC */
        --foreground: 215 25% 15%;  /* Dark charcoal #1E293B */
        
        /* Card and surface colors */
        --card: 0 0% 100%;  /* Pure white */
        --card-foreground: 215 25% 15%;
        --card-secondary: 210 20% 98%;  /* Light gray background */
        
        /* Popover */
        --popover: 0 0% 100%;
        --popover-foreground: 215 25% 15%;
        
        /* Primary - Professional Blue */
        --primary: 217 91% 60%;  /* #3B82F6 - Modern blue */
        --primary-foreground: 0 0% 100%;
        --primary-hover: 217 91% 55%;
        
        /* Secondary - Neutral Gray */
        --secondary: 215 16% 96%;
        --secondary-foreground: 215 25% 15%;
        
        /* Muted - Subtle backgrounds */
        --muted: 210 20% 96%;
        --muted-foreground: 215 16% 47%;
        
        /* Accent - Professional indigo */
        --accent: 221 83% 53%;
        --accent-foreground: 0 0% 100%;
        
        /* Status colors - Soft and friendly */
        --success: 142 71% 45%;  /* Green */
        --success-bg: 142 76% 94%;  /* #DEF7EC - Soft green background */
        --success-foreground: 142 76% 28%;
        
        --warning: 38 92% 50%;  /* Amber */
        --warning-bg: 48 97% 88%;  /* #FEF3C7 - Soft yellow background */
        --warning-foreground: 32 95% 30%;
        
        --error: 0 84% 60%;  /* Red */
        --error-bg: 0 86% 95%;  /* #FDE8E8 - Soft red background */
        --error-foreground: 0 74% 42%;
        
        --processing: 214 95% 93%;  /* Soft blue */
        --processing-foreground: 217 91% 60%;
        
        /* Border and input */
        --border: 214 32% 91%;
        --input: 214 32% 91%;
        --ring: 217 91% 60%;
        
        /* Radius */
        --radius: 0.5rem;
        
        /* Custom design tokens */
        --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
        --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
        --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
        
        /* Transitions */
        --transition-smooth: 150ms cubic-bezier(0.4, 0, 0.2, 1);
        --transition-base: 200ms ease-in-out;
        
        /* Gradients - Subtle and professional */
        --gradient-primary: linear-gradient(135deg, hsl(217 91% 60%), hsl(221 83% 53%));
        --gradient-subtle: linear-gradient(180deg, hsl(0 0% 100%), hsl(210 20% 98%));
    }
    
    .dark {
        --background: 222 47% 11%;
        --foreground: 210 40% 98%;
        --card: 222 47% 11%;
        --card-foreground: 210 40% 98%;
        --popover: 222 47% 11%;
        --popover-foreground: 210 40% 98%;
        --primary: 217 91% 60%;
        --primary-foreground: 222 47% 11%;
        --secondary: 217 33% 17%;
        --secondary-foreground: 210 40% 98%;
        --muted: 223 47% 11%;
        --muted-foreground: 215 20% 65%;
        --accent: 221 83% 53%;
        --accent-foreground: 210 40% 98%;
        --border: 217 33% 17%;
        --input: 217 33% 17%;
        --ring: 224 71% 4%;
    }
}

@layer base {
    * {
        @apply border-border;
    }
    body {
        @apply bg-background text-foreground;
    }
}

/* Custom scrollbar styling */
@layer utilities {
    .scrollbar-thin::-webkit-scrollbar {
        width: 8px;
        height: 8px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-track {
        @apply bg-muted;
        border-radius: 4px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb {
        @apply bg-border;
        border-radius: 4px;
    }
    
    .scrollbar-thin::-webkit-scrollbar-thumb:hover {
        @apply bg-muted-foreground;
    }
}

/* Custom badge styles */
@layer components {
    .status-badge {
        @apply inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium;
        transition: var(--transition-smooth);
    }
    
    .status-badge.success {
        background-color: hsl(var(--success-bg));
        color: hsl(var(--success-foreground));
    }
    
    .status-badge.warning {
        background-color: hsl(var(--warning-bg));
        color: hsl(var(--warning-foreground));
    }
    
    .status-badge.error {
        background-color: hsl(var(--error-bg));
        color: hsl(var(--error-foreground));
    }
    
    .status-badge.processing {
        background-color: hsl(var(--processing));
        color: hsl(var(--processing-foreground));
    }
}

/* EDI-specific styles */
@layer components {
    .edi-segment {
        @apply font-mono text-sm leading-relaxed;
        background-color: hsl(var(--muted));
        border-left: 2px solid hsl(var(--border));
    }
    
    .edi-segment:hover {
        border-left-color: hsl(var(--primary));
    }
    
    .ai-highlight {
        background-color: hsl(var(--warning-bg));
        border: 1px solid hsl(var(--warning));
        animation: pulse-subtle 2s ease-in-out infinite;
    }
}

/* Animations */
@keyframes pulse-subtle {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.85;
    }
}

@keyframes slide-in {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.animate-slide-in {
    animation: slide-in 0.3s ease-out;
}
```

---

### 2. App.js - Main Application Router

```javascript
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/pages/Dashboard';
import { DocumentDetail } from '@/pages/DocumentDetail';
import { Mapper } from '@/pages/Mapper';
import { Toaster } from '@/components/ui/sonner';
import '@/App.css';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/document/:id" element={<DocumentDetail />} />
            <Route path="/mapper" element={<Mapper />} />
            <Route path="/inbound" element={<Dashboard />} />
            <Route path="/outbound" element={<Dashboard />} />
            <Route path="/exceptions" element={<Dashboard />} />
            <Route path="/partners" element={<Dashboard />} />
            <Route path="/audit" element={<Dashboard />} />
            <Route path="/settings" element={<Dashboard />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster />
    </div>
  );
}

export default App;
```

---

### 3. Layout.jsx - Main Layout with Sidebar

```javascript
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  Link2
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';

export const Layout = ({ children }) => {
  const location = useLocation();
  const exceptionCount = 7; // Mock data
  
  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/mapper', icon: Link2, label: 'Visual Mapper' },
    { path: '/inbound', icon: ArrowDownToLine, label: 'Inbound EDI' },
    { path: '/outbound', icon: ArrowUpFromLine, label: 'Outbound EDI' },
    { path: '/exceptions', icon: AlertTriangle, label: 'Exceptions', badge: exceptionCount },
    { path: '/partners', icon: Users, label: 'Trading Partners' },
    { path: '/audit', icon: FileText, label: 'Audit Logs' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];
  
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">AI EDI Platform</h1>
              <p className="text-xs text-muted-foreground">Agentic Intelligence</p>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-auto bg-error-bg text-error-foreground border-0"
                  >
                    {item.badge}
                  </Badge>
                )}
              </NavLink>
            );
          })}
        </nav>
        
        {/* User Profile */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
            <Avatar className="w-9 h-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">AK</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Admin User</p>
              <p className="text-xs text-muted-foreground truncate">admin@company.com</p>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="bg-card border-b border-border">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Omni-search */}
              <div className="flex-1 max-w-2xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search File ID, PO Number, Partner..."
                    className="pl-10 pr-4 w-full bg-muted border-border"
                  />
                </div>
              </div>
              
              {/* Right utilities */}
              <div className="flex items-center space-x-4 ml-6">
                {/* Status indicators */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                    <span className="text-xs text-muted-foreground">API</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                    <span className="text-xs text-muted-foreground">DB</span>
                  </div>
                </div>
                
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full"></span>
                </Button>
                
                {/* Profile */}
                <Avatar className="w-8 h-8 cursor-pointer">
                  <AvatarFallback className="bg-muted text-foreground text-xs font-semibold">AK</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
};
```

---

### 4. Dashboard.jsx - Main Dashboard Page

```javascript
import React from 'react';
import { KPICard } from '@/components/KPICard';
import { FlowVisualization } from '@/components/FlowVisualization';
import { ActivityTable } from '@/components/ActivityTable';
import { FileText, CheckCircle, AlertTriangle } from 'lucide-react';

export const Dashboard = () => {
  // Mock data
  const kpiData = [
    {
      title: 'Inbound X12 (24h)',
      value: '128',
      subtitle: 'Files processed today',
      trend: 'up',
      trendValue: '+12%',
      icon: FileText,
    },
    {
      title: 'Successful Translations',
      value: '121',
      subtitle: '94.5% success rate',
      trend: 'up',
      trendValue: '+3.2%',
      variant: 'success',
      icon: CheckCircle,
    },
    {
      title: 'Active Exceptions',
      value: '7',
      subtitle: 'Requires attention',
      trend: 'down',
      trendValue: '-2',
      variant: 'warning',
      icon: AlertTriangle,
    },
  ];
  
  const activityData = [
    {
      id: 'PO_8932',
      timestamp: '2024-01-15 14:23',
      partner: 'Walmart',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Warning',
      stage: 'AI Review',
    },
    {
      id: 'INV_4521',
      timestamp: '2024-01-15 14:18',
      partner: 'Target',
      docType: 'X12 810',
      direction: 'Outbound',
      status: 'Completed',
      stage: 'Sent to ERP',
    },
    {
      id: 'ASN_7834',
      timestamp: '2024-01-15 14:15',
      partner: 'Amazon',
      docType: 'X12 856',
      direction: 'Inbound',
      status: 'Processing',
      stage: 'EDI Parser',
    },
    {
      id: 'PO_8931',
      timestamp: '2024-01-15 14:12',
      partner: 'Home Depot',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Completed',
      stage: 'Sent to ERP',
    },
    {
      id: 'INV_4520',
      timestamp: '2024-01-15 14:08',
      partner: 'Costco',
      docType: 'X12 810',
      direction: 'Outbound',
      status: 'Error',
      stage: 'Validation Failed',
    },
    {
      id: 'PO_8930',
      timestamp: '2024-01-15 14:05',
      partner: 'Kroger',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Completed',
      stage: 'Sent to ERP',
    },
  ];
  
  return (
    <div className="p-8 space-y-8 animate-slide-in">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">EDI Command Center</h1>
        <p className="text-muted-foreground mt-1">Real-time overview of your EDI operations</p>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpiData.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>
      
      {/* Flow Visualization */}
      <FlowVisualization />
      
      {/* Activity Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Live EDI Activity</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Live updates</span>
          </div>
        </div>
        <ActivityTable data={activityData} />
      </div>
    </div>
  );
};
```

---

### 5. KPICard.jsx - KPI Card Component

```javascript
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const KPICard = ({ title, value, subtitle, trend, trendValue, variant = 'default', icon: Icon }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };
  
  const getTrendColor = () => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-error';
    return 'text-muted-foreground';
  };
  
  const getCardStyle = () => {
    if (variant === 'warning') return 'border-warning bg-warning-bg';
    if (variant === 'success') return 'border-success bg-success-bg';
    if (variant === 'error') return 'border-error bg-error-bg';
    return 'bg-card';
  };
  
  return (
    <Card className={`${getCardStyle()} transition-all duration-200 hover:shadow-md`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
            <div className="flex items-baseline space-x-2">
              <h3 className="text-3xl font-bold text-foreground">{value}</h3>
              {trendValue && (
                <div className={`flex items-center space-x-1 text-sm font-medium ${getTrendColor()}`}>
                  {getTrendIcon()}
                  <span>{trendValue}</span>
                </div>
              )}
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className="ml-4 p-3 bg-primary/10 rounded-lg">
              <Icon className="w-6 h-6 text-primary" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
```

---

### 6. FlowVisualization.jsx - EDI Flow Diagram

```javascript
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Package, Brain, FileJson, FileText, ArrowRight } from 'lucide-react';

export const FlowVisualization = () => {
  const flowSteps = [
    { 
      icon: Cloud, 
      label: 'SFTP/S3', 
      description: 'Inbound Files',
      color: 'bg-blue-100 text-blue-600' 
    },
    { 
      icon: Package, 
      label: 'EDI Parser', 
      description: 'X12/EDIFACT',
      color: 'bg-purple-100 text-purple-600' 
    },
    { 
      icon: Brain, 
      label: 'Agentic AI', 
      description: 'Smart Processing',
      color: 'bg-gradient-to-br from-primary to-accent text-white',
      highlight: true
    },
    { 
      icon: FileJson, 
      label: 'Canonical JSON', 
      description: 'Normalized Data',
      color: 'bg-green-100 text-green-600' 
    },
    { 
      icon: FileText, 
      label: 'ERP Integration', 
      description: 'Business System',
      color: 'bg-orange-100 text-orange-600' 
    },
  ];
  
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Agentic EDI Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Flow line */}
          <div className="absolute top-12 left-0 right-0 h-0.5 bg-border"></div>
          
          {/* Flow steps */}
          <div className="relative flex items-start justify-between">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={index} className="flex flex-col items-center" style={{ width: '18%' }}>
                  {/* Icon container */}
                  <div
                    className={`relative z-10 w-24 h-24 rounded-xl ${
                      step.highlight 
                        ? 'bg-gradient-to-br from-primary to-accent shadow-lg' 
                        : step.color
                    } flex items-center justify-center transition-transform duration-300 hover:scale-110 ${
                      step.highlight ? 'animate-pulse-subtle' : ''
                    }`}
                  >
                    <Icon className={`w-10 h-10 ${step.highlight ? 'text-white' : ''}`} />
                    {step.highlight && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 bg-warning rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-warning-foreground">AI</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Label */}
                  <div className="mt-4 text-center">
                    <p className="text-sm font-semibold text-foreground">{step.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  </div>
                  
                  {/* Arrow */}
                  {index < flowSteps.length - 1 && (
                    <ArrowRight className="absolute top-12 w-6 h-6 text-muted-foreground" 
                      style={{ left: `${(index + 1) * 20 - 2}%` }} 
                    />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Feedback loop */}
          <div className="mt-8 flex items-center justify-center">
            <div className="flex items-center space-x-2 px-4 py-2 bg-muted rounded-full">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-muted-foreground">Continuous Feedback Loop</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground transform rotate-180" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

---

### 7. ActivityTable.jsx - EDI Activity Table

```javascript
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

export const ActivityTable = ({ data }) => {
  const navigate = useNavigate();
  
  const getStatusBadge = (status) => {
    const statusMap = {
      completed: { label: 'Completed', className: 'status-badge success' },
      warning: { label: 'Warning', className: 'status-badge warning' },
      error: { label: 'Error', className: 'status-badge error' },
      processing: { label: 'Processing', className: 'status-badge processing' },
    };
    
    const config = statusMap[status.toLowerCase()] || statusMap.processing;
    return <span className={config.className}>{config.label}</span>;
  };
  
  const handleViewDetails = (id) => {
    navigate(`/document/${id}`);
  };
  
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Timestamp</TableHead>
            <TableHead className="font-semibold">Partner</TableHead>
            <TableHead className="font-semibold">Doc Type</TableHead>
            <TableHead className="font-semibold">Direction</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold">Current Stage</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow 
              key={row.id} 
              className="hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => handleViewDetails(row.id)}
            >
              <TableCell className="font-mono text-sm">{row.timestamp}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-muted rounded-md flex items-center justify-center">
                    <span className="text-xs font-semibold text-muted-foreground">{row.partner.charAt(0)}</span>
                  </div>
                  <span className="font-medium">{row.partner}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono">{row.docType}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={row.direction === 'Inbound' ? 'default' : 'secondary'}>
                  {row.direction}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(row.status)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{row.stage}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(row.id);
                  }}
                  className="hover:bg-primary hover:text-primary-foreground"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

---

## Download Instructions

All source code files are located in:
- **Frontend**: `/app/frontend/src/`
- **Components**: `/app/frontend/src/components/`
- **Pages**: `/app/frontend/src/pages/`
- **Styles**: `/app/frontend/src/index.css`
- **Config**: `/app/frontend/tailwind.config.js`

To download the entire project:
```bash
cd /app
tar -czf agentic-edi-platform.tar.gz frontend/src frontend/tailwind.config.js frontend/package.json
```

Or copy individual files as needed from the paths listed above.
