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
      completed: {
        label: 'Completed',
        className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      'ready for dispatch': {
        label: 'Ready for Dispatch',
        className: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      dispatched: {
        label: 'Dispatched',
        className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      delivered: {
        label: 'Delivered',
        className: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      warning: {
        label: 'Warning',
        className: 'bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      error: {
        label: 'Error',
        className: 'bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      failed: {
        label: 'Failed',
        className: 'bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      processing: {
        label: 'Processing',
        className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded font-medium'
      },
      routing: { label: 'Routing', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded font-medium' },
      delivering: { label: 'Delivering', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded font-medium' },
    };
    
    const config = statusMap[(status || '').toLowerCase()] || { label: status || 'Processing', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded font-medium' };
    return <span className={config.className}>{config.label}</span>;
  };
  
  const handleViewDetails = (id) => {
    navigate(`/document/${id}`);
  };
  
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-800/80 border-b border-slate-700 hover:bg-slate-800/80">
            <TableHead className="text-xs font-medium text-slate-400 uppercase">File ID</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase">Timestamp</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase">Partner</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase">Doc Type</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase">Direction</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase">Status</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase">Current Stage</TableHead>
            <TableHead className="text-xs font-medium text-slate-400 uppercase text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow 
              key={row.id} 
              className="hover:bg-slate-800/50 transition-colors cursor-pointer border-b border-slate-700/50"
              onClick={() => handleViewDetails(row.id)}
            >
              <TableCell 
                className="text-sm font-medium text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(row.id);
                }}
              >
                {row.id}
              </TableCell>
              <TableCell className="text-sm text-slate-400">{row.timestamp}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-300">{row.partner.charAt(0)}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-200">{row.partner}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="bg-slate-700/80 text-slate-300 border-0 text-xs">
                  {row.docType}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className={row.direction === 'Inbound' 
                  ? 'bg-blue-500/20 text-blue-400 border-0 text-xs'
                  : 'bg-slate-600/80 text-slate-300 border-0 text-xs'}>
                  {row.direction}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(row.status)}</TableCell>
              <TableCell className="text-sm text-slate-400">{row.stage}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(row.id);
                  }}
                  className="hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <Eye className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
