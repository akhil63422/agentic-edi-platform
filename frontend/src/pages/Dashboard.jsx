import React, { useEffect, useState, useRef, useCallback } from 'react';
import { KPI3DCard } from '@/components/KPI3DCard';
import { FlowVisualization } from '@/components/FlowVisualization';
import { ActivityTable } from '@/components/ActivityTable';
import { ProcessingModal } from '@/components/ProcessingModal';
import {
  FileText, CheckCircle2, AlertTriangle, ArrowDownToLine,
  Download, Upload, Database, X, CloudUpload, FileUp, Loader2,
} from 'lucide-react';
import { websocketService } from '@/services/websocket';
import { documentsService } from '@/services/documents';
import { exceptionsService } from '@/services/exceptions';
import { dataService } from '@/services/data';
import { toast } from 'sonner';
import api from '@/services/api';

export const Dashboard = () => {
  const fileInputRef    = useRef(null);
  const ediFileInputRef = useRef(null);
  const [isExporting,   setIsExporting]   = useState(false);
  const [isImporting,   setIsImporting]   = useState(false);
  const [isDragOver,    setIsDragOver]    = useState(false);
  const [isUploading,   setIsUploading]   = useState(false);
  const [processingDoc, setProcessingDoc] = useState(null); // { id, fileName }

  const [kpiData, setKpiData] = useState([
    {
      title: 'Inbound X12 (24h)',
      value: '0',
      subtitle: 'Files processed today',
      trend: 'up',
      trendValue: '—',
      icon: ArrowDownToLine,
      description: 'Total inbound X12 EDI files received and processed in the last 24 hours',
      details: [
        { label: 'Processed', value: '0' },
        { label: 'Pending', value: '0' },
        { label: 'Failed', value: '0' },
        { label: 'Avg Time', value: '—' },
      ],
    },
    {
      title: 'Successful Translations',
      value: '0',
      subtitle: '—',
      trend: 'up',
      trendValue: '—',
      variant: 'success',
      icon: CheckCircle2,
      description: 'Successfully translated and validated EDI documents with high confidence',
      details: [
        { label: 'Success Rate', value: '—' },
        { label: 'Total Processed', value: '0' },
        { label: 'AI Confidence', value: '—' },
        { label: 'Avg Score', value: '—' },
      ],
    },
    {
      title: 'Active Exceptions',
      value: '0',
      subtitle: 'Requires attention',
      trend: 'down',
      trendValue: '—',
      variant: 'warning',
      icon: AlertTriangle,
      description: 'Active exceptions requiring manual review or intervention',
      details: [
        { label: 'Critical', value: '0' },
        { label: 'Warning', value: '0' },
        { label: 'Resolved Today', value: '0' },
        { label: 'Avg Resolve', value: '—' },
      ],
    },
  ]);

  const [backendConnected, setBackendConnected] = useState(null); // null=checking, true=ok, false=error

  const [activityData, setActivityData] = useState([]);

  // Check backend connection
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await api.get('/partners/?limit=1');
        setBackendConnected(true);
      } catch {
        setBackendConnected(false);
      }
    };
    checkBackend();
  }, []);

  useEffect(() => {
    // Load initial data (KPIs + activity table)
    loadDashboardData();
    loadActivityData();
    
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
      // Load documents for KPIs (forceApi: always use backend, not localStorage)
      const [inboundDocs, exceptions] = await Promise.all([
        documentsService.getAll({ direction: 'Inbound', limit: 1000, forceApi: true }),
        exceptionsService.getAll({ status: 'Open', limit: 100, forceApi: true })
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
      // forceApi: true ensures we always fetch from backend, not localStorage
      const docs = await documentsService.getAll({ limit: 10, forceApi: true });
      const list = Array.isArray(docs) ? docs : (docs?.items ?? []);
      const transformed = list.map(doc => {
        const ts = doc.received_at || doc.created_at;
        const displayTs = ts ? (typeof ts === 'string' ? new Date(ts).toLocaleString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ts) : '-';
        return {
          id: doc._id || doc.id,
          timestamp: displayTs,
          partner: doc.partner_code || 'Unknown',
          docType: doc.document_type || '-',
          direction: doc.direction || 'Inbound',
          status: doc.status === 'Completed' ? 'Completed' : 
                  doc.status === 'Needs Review' ? 'Warning' :
                  doc.status === 'Failed' ? 'Error' :
                  doc.status === 'Duplicate' ? 'Error' : 'Processing',
          stage: doc.status || '-',
        };
      });
      setActivityData(transformed);
    } catch (err) {
      console.error('Error loading activity data:', err);
      toast.error(err.response?.data?.detail || 'Failed to load EDI activity. Check backend is running.');
    }
  };

  // ── EDI File Upload ──────────────────────────────────────────────────────
  const handleEdiUpload = useCallback(async (file) => {
    if (!file) return;

    const allowed = ['.edi', '.x12', '.txt', '.edifact', '.edi2', '.dat'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (!allowed.includes(ext) && file.type !== 'text/plain' && !file.name.includes('.')) {
      // allow any text-like file
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { document_id, file_name, document_type, standard } = response.data;
      toast.success(`Uploaded ${file.name} — detected ${document_type} (${standard})`);
      setProcessingDoc({ id: document_id, fileName: file_name || file.name });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed. Check backend is running.');
    } finally {
      setIsUploading(false);
      if (ediFileInputRef.current) ediFileInputRef.current.value = '';
    }
  }, []);

  const handleEdiFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (file) handleEdiUpload(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleEdiUpload(file);
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
      toast.success('Data saved to browser. All pages will now use this data.');
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
    <div className="p-8 space-y-8 min-h-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Operations Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Real-time overview of your EDI operations</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Backend connection status */}
          {backendConnected === false && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              Backend disconnected — start backend on port 8001
            </div>
          )}
          {backendConnected === true && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Backend connected
            </div>
          )}
          {dataService.hasLocalData() && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
              <Database className="w-4 h-4" />
              <span>Using browser data</span>
              <button
                onClick={() => {
                  dataService.clearLocalData();
                  toast.success('Cleared local data. Using API.');
                  loadDashboardData();
                }}
                className="p-0.5 hover:bg-amber-500/20 rounded"
                title="Clear and use API"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm font-medium"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors text-sm font-medium"
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
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpiData.map((kpi, index) => (
          <div key={index}>
            <KPI3DCard {...kpi} />
          </div>
        ))}
      </div>
      
      {/* EDI Upload Zone */}
      <div>
        <input
          ref={ediFileInputRef}
          type="file"
          accept=".edi,.x12,.txt,.edifact,.dat,.edi2"
          className="hidden"
          onChange={handleEdiFileChange}
        />

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && ediFileInputRef.current?.click()}
          className={`relative flex flex-col sm:flex-row items-center gap-4 px-6 py-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 select-none
            ${isDragOver
              ? 'bg-blue-500/10 border-blue-500/50'
              : 'bg-slate-900/60 border-slate-600 hover:border-slate-500'
            }
            ${isUploading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center
            ${isDragOver ? 'bg-blue-500/20' : 'bg-slate-800'}`}
          >
            {isUploading
              ? <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              : isDragOver
              ? <FileUp className="w-6 h-6 text-blue-400" />
              : <CloudUpload className="w-6 h-6 text-slate-400" />
            }
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-medium text-white">
              {isUploading ? 'Uploading & starting pipeline…' : isDragOver ? 'Drop your EDI file here' : 'Upload EDI File'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {isUploading
                ? 'Please wait — auto-detecting standard & transaction type'
                : 'Drag & drop or click to browse · .edi .x12 .txt .edifact · Pipeline starts instantly'}
            </p>
          </div>

          {/* Badge */}
          {!isUploading && (
            <div className="flex-shrink-0 flex flex-wrap gap-1.5">
              {['X12', 'EDIFACT', 'JSON', 'XML'].map(s => (
                <span key={s} className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* Progress overlay while uploading */}
          {isUploading && (
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none bg-slate-800/20" />
          )}
        </div>
      </div>

      {/* Live EDI Activity: 10-Step Flow + Activity Table */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Live EDI Activity</h2>
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Live</span>
          </div>
        </div>
        <ActivityTable data={activityData} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FlowVisualization direction="Inbound" />
          <FlowVisualization direction="Outbound" />
        </div>
      </div>

      {/* ── Pipeline Processing Modal ─────────────────────────────────────── */}
      {processingDoc && (
        <ProcessingModal
          documentId={processingDoc.id}
          fileName={processingDoc.fileName}
          onClose={() => {
            setProcessingDoc(null);
            loadDashboardData();
          }}
        />
      )}
    </div>
  );
};
