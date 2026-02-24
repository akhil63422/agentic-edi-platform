import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  Download, 
  Play, 
  Send, 
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export const DocumentDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expandedSegments, setExpandedSegments] = useState(['header']);
  const [suggestionResolved, setSuggestionResolved] = useState(false);
  const [resolvedValue, setResolvedValue] = useState(null); // null = unresolved, 'suggested' | 'original' = resolved
  
  // Mock data
  const documentData = {
    id: id || 'PO_8932',
    partner: 'Walmart',
    docType: 'X12 850',
    status: 'Warning',
    confidence: 76,
    timestamp: '2024-01-15 14:23:45',
    aiSuggestion: {
      field: 'Purchase Order Number',
      detected: 'PO893245',
      suggested: 'PO-893245',
      reason: 'Format mismatch: Expected hyphen separator based on historical patterns',
      confidence: 92,
    },
  };
  
  const rawEDI = `ISA*00*          *00*          *ZZ*SENDER         *ZZ*WALMART        *240115*1423*U*00401*000000001*0*P*>~
GS*PO*SENDER*WALMART*20240115*1423*1*X*004010~
ST*850*0001~
BEG*00*SA*PO893245**20240115~
CUR*BY*USD~
REF*DP*001~
REF*IA*BUYER001~
PER*BD*John Doe*TE*555-0100~
N1*BY*WALMART INC*92*123456789~
N3*702 SW 8TH STREET~
N4*BENTONVILLE*AR*72716*US~
PO1*1*100*EA*24.99**VP*SKU123456*BP*PROD789~
PID*F****PRODUCT DESCRIPTION HERE~
SE*13*0001~
GE*1*1~
IEA*1*000000001~`;
  
  const [parsedStructure, setParsedStructure] = useState([
    {
      segment: 'header',
      label: 'Transaction Set Header',
      fields: [
        { name: 'Transaction Set ID', value: '850', status: 'ok' },
        { name: 'Transaction Set Control Number', value: '0001', status: 'ok' },
      ],
    },
    {
      segment: 'beginning',
      label: 'Beginning Segment',
      fields: [
        { name: 'Transaction Set Purpose', value: '00', status: 'ok' },
        { name: 'Purchase Order Type', value: 'SA', status: 'ok' },
        { name: 'Purchase Order Number', value: 'PO893245', status: 'warning' },
        { name: 'Date', value: '20240115', status: 'ok' },
      ],
    },
    {
      segment: 'party',
      label: 'Party Information',
      fields: [
        { name: 'Entity Identifier', value: 'BY', status: 'ok' },
        { name: 'Name', value: 'WALMART INC', status: 'ok' },
        { name: 'ID Qualifier', value: '92', status: 'ok' },
        { name: 'ID Code', value: '123456789', status: 'ok' },
      ],
    },
    {
      segment: 'lineitem',
      label: 'Line Item Details',
      fields: [
        { name: 'Line Number', value: '1', status: 'ok' },
        { name: 'Quantity', value: '100', status: 'ok' },
        { name: 'Unit', value: 'EA', status: 'ok' },
        { name: 'Unit Price', value: '24.99', status: 'ok' },
        { name: 'SKU', value: 'SKU123456', status: 'ok' },
      ],
    },
  ]);
  
  const [canonicalJSON, setCanonicalJSON] = useState({
    purchaseOrder: {
      poNumber: 'PO893245',
      poDate: '2024-01-15',
      poType: 'Standard',
      buyer: {
        name: 'WALMART INC',
        id: '123456789',
        address: {
          street: '702 SW 8TH STREET',
          city: 'BENTONVILLE',
          state: 'AR',
          zip: '72716',
          country: 'US',
        },
        contact: {
          name: 'John Doe',
          phone: '555-0100',
        },
      },
      lineItems: [
        {
          lineNumber: 1,
          sku: 'SKU123456',
          productId: 'PROD789',
          description: 'PRODUCT DESCRIPTION HERE',
          quantity: 100,
          unit: 'EA',
          unitPrice: 24.99,
          totalPrice: 2499.00,
        },
      ],
      currency: 'USD',
    },
  });
  
  const handleApplySuggestion = () => {
    const suggested = documentData.aiSuggestion.suggested;
    setParsedStructure(prev =>
      prev.map(seg =>
        seg.segment === 'beginning'
          ? {
              ...seg,
              fields: seg.fields.map(f =>
                f.name === 'Purchase Order Number'
                  ? { ...f, value: suggested, status: 'ok' }
                  : f
              ),
            }
          : seg
      )
    );
    setCanonicalJSON(prev => ({
      ...prev,
      purchaseOrder: {
        ...prev.purchaseOrder,
        poNumber: suggested,
      },
    }));
    setSuggestionResolved(true);
    setResolvedValue('suggested');
  };

  const handleKeepOriginal = () => {
    setParsedStructure(prev =>
      prev.map(seg =>
        seg.segment === 'beginning'
          ? {
              ...seg,
              fields: seg.fields.map(f =>
                f.name === 'Purchase Order Number'
                  ? { ...f, status: 'ok' }
                  : f
              ),
            }
          : seg
      )
    );
    setSuggestionResolved(true);
    setResolvedValue('original');
  };
  
  const toggleSegment = (segment) => {
    setExpandedSegments(prev => 
      prev.includes(segment) 
        ? prev.filter(s => s !== segment)
        : [...prev, segment]
    );
  };
  
  return (
    <div className="p-8 space-y-6 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-foreground">{documentData.id}</h1>
              <Badge className="status-badge warning">Exception</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {documentData.partner} · {documentData.docType} · {documentData.timestamp}
            </p>
          </div>
        </div>
        
        {/* Confidence Gauge */}
        <Card className="w-48 bg-warning-bg border-warning">
          <CardContent className="p-4">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="40"
                    cy="40"
                    r="32"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="none"
                    strokeDasharray={`${documentData.confidence * 2} 200`}
                    className="text-warning"
                  />
                </svg>
                <div className="absolute">
                  <span className="text-2xl font-bold text-foreground">{documentData.confidence}%</span>
                </div>
              </div>
              <p className="text-xs font-medium text-warning-foreground mt-2">
                Below Threshold
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* AI Suggestion Banner */}
      {!suggestionResolved ? (
        <Card className="bg-warning-bg border-warning">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-warning-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-warning-foreground">AI Suggestion Pending</p>
                <p className="text-sm text-warning-foreground/80 mt-1">
                  The AI detected a potential issue with <span className="font-semibold">{documentData.aiSuggestion.field}</span>. 
                  Review the suggestion below and approve or override.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <p className="text-xs text-warning-foreground/70">AI Confidence</p>
                  <p className="text-lg font-bold text-warning-foreground">{documentData.aiSuggestion.confidence}%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-success-bg border-success">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-success-foreground flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-success-foreground">
                  {resolvedValue === 'suggested' ? 'Suggestion Applied' : 'Original Kept'}
                </p>
                <p className="text-sm text-success-foreground/80 mt-1">
                  {resolvedValue === 'suggested'
                    ? `The ${documentData.aiSuggestion.field} has been updated to "${documentData.aiSuggestion.suggested}".`
                    : `The ${documentData.aiSuggestion.field} remains "${documentData.aiSuggestion.detected}" as per your choice.`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Three-Pane Layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Pane 1: Raw X12 */}
        <Card className="col-span-1">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-base font-semibold flex items-center">
              Raw X12 Document
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="bg-muted rounded-lg p-4 max-h-[600px] overflow-y-auto scrollbar-thin">
              <pre className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap break-all">
                {rawEDI}
              </pre>
            </div>
          </CardContent>
        </Card>
        
        {/* Pane 2: Parsed Structure */}
        <Card className="col-span-1">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-base font-semibold">Parsed EDI Structure</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
              {parsedStructure.map((segment) => {
                const isExpanded = expandedSegments.includes(segment.segment);
                const hasWarning = segment.fields.some(f => f.status === 'warning');
                
                return (
                  <div key={segment.segment} className={`border rounded-lg ${
                    hasWarning ? 'border-warning bg-warning-bg' : 'border-border bg-card'
                  }`}>
                    <button
                      onClick={() => toggleSegment(segment.segment)}
                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/30 transition-colors rounded-lg"
                    >
                      <span className="font-medium text-sm text-foreground">{segment.label}</span>
                      <div className="flex items-center space-x-2">
                        {hasWarning && (
                          <AlertCircle className="w-4 h-4 text-warning-foreground" />
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        {segment.fields.map((field, idx) => (
                          <div 
                            key={idx} 
                            className={`flex items-start justify-between py-2 px-2 rounded ${
                              field.status === 'warning' ? 'bg-warning-bg' : ''
                            }`}
                          >
                            <span className="text-xs text-muted-foreground flex-1">{field.name}</span>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-mono font-medium text-foreground">{field.value}</span>
                              {field.status === 'warning' ? (
                                <AlertCircle className="w-3 h-3 text-warning-foreground" />
                              ) : (
                                <CheckCircle className="w-3 h-3 text-success" />
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {hasWarning && !suggestionResolved && (
                          <div className="mt-3 p-3 bg-card rounded-lg border border-warning">
                            <p className="text-xs font-semibold text-warning-foreground mb-2">
                              AI Suggests:
                            </p>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Detected:</span>
                                <span className="font-mono font-medium text-foreground">{documentData.aiSuggestion.detected}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Suggested:</span>
                                <span className="font-mono font-medium text-primary">{documentData.aiSuggestion.suggested}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              {documentData.aiSuggestion.reason}
                            </p>
                            <div className="flex space-x-2 mt-3">
                              <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleApplySuggestion}>
                                Apply Suggestion
                              </Button>
                              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={handleKeepOriginal}>
                                Keep Original
                              </Button>
                            </div>
                          </div>
                        )}
                        {segment.segment === 'beginning' && suggestionResolved && (
                          <div className="mt-3 p-3 bg-success-bg rounded-lg border border-success">
                            <p className="text-xs font-semibold text-success-foreground flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                              {resolvedValue === 'suggested' ? 'Suggestion applied' : 'Original kept'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        {/* Pane 3: Canonical JSON */}
        <Card className="col-span-1">
          <CardHeader className="bg-muted/50">
            <CardTitle className="text-base font-semibold">Canonical Business Object</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="bg-muted rounded-lg p-4 max-h-[600px] overflow-y-auto scrollbar-thin">
              <pre className="font-mono text-xs text-foreground leading-relaxed">
                {JSON.stringify(canonicalJSON, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Action Footer */}
      <Card className="bg-card sticky bottom-0 shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Download Audit Report
              </Button>
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="secondary" size="sm">
                <Play className="w-4 h-4 mr-2" />
                Re-run Translation
              </Button>
              <Button size="sm" className="bg-primary hover:bg-primary-hover">
                <Send className="w-4 h-4 mr-2" />
                Send to ERP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
