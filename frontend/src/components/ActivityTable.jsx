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
        label: 'COMPLETED', 
        className: 'bg-gradient-to-r from-green-600/30 to-emerald-600/30 border-2 border-green-500/50 text-green-300 font-mono font-bold text-xs px-2 py-1 rounded shadow-lg shadow-green-500/30' 
      },
      warning: { 
        label: 'WARNING', 
        className: 'bg-gradient-to-r from-yellow-600/30 to-amber-600/30 border-2 border-yellow-500/50 text-yellow-300 font-mono font-bold text-xs px-2 py-1 rounded shadow-lg shadow-yellow-500/30' 
      },
      error: { 
        label: 'ERROR', 
        className: 'bg-gradient-to-r from-red-600/30 to-pink-600/30 border-2 border-red-500/50 text-red-300 font-mono font-bold text-xs px-2 py-1 rounded shadow-lg shadow-red-500/30' 
      },
      processing: { 
        label: 'PROCESSING', 
        className: 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-2 border-cyan-500/50 text-cyan-300 font-mono font-bold text-xs px-2 py-1 rounded shadow-lg shadow-cyan-500/30' 
      },
    };
    
    const config = statusMap[status.toLowerCase()] || statusMap.processing;
    return <span className={config.className}>{config.label}</span>;
  };
  
  const handleViewDetails = (id) => {
    navigate(`/document/${id}`);
  };
  
  return (
    <div className="rounded-lg border-2 border-cyan-500/30 bg-black/60 overflow-hidden shadow-2xl shadow-cyan-500/10">
      <Table>
        <TableHeader>
          <TableRow className="bg-black/60 border-b-2 border-cyan-500/30">
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">File ID</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">Timestamp</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">Partner</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">Doc Type</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">Direction</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">Status</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase">Current Stage</TableHead>
            <TableHead className="font-bold text-cyan-300 font-mono text-xs uppercase text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow 
              key={row.id} 
              className="hover:bg-black/60 transition-colors cursor-pointer border-b border-cyan-500/10"
              onClick={() => handleViewDetails(row.id)}
            >
              <TableCell 
                className="font-mono text-sm text-cyan-300 font-bold hover:text-cyan-200"
                onClick={(e) => {
                  e.stopPropagation();
                  handleViewDetails(row.id);
                }}
              >
                {row.id}
              </TableCell>
              <TableCell className="font-mono text-sm text-purple-300/70">{row.timestamp}</TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600/30 to-pink-600/30 border-2 border-purple-500/50 rounded-md flex items-center justify-center">
                    <span className="text-xs font-bold text-purple-300">{row.partner.charAt(0)}</span>
                  </div>
                  <span className="font-bold text-cyan-200">{row.partner}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge className="font-mono bg-black/60 border-2 border-cyan-500/30 text-cyan-300">{row.docType}</Badge>
              </TableCell>
              <TableCell>
                <Badge className={row.direction === 'Inbound' 
                  ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/30 border-2 border-cyan-500/50 text-cyan-300 font-mono font-bold'
                  : 'bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-2 border-purple-500/50 text-purple-300 font-mono font-bold'}>
                  {row.direction}
                </Badge>
              </TableCell>
              <TableCell>{getStatusBadge(row.status)}</TableCell>
              <TableCell className="text-sm text-cyan-400/70 font-mono">{row.stage}</TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewDetails(row.id);
                  }}
                  className="hover:bg-cyan-600/30 hover:border-cyan-500/50 border-2 border-transparent"
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
