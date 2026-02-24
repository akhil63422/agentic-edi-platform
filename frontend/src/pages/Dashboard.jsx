import React, { memo, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { KPI3DCard } from '@/components/KPI3DCard';
import { FlowVisualization } from '@/components/FlowVisualization';
import { ActivityTable } from '@/components/ActivityTable';
import { FileText, CheckCircle2, AlertTriangle, ArrowDownToLine, Download, Upload } from 'lucide-react';
import { websocketService } from '@/services/websocket';
import { documentsService } from '@/services/documents';
import { exceptionsService } from '@/services/exceptions';
import { dataService } from '@/services/data';
import { toast } from 'sonner';

export const Dashboard = () => {
  const fileInputRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [kpiData, setKpiData] = useState([
    {
      title: 'Inbound X12 (24h)',
      value: '128',
      subtitle: 'Files processed today',
      trend: 'up',
      trendValue: '+12%',
      icon: ArrowDownToLine,
      description: 'Total inbound X12 EDI files received and processed in the last 24 hours',
      details: [
        { label: 'Processed', value: '128' },
        { label: 'Pending', value: '12' },
        { label: 'Failed', value: '3' },
        { label: 'Avg Time', value: '2.3s' },
      ],
    },
    {
      title: 'Successful Translations',
      value: '121',
      subtitle: '94.5% success rate',
      trend: 'up',
      trendValue: '+3.2%',
      variant: 'success',
      icon: CheckCircle2,
      description: 'Successfully translated and validated EDI documents with high confidence',
      details: [
        { label: 'Success Rate', value: '94.5%' },
        { label: 'Total Processed', value: '128' },
        { label: 'AI Confidence', value: '98.2%' },
        { label: 'Avg Score', value: '9.8/10' },
      ],
    },
    {
      title: 'Active Exceptions',
      value: '7',
      subtitle: 'Requires attention',
      trend: 'down',
      trendValue: '-2',
      variant: 'warning',
      icon: AlertTriangle,
      description: 'Active exceptions requiring manual review or intervention',
      details: [
        { label: 'Critical', value: '2' },
        { label: 'Warning', value: '5' },
        { label: 'Resolved Today', value: '12' },
        { label: 'Avg Resolve', value: '15m' },
      ],
    },
  ]);
  
  const [activityData, setActivityData] = useState([
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
  ]);

  useEffect(() => {
    // Load initial data
    loadDashboardData();
    
    // Connect WebSocket
    websocketService.connect();
    
    // Listen for real-time updates
    const unsubscribeDocument = websocketService.on('document_update', (message) => {
      // Refresh activity data when document updates
      loadActivityData();
    });
    
    const unsubscribeException = websocketService.on('exception', (message) => {
      // Refresh KPIs when new exception is created
      loadDashboardData();
    });
    
    const unsubscribeKpi = websocketService.on('kpi_update', (message) => {
      // Update KPIs
      if (message.data) {
        setKpiData(prev => {
          // Update KPI data from server
          return prev.map(kpi => {
            const updated = message.data[kpi.title];
            return updated ? { ...kpi, ...updated } : kpi;
          });
        });
      }
    });
    
    return () => {
      unsubscribeDocument();
      unsubscribeException();
      unsubscribeKpi();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load documents for KPIs
      const [inboundDocs, exceptions] = await Promise.all([
        documentsService.getAll({ direction: 'Inbound', limit: 1000 }),
        exceptionsService.getAll({ status: 'Open', limit: 100 })
      ]);
      
      const last24h = inboundDocs.filter(doc => {
        const docDate = new Date(doc.received_at || doc.created_at);
        const now = new Date();
        const diffHours = (now - docDate) / (1000 * 60 * 60);
        return diffHours <= 24;
      });
      
      const completed = last24h.filter(d => d.status === 'Completed').length;
      const successRate = last24h.length > 0 ? ((completed / last24h.length) * 100).toFixed(1) : 0;
      
      setKpiData([
        {
          title: 'Inbound X12 (24h)',
          value: last24h.length.toString(),
          subtitle: 'Files processed today',
          trend: 'up',
          trendValue: '+12%',
          icon: ArrowDownToLine,
          description: 'Total inbound X12 EDI files received and processed in the last 24 hours',
          details: [
            { label: 'Processed', value: last24h.length.toString() },
            { label: 'Pending', value: last24h.filter(d => d.status === 'Processing').length.toString() },
            { label: 'Failed', value: last24h.filter(d => d.status === 'Failed').length.toString() },
            { label: 'Avg Time', value: '2.3s' },
          ],
        },
        {
          title: 'Successful Translations',
          value: completed.toString(),
          subtitle: `${successRate}% success rate`,
          trend: 'up',
          trendValue: '+3.2%',
          variant: 'success',
          icon: CheckCircle2,
          description: 'Successfully translated and validated EDI documents with high confidence',
          details: [
            { label: 'Success Rate', value: `${successRate}%` },
            { label: 'Total Processed', value: last24h.length.toString() },
            { label: 'AI Confidence', value: '98.2%' },
            { label: 'Avg Score', value: '9.8/10' },
          ],
        },
        {
          title: 'Active Exceptions',
          value: exceptions.length.toString(),
          subtitle: 'Requires attention',
          trend: 'down',
          trendValue: '-2',
          variant: 'warning',
          icon: AlertTriangle,
          description: 'Active exceptions requiring manual review or intervention',
          details: [
            { label: 'Critical', value: exceptions.filter(e => e.severity === 'Critical').length.toString() },
            { label: 'Warning', value: exceptions.filter(e => e.severity === 'High').length.toString() },
            { label: 'Resolved Today', value: '12' },
            { label: 'Avg Resolve', value: '15m' },
          ],
        },
      ]);
      
      await loadActivityData();
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  };

  const loadActivityData = async () => {
    try {
      const docs = await documentsService.getAll({ limit: 10 });
      const transformed = docs.map(doc => ({
        id: doc._id || doc.id,
        timestamp: doc.received_at || doc.created_at,
        partner: doc.partner_code || 'Unknown',
        docType: doc.document_type,
        direction: doc.direction,
        status: doc.status === 'Completed' ? 'Completed' : 
                doc.status === 'Needs Review' ? 'Warning' :
                doc.status === 'Failed' ? 'Error' : 'Processing',
        stage: doc.status,
      }));
      setActivityData(transformed);
    } catch (err) {
      console.error('Error loading activity data:', err);
    }
  };

  const handleDownloadData = async () => {
    try {
      setIsExporting(true);
      const data = await dataService.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edi-mvp-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported. Share this JSON file + the app link with your manager.');
    } catch (err) {
      console.error('Export error:', err);
      toast.error(err.response?.data?.detail || err.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    try {
      setIsImporting(true);
      const text = await file.text();
      const payload = JSON.parse(text);
      const required = ['trading_partners', 'documents', 'exceptions', 'audit_logs'];
      for (const key of required) {
        if (!Array.isArray(payload[key])) {
          throw new Error(`Invalid format: missing or invalid "${key}" array`);
        }
      }
      await dataService.importData({
        trading_partners: payload.trading_partners || [],
        documents: payload.documents || [],
        exceptions: payload.exceptions || [],
        audit_logs: payload.audit_logs || [],
      });
      toast.success('Data imported successfully. Refreshing...');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadDashboardData();
    } catch (err) {
      console.error('Import error:', err);
      toast.error(err.response?.data?.detail || err.message || 'Failed to import data');
    } finally {
      setIsImporting(false);
    }
  };
  
  return (
    <div className="p-8 space-y-8 relative bg-gradient-to-br from-slate-900 via-blue-950 to-black min-h-full">
      {/* Animated Background Pattern */}
      <div 
        className="absolute inset-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(6, 182, 212, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Page Header */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-mono mb-2">
            Agent Eddy
          </h1>
          <p className="text-cyan-300/70 mt-1 font-mono">Real-time overview of your EDI operations</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImportData}
          />
          <button
            onClick={handleDownloadData}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 transition-all font-mono text-sm font-medium"
          >
            {isExporting ? (
              <span className="animate-pulse">Exporting...</span>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Download Data
              </>
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 border border-purple-500/50 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-all font-mono text-sm font-medium"
          >
            {isImporting ? (
              <span className="animate-pulse">Importing...</span>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import Data
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* 3D KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
        {kpiData.map((kpi, index) => (
          <div key={index}>
            <KPI3DCard {...kpi} />
          </div>
        ))}
      </div>
      
      {/* Flow Visualization */}
      <div className="relative z-10">
        <FlowVisualization />
      </div>
      
      {/* Activity Table */}
      <div className="space-y-4 relative z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent font-mono">
            LIVE EDI ACTIVITY
          </h2>
          <div className="flex items-center space-x-2 px-3 py-1 rounded border border-green-500/30 bg-green-500/10">
            <div className="w-2 h-2 bg-green-400 rounded-full" />
            <span className="text-sm text-green-400 font-mono font-bold">LIVE UPDATES</span>
          </div>
        </div>
        <ActivityTable data={activityData} />
      </div>
    </div>
  );
};
