import React, { useState, useEffect } from 'react';
import { exceptionsService } from '@/services/exceptions';
import { documentsService } from '@/services/documents';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Brain,
  Eye,
  Filter
} from 'lucide-react';
import { KPICard } from '@/components/KPICard';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const Exceptions = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    partner: 'all',
    severity: 'all',
    status: 'all',
    exceptionType: 'all',
    search: '',
  });

  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState([
    {
      title: 'Active Exceptions',
      value: '0',
      subtitle: 'Requiring attention',
      trend: 'down',
      trendValue: '-8',
      variant: 'warning',
      icon: AlertTriangle,
    },
    {
      title: 'Resolved Today',
      value: '0',
      subtitle: 'Last 24 hours',
      trend: 'up',
      trendValue: '+5',
      variant: 'success',
      icon: CheckCircle2,
    },
    {
      title: 'Low Confidence',
      value: '0',
      subtitle: 'AI needs review',
      trend: 'down',
      trendValue: '-3',
      variant: 'warning',
      icon: Brain,
    },
    {
      title: 'Critical Errors',
      value: '0',
      subtitle: 'Immediate action needed',
      trend: 'down',
      trendValue: '-2',
      variant: 'error',
      icon: XCircle,
    },
  ]);

  useEffect(() => {
    loadExceptions();
  }, [filters, currentPage]);

  const loadExceptions = async () => {
    try {
      setLoading(true);
      const params = {
        skip: (currentPage - 1) * itemsPerPage,
        limit: itemsPerPage,
      };
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.severity !== 'all') params.severity = filters.severity;
      if (filters.exceptionType !== 'all') params.exception_type = filters.exceptionType;
      
      const data = await exceptionsService.getAll({ ...params, forceApi: true });
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Invalid data format received:', data);
        setExceptions([]);
        setLoading(false);
        return;
      }
      
      // Fetch document details for document types
      const documentIds = [...new Set(data.map(exc => exc.document_id).filter(Boolean))];
      const documentMap = {};
      if (documentIds.length > 0) {
        try {
          const documents = await Promise.all(
            documentIds.map(id => documentsService.getById(id).catch(() => null))
          );
          documents.forEach((doc, index) => {
            if (doc) {
              documentMap[documentIds[index]] = doc;
            }
          });
        } catch (err) {
          console.warn('Failed to load document details:', err);
        }
      }
      
      // Transform API data
      const transformed = data.map(exc => {
        const document = exc.document_id ? documentMap[exc.document_id] : null;
        let docType = 'Unknown';
        if (document) {
          if (document.document_type) {
            docType = document.document_type;
          } else if (document.transaction_set) {
            docType = `X12 ${document.transaction_set}`;
          }
        } else if (exc.document_id) {
          // Fallback: try to infer from exception data
          docType = 'X12 850'; // Default assumption
        }
        
        return {
          id: exc._id || exc.id,
          fileId: exc.document_id || 'Unknown',
          partner: exc.partner_code || 'Unknown',
          docType,
          exceptionType: exc.exception_type,
          severity: exc.severity,
          status: exc.status,
          confidence: exc.ai_confidence_score ? Math.round(exc.ai_confidence_score * 100) : 0,
          description: exc.description,
          aiSuggestion: exc.ai_suggestion,
          createdAt: exc.created_at,
          createdTime: exc.created_at ? new Date(exc.created_at).toLocaleTimeString() : 'Unknown',
          assignedTo: exc.resolved_by || 'Unassigned',
          resolvedAt: exc.resolved_at,
        };
      });
      
      setExceptions(transformed);
      
      // Update KPIs
      try {
        const allExceptions = await exceptionsService.getAll({ limit: 1000, forceApi: true });
        if (!Array.isArray(allExceptions)) {
          console.warn('Invalid KPI data format, using current page data');
          // Use current page data for KPIs
          const openExceptions = transformed.filter(e => e.status === 'Open');
          const resolvedToday = transformed.filter(e => {
            if (!e.resolvedAt) return false;
            const resolvedDate = new Date(e.resolvedAt);
            const today = new Date();
            return resolvedDate.toDateString() === today.toDateString();
          });
          const lowConfidence = transformed.filter(e => e.confidence < 75);
          const critical = transformed.filter(e => e.severity === 'Critical');
          
          setKpiData([
            {
              title: 'Active Exceptions',
              value: openExceptions.length.toString(),
              subtitle: 'Requiring attention',
              trend: 'down',
              trendValue: '-8',
              variant: 'warning',
              icon: AlertTriangle,
            },
            {
              title: 'Resolved Today',
              value: resolvedToday.length.toString(),
              subtitle: 'Last 24 hours',
              trend: 'up',
              trendValue: '+5',
              variant: 'success',
              icon: CheckCircle2,
            },
            {
              title: 'Low Confidence',
              value: lowConfidence.length.toString(),
              subtitle: 'AI needs review',
              trend: 'down',
              trendValue: '-3',
              variant: 'warning',
              icon: Brain,
            },
            {
              title: 'Critical Errors',
              value: critical.length.toString(),
              subtitle: 'Immediate action needed',
              trend: 'down',
              trendValue: '-2',
              variant: 'error',
              icon: XCircle,
            },
          ]);
          return;
        }
        
        const openExceptions = allExceptions.filter(e => e.status === 'Open');
        const resolvedToday = allExceptions.filter(e => {
          if (!e.resolved_at) return false;
          const resolvedDate = new Date(e.resolved_at);
          const today = new Date();
          return resolvedDate.toDateString() === today.toDateString();
        });
        const lowConfidence = allExceptions.filter(e => e.ai_confidence_score && e.ai_confidence_score < 0.75);
        const critical = allExceptions.filter(e => e.severity === 'Critical');
        
        setKpiData([
          {
            title: 'Active Exceptions',
            value: openExceptions.length.toString(),
            subtitle: 'Requiring attention',
            trend: 'down',
            trendValue: '-8',
            variant: 'warning',
            icon: AlertTriangle,
          },
          {
            title: 'Resolved Today',
            value: resolvedToday.length.toString(),
            subtitle: 'Last 24 hours',
            trend: 'up',
            trendValue: '+5',
            variant: 'success',
            icon: CheckCircle2,
          },
          {
            title: 'Low Confidence',
            value: lowConfidence.length.toString(),
            subtitle: 'AI needs review',
            trend: 'down',
            trendValue: '-3',
            variant: 'warning',
            icon: Brain,
          },
          {
            title: 'Critical Errors',
            value: critical.length.toString(),
            subtitle: 'Immediate action needed',
            trend: 'down',
            trendValue: '-2',
            variant: 'error',
            icon: XCircle,
          },
        ]);
      } catch (kpiErr) {
        console.warn('Error loading KPI data:', kpiErr);
        // Use current page data for KPIs as fallback
        const openExceptions = transformed.filter(e => e.status === 'Open');
        const resolvedToday = transformed.filter(e => {
          if (!e.resolvedAt) return false;
          const resolvedDate = new Date(e.resolvedAt);
          const today = new Date();
          return resolvedDate.toDateString() === today.toDateString();
        });
        const lowConfidence = transformed.filter(e => e.confidence < 75);
        const critical = transformed.filter(e => e.severity === 'Critical');
        
        setKpiData([
          {
            title: 'Active Exceptions',
            value: openExceptions.length.toString(),
            subtitle: 'Requiring attention',
            trend: 'down',
            trendValue: '-8',
            variant: 'warning',
            icon: AlertTriangle,
          },
          {
            title: 'Resolved Today',
            value: resolvedToday.length.toString(),
            subtitle: 'Last 24 hours',
            trend: 'up',
            trendValue: '+5',
            variant: 'success',
            icon: CheckCircle2,
          },
          {
            title: 'Low Confidence',
            value: lowConfidence.length.toString(),
            subtitle: 'AI needs review',
            trend: 'down',
            trendValue: '-3',
            variant: 'warning',
            icon: Brain,
          },
          {
            title: 'Critical Errors',
            value: critical.length.toString(),
            subtitle: 'Immediate action needed',
            trend: 'down',
            trendValue: '-2',
            variant: 'error',
            icon: XCircle,
          },
        ]);
      }
    } catch (err) {
      console.error('Error loading exceptions:', err);
      let errorMessage = 'Failed to load exceptions';
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
        errorMessage = 'Failed to load exceptions - Network or parsing error';
      }
      toast.error(`Failed to load exceptions: ${errorMessage}`);
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  };

  const itemsPerPage = 50;
  const totalItems = exceptions.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getSeverityBadge = (severity) => {
    const severityConfig = {
      'Critical': { variant: 'error', bg: 'bg-error-bg', text: 'text-error-foreground' },
      'High': { variant: 'error', bg: 'bg-error-bg', text: 'text-error-foreground' },
      'Medium': { variant: 'warning', bg: 'bg-warning-bg', text: 'text-warning-foreground' },
      'Low': { variant: 'secondary', bg: 'bg-muted', text: 'text-muted-foreground' },
    };

    const config = severityConfig[severity] || severityConfig['Medium'];
    return (
      <Badge variant={config.variant} className={`${config.bg} ${config.text} border-0`}>
        {severity}
      </Badge>
    );
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Open': { variant: 'warning', icon: AlertTriangle },
      'In Review': { variant: 'processing', icon: Clock },
      'Resolved': { variant: 'success', icon: CheckCircle2 },
    };

    const config = statusConfig[status] || statusConfig['Open'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1.5">
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const getExceptionTypeBadge = (type) => {
    return (
      <Badge variant="outline" className="text-xs">
        {type}
      </Badge>
    );
  };

  const handleViewDetails = (fileId) => {
    navigate(`/document/${fileId}`);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const filteredExceptions = exceptions.filter(exc => {
    if (filters.search && !exc.fileId.toLowerCase().includes(filters.search.toLowerCase()) && 
        !exc.partner.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.partner !== 'all' && exc.partner !== filters.partner) {
      return false;
    }
    if (filters.severity !== 'all' && exc.severity !== filters.severity) {
      return false;
    }
    if (filters.status !== 'all' && exc.status !== filters.status) {
      return false;
    }
    if (filters.exceptionType !== 'all' && exc.exceptionType !== filters.exceptionType) {
      return false;
    }
    return true;
  });

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExceptions = filteredExceptions.slice(startIndex, endIndex);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-warning" />
          Exceptions - Management by Exception
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and resolve exceptions flagged by the AI when confidence is low or business rules are violated
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <KPICard key={index} {...kpi} />
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Date Range</label>
              <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="last7days">Last 7 Days</SelectItem>
                  <SelectItem value="last30days">Last 30 Days</SelectItem>
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
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <Select value={filters.severity} onValueChange={(value) => handleFilterChange('severity', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
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
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Review">In Review</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Exception Type</label>
              <Select value={filters.exceptionType} onValueChange={(value) => handleFilterChange('exceptionType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Low Confidence">Low Confidence</SelectItem>
                  <SelectItem value="Validation Error">Validation Error</SelectItem>
                  <SelectItem value="Mapping Error">Mapping Error</SelectItem>
                  <SelectItem value="Business Rule Violation">Business Rule Violation</SelectItem>
                  <SelectItem value="Transport Error">Transport Error</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="File ID, Partner..."
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
                  <TableHead className="font-semibold">Exception Type</TableHead>
                  <TableHead className="font-semibold">Severity</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">AI Confidence</TableHead>
                  <TableHead className="font-semibold">Description</TableHead>
                  <TableHead className="font-semibold">Created At</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedExceptions.length > 0 ? (
                  paginatedExceptions.map((exc) => (
                    <TableRow
                      key={exc.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleViewDetails(exc.fileId)}
                    >
                      <TableCell 
                        className="font-mono text-sm font-medium text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(exc.fileId);
                        }}
                      >
                        {exc.fileId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 rounded-md flex items-center justify-center">
                            <span className="text-xs font-semibold text-primary">
                              {exc.partner.charAt(0)}
                            </span>
                          </div>
                          <span className="font-medium">{exc.partner}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getExceptionTypeBadge(exc.exceptionType)}</TableCell>
                      <TableCell>{getSeverityBadge(exc.severity)}</TableCell>
                      <TableCell>{getStatusBadge(exc.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={exc.confidence} className="h-2 w-20" />
                          <span className="text-xs font-medium">{exc.confidence}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="text-sm truncate" title={exc.description}>
                            {exc.description}
                          </p>
                          {exc.aiSuggestion && (
                            <p className="text-xs text-muted-foreground mt-1">
                              AI: {exc.aiSuggestion}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{exc.createdTime}</TableCell>
                      <TableCell 
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(exc.fileId)}
                          className="hover:bg-primary hover:text-primary-foreground"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No exceptions found matching your filters
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

      {/* Info Message */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium mb-1">Management by Exception</p>
              <p className="text-sm text-muted-foreground">
                The AI processes most transactions autonomously. Exceptions are only flagged when confidence 
                is below threshold (&lt;75%) or when business rules are violated. Review and resolve exceptions 
                to help the AI learn and improve.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
