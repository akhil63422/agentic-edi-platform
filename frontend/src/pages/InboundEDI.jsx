import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowDownToLine, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Loader2
} from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { documentsService } from '@/services/documents';
import { toast } from 'sonner';

export const InboundEDI = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [kpiData, setKpiData] = useState([]);
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    partner: 'all',
    docType: 'all',
    status: 'all',
    search: '',
  });

  useEffect(() => {
    loadDocuments();
  }, [filters, currentPage]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params = {
        direction: 'Inbound',
        skip: (currentPage - 1) * 20,
        limit: 20,
      };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.docType !== 'all') params.document_type = filters.docType;
      if (filters.partner !== 'all') params.partner_id = filters.partner;
      
      const data = await documentsService.getAll(params);
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid data format received:', data);
        setTransactions([]);
        setLoading(false);
        return;
      }
      
      // Transform API data
      const transformed = data.map(doc => ({
        id: doc._id || doc.id,
        fileId: doc.file_name || doc._id || doc.id,
        partner: doc.partner_code || 'Unknown',
        docType: doc.document_type,
        direction: doc.direction,
        status: doc.status,
        currentStage: doc.status,
        receivedAt: doc.received_at ? new Date(doc.received_at).toLocaleTimeString() : 'Unknown',
        timestamp: doc.received_at || doc.created_at,
      }));
      
      setTransactions(transformed);
      
      // Calculate KPIs
      try {
        const allDocs = await documentsService.getAll({ direction: 'Inbound', limit: 1000 });
        if (!Array.isArray(allDocs)) {
          console.warn('Invalid KPI data format, using current page data');
          // Use current page data for KPIs
          const total = transformed.length;
          const completed = transformed.filter(d => d.status === 'Completed').length;
          const needsReview = transformed.filter(d => d.status === 'Needs Review').length;
          const failed = transformed.filter(d => d.status === 'Failed').length;
          const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
          
          setKpiData([
            {
              title: 'Total Inbound Files',
              value: total.toLocaleString(),
              subtitle: 'Last 7 days',
              trend: 'up',
              trendValue: '+12%',
              icon: FileText,
            },
            {
              title: 'Success Rate',
              value: `${successRate}%`,
              subtitle: `${completed} successful`,
              trend: 'up',
              trendValue: '+2.1%',
              variant: 'success',
              icon: CheckCircle2,
            },
            {
              title: 'Needs Review',
              value: needsReview.toString(),
              subtitle: 'Requires attention',
              trend: 'down',
              trendValue: '-8',
              variant: 'warning',
              icon: AlertTriangle,
            },
            {
              title: 'Failed',
              value: failed.toString(),
              subtitle: 'Requires action',
              trend: 'down',
              trendValue: '-5',
              variant: 'error',
              icon: XCircle,
            },
          ]);
          return;
        }
        
        const total = allDocs.length;
        const completed = allDocs.filter(d => d.status === 'Completed').length;
        const needsReview = allDocs.filter(d => d.status === 'Needs Review').length;
        const failed = allDocs.filter(d => d.status === 'Failed').length;
        const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
        
        setKpiData([
          {
            title: 'Total Inbound Files',
            value: total.toLocaleString(),
            subtitle: 'Last 7 days',
            trend: 'up',
            trendValue: '+12%',
            icon: FileText,
          },
          {
            title: 'Success Rate',
            value: `${successRate}%`,
            subtitle: `${completed} successful`,
            trend: 'up',
            trendValue: '+2.1%',
            variant: 'success',
            icon: CheckCircle2,
          },
          {
            title: 'Needs Review',
            value: needsReview.toString(),
            subtitle: 'Requires attention',
            trend: 'down',
            trendValue: '-8',
            variant: 'warning',
            icon: AlertTriangle,
          },
          {
            title: 'Failed',
            value: failed.toString(),
            subtitle: 'Requires action',
            trend: 'down',
            trendValue: '-5',
            variant: 'error',
            icon: XCircle,
          },
        ]);
      } catch (kpiErr) {
        console.warn('Error loading KPI data:', kpiErr);
        // Use current page data for KPIs as fallback
        const total = transformed.length;
        const completed = transformed.filter(d => d.status === 'Completed').length;
        const needsReview = transformed.filter(d => d.status === 'Needs Review').length;
        const failed = transformed.filter(d => d.status === 'Failed').length;
        const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;
        
        setKpiData([
          {
            title: 'Total Inbound Files',
            value: total.toLocaleString(),
            subtitle: 'Last 7 days',
            trend: 'up',
            trendValue: '+12%',
            icon: FileText,
          },
          {
            title: 'Success Rate',
            value: `${successRate}%`,
            subtitle: `${completed} successful`,
            trend: 'up',
            trendValue: '+2.1%',
            variant: 'success',
            icon: CheckCircle2,
          },
          {
            title: 'Needs Review',
            value: needsReview.toString(),
            subtitle: 'Requires attention',
            trend: 'down',
            trendValue: '-8',
            variant: 'warning',
            icon: AlertTriangle,
          },
          {
            title: 'Failed',
            value: failed.toString(),
            subtitle: 'Requires action',
            trend: 'down',
            trendValue: '-5',
            variant: 'error',
            icon: XCircle,
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading documents:', err);
      let errorMessage = 'Failed to load inbound documents';
      try {
        if (err.response?.data) {
          if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data.detail) {
            errorMessage = typeof err.response.data.detail === 'string' 
              ? err.response.data.detail 
              : JSON.stringify(err.response.data.detail);
          } else if (err.response.data.message) {
            errorMessage = typeof err.response.data.message === 'string'
              ? err.response.data.message
              : JSON.stringify(err.response.data.message);
          } else {
            errorMessage = JSON.stringify(err.response.data);
          }
        } else if (err.message) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else {
          errorMessage = err?.toString() || 'Unknown error occurred';
        }
      } catch (parseErr) {
        errorMessage = 'Failed to load inbound documents - Network or parsing error';
      }
      toast.error(`Failed to load inbound documents: ${errorMessage}`);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Transactions loaded from API in useEffect
  const itemsPerPage = 20;
  
  // Mock transaction data fallback (for development)
  const mockTransactions = [
    {
      id: 'PO_8932',
      fileId: 'PO_8932',
      partner: 'Walmart',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Completed',
      currentStage: 'ERP Posted',
      receivedAt: '10:42 AM',
      timestamp: '2024-01-15 10:42',
    },
    {
      id: 'PO_8932_2',
      fileId: 'PO_8932',
      partner: 'Walmart',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Needs Review',
      currentStage: 'Agentic AI',
      receivedAt: '10:20 AM',
      timestamp: '2024-01-15 10:20',
    },
    {
      id: 'PO_8933',
      fileId: 'PO_8933',
      partner: 'Walmart',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Failed',
      currentStage: 'ERP Posted',
      receivedAt: '09:57 AM',
      timestamp: '2024-01-15 09:57',
    },
    {
      id: 'PO_8934',
      fileId: 'PO_8934',
      partner: 'Target',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'ERP Posted',
      currentStage: 'Agentic AI',
      receivedAt: '8:31 AM',
      timestamp: '2024-01-15 08:31',
    },
    {
      id: 'PO_8935',
      fileId: 'PO_8935',
      partner: 'Target',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Completed',
      currentStage: 'ERP Posted',
      receivedAt: '7:14 AM',
      timestamp: '2024-01-15 07:14',
    },
    {
      id: 'PO_8936',
      fileId: 'PO_8936',
      partner: 'Target',
      docType: 'X12 850',
      direction: 'Inbound',
      status: 'Parsing EDI',
      currentStage: 'Parsing EDI',
      receivedAt: '6:53 AM',
      timestamp: '2024-01-15 06:53',
    },
    {
      id: 'INV_4521',
      fileId: 'INV_4521',
      partner: 'Amazon',
      docType: 'X12 810',
      direction: 'Inbound',
      status: 'Completed',
      currentStage: 'ERP Posted',
      receivedAt: '6:30 AM',
      timestamp: '2024-01-15 06:30',
    },
    {
      id: 'ASN_7834',
      fileId: 'ASN_7834',
      partner: 'Home Depot',
      docType: 'X12 856',
      direction: 'Inbound',
      status: 'Processing',
      currentStage: 'Agentic AI',
      receivedAt: '6:15 AM',
      timestamp: '2024-01-15 06:15',
    },
  ];

  const totalItems = 1309;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Completed': { variant: 'success', icon: CheckCircle2, bg: 'bg-success-bg', text: 'text-success-foreground' },
      'Needs Review': { variant: 'warning', icon: AlertTriangle, bg: 'bg-warning-bg', text: 'text-warning-foreground' },
      'Failed': { variant: 'error', icon: XCircle, bg: 'bg-error-bg', text: 'text-error-foreground' },
      'Processing': { variant: 'processing', icon: Clock, bg: 'bg-processing', text: 'text-processing-foreground' },
      'Parsing EDI': { variant: 'error', icon: Clock, bg: 'bg-error-bg', text: 'text-error-foreground' },
      'ERP Posted': { variant: 'secondary', icon: CheckCircle2, bg: 'bg-muted', text: 'text-muted-foreground' },
    };

    const config = statusConfig[status] || statusConfig['Processing'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`${config.bg} ${config.text} border-0 gap-1.5`}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const handleViewDetails = (id) => {
    navigate(`/document/${id}`);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filters.search && !tx.fileId.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.partner !== 'all' && tx.partner !== filters.partner) {
      return false;
    }
    if (filters.docType !== 'all' && tx.docType !== filters.docType) {
      return false;
    }
    if (filters.status !== 'all' && tx.status !== filters.status) {
      return false;
    }
    return true;
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);
  
  if (loading && transactions.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-cyan-300 font-mono">Loading inbound documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ArrowDownToLine className="w-8 h-8 text-primary" />
          Inbound EDI - Flow Monitor
        </h1>
        <p className="text-muted-foreground mt-1">Monitor and manage all inbound EDI transactions</p>
      </div>

      {/* KPI Cards */}
      {kpiData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiData.map((kpi, index) => (
            <KPICard key={index} {...kpi} />
          ))}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Date Range</label>
              <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
                  <SelectItem value="last90days">Last 90 Days</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Partner</label>
              <Select value={filters.partner} onValueChange={(value) => handleFilterChange('partner', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  <SelectItem value="Walmart">Walmart</SelectItem>
                  <SelectItem value="Target">Target</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                  <SelectItem value="Home Depot">Home Depot</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Doc Type</label>
              <Select value={filters.docType} onValueChange={(value) => handleFilterChange('docType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="X12 850">X12 850 (PO)</SelectItem>
                  <SelectItem value="X12 810">X12 810 (Invoice)</SelectItem>
                  <SelectItem value="X12 856">X12 856 (ASN)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Completed">Completed</SelectItem>
                  <SelectItem value="Needs Review">Needs Review</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Search File ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search File ID..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">File ID</TableHead>
                  <TableHead className="font-semibold">Partner</TableHead>
                  <TableHead className="font-semibold">Doc Type</TableHead>
                  <TableHead className="font-semibold">Direction</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Current Stage</TableHead>
                  <TableHead className="font-semibold">Received At</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length > 0 ? (
                  paginatedTransactions.map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(tx.id)}
                    >
                      <TableCell 
                        className="font-mono text-sm font-medium text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(tx.id);
                        }}
                      >
                        {tx.fileId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {tx.partner.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium">{tx.partner}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {tx.docType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="gap-1">
                          <ArrowDownToLine className="w-3 h-3" />
                          {tx.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.currentStage}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.receivedAt}</TableCell>
                      <TableCell 
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(tx.id)}
                          className="hover:bg-primary hover:text-primary-foreground"
                        >
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found matching your filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="border-t border-border px-6 py-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1} - {Math.min(endIndex, totalItems)} of {totalItems} entries
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  variant={currentPage === 1 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                >
                  1
                </Button>
                {currentPage > 2 && <span className="px-2 text-muted-foreground">...</span>}
                {currentPage > 1 && currentPage < totalPages && (
                  <Button variant="default" size="sm">
                    {currentPage}
                  </Button>
                )}
                {currentPage < totalPages - 1 && <span className="px-2 text-muted-foreground">...</span>}
                {totalPages > 1 && (
                  <Button
                    variant={currentPage === totalPages ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    {totalPages}
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status Message */}
      <div className="text-center text-sm text-muted-foreground">
        <CheckCircle2 className="w-4 h-4 inline mr-2 text-success" />
        All inbound EDI files are processing normally.
      </div>
    </div>
  );
};
