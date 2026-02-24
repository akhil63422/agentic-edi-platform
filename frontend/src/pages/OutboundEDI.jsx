import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowUpFromLine, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Send
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

export const OutboundEDI = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    dateRange: 'last7days',
    partner: 'all',
    docType: 'all',
    status: 'all',
    search: '',
  });

  // Mock KPI data for Outbound
  const kpiData = [
    {
      title: 'Total Outbound Files',
      value: '892',
      subtitle: 'Last 7 days',
      trend: 'up',
      trendValue: '+8%',
      icon: FileText,
    },
    {
      title: 'Successfully Sent',
      value: '856',
      subtitle: '96.0% success rate',
      trend: 'up',
      trendValue: '+1.5%',
      variant: 'success',
      icon: Send,
    },
    {
      title: 'Pending Delivery',
      value: '28',
      subtitle: 'Awaiting acknowledgment',
      trend: 'down',
      trendValue: '-3',
      variant: 'warning',
      icon: Clock,
    },
    {
      title: 'Failed',
      value: '8',
      subtitle: 'Requires action',
      trend: 'down',
      trendValue: '-2',
      variant: 'error',
      icon: XCircle,
    },
  ];

  // Mock transaction data for Outbound
  const transactions = [
    {
      id: 'INV_4521',
      fileId: 'INV_4521',
      partner: 'Walmart',
      docType: 'X12 810',
      direction: 'Outbound',
      status: 'Completed',
      currentStage: 'ACK Received',
      sentAt: '10:35 AM',
      timestamp: '2024-01-15 10:35',
    },
    {
      id: 'INV_4520',
      fileId: 'INV_4520',
      partner: 'Target',
      docType: 'X12 810',
      direction: 'Outbound',
      status: 'Pending ACK',
      currentStage: 'Sent to Partner',
      sentAt: '10:15 AM',
      timestamp: '2024-01-15 10:15',
    },
    {
      id: 'ASN_7835',
      fileId: 'ASN_7835',
      partner: 'Amazon',
      docType: 'X12 856',
      direction: 'Outbound',
      status: 'Failed',
      currentStage: 'Transmission Failed',
      sentAt: '09:45 AM',
      timestamp: '2024-01-15 09:45',
    },
    {
      id: 'PO_ACK_8932',
      fileId: 'PO_ACK_8932',
      partner: 'Home Depot',
      docType: 'X12 855',
      direction: 'Outbound',
      status: 'Completed',
      currentStage: 'ACK Received',
      sentAt: '09:20 AM',
      timestamp: '2024-01-15 09:20',
    },
    {
      id: 'INV_4519',
      fileId: 'INV_4519',
      partner: 'Costco',
      docType: 'X12 810',
      direction: 'Outbound',
      status: 'Processing',
      currentStage: 'Building EDI',
      sentAt: '08:55 AM',
      timestamp: '2024-01-15 08:55',
    },
    {
      id: 'ASN_7834',
      fileId: 'ASN_7834',
      partner: 'Kroger',
      docType: 'X12 856',
      direction: 'Outbound',
      status: 'Completed',
      currentStage: 'ACK Received',
      sentAt: '08:30 AM',
      timestamp: '2024-01-15 08:30',
    },
    {
      id: 'INV_4518',
      fileId: 'INV_4518',
      partner: 'Walmart',
      docType: 'X12 810',
      direction: 'Outbound',
      status: 'Needs Review',
      currentStage: 'Validation',
      sentAt: '08:10 AM',
      timestamp: '2024-01-15 08:10',
    },
    {
      id: 'PO_ACK_8931',
      fileId: 'PO_ACK_8931',
      partner: 'Target',
      docType: 'X12 855',
      direction: 'Outbound',
      status: 'Completed',
      currentStage: 'ACK Received',
      sentAt: '7:45 AM',
      timestamp: '2024-01-15 07:45',
    },
  ];

  const itemsPerPage = 50;
  const totalItems = 892;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Completed': { variant: 'success', icon: CheckCircle2, bg: 'bg-success-bg', text: 'text-success-foreground' },
      'Needs Review': { variant: 'warning', icon: AlertTriangle, bg: 'bg-warning-bg', text: 'text-warning-foreground' },
      'Failed': { variant: 'error', icon: XCircle, bg: 'bg-error-bg', text: 'text-error-foreground' },
      'Processing': { variant: 'processing', icon: Clock, bg: 'bg-processing', text: 'text-processing-foreground' },
      'Pending ACK': { variant: 'warning', icon: Clock, bg: 'bg-warning-bg', text: 'text-warning-foreground' },
      'ACK Received': { variant: 'success', icon: CheckCircle2, bg: 'bg-success-bg', text: 'text-success-foreground' },
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

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <ArrowUpFromLine className="w-8 h-8 text-primary" />
          Outbound EDI - Flow Monitor
        </h1>
        <p className="text-muted-foreground mt-1">Monitor and manage all outbound EDI transactions</p>
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
                  <SelectItem value="Costco">Costco</SelectItem>
                  <SelectItem value="Kroger">Kroger</SelectItem>
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
                  <SelectItem value="X12 810">X12 810 (Invoice)</SelectItem>
                  <SelectItem value="X12 856">X12 856 (ASN)</SelectItem>
                  <SelectItem value="X12 855">X12 855 (PO ACK)</SelectItem>
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
                  <SelectItem value="Pending ACK">Pending ACK</SelectItem>
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
                  <TableHead className="font-semibold">Sent At</TableHead>
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
                        <Badge variant="secondary" className="gap-1">
                          <ArrowUpFromLine className="w-3 h-3" />
                          {tx.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.currentStage}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{tx.sentAt}</TableCell>
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
        All outbound EDI files are processing normally.
      </div>
    </div>
  );
};
