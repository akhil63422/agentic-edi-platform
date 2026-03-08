import React, { useState } from 'react';
import { Upload, FileText, X, Brain, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import api from '@/services/api';

export const Step5Specifications = ({ data, onChange }) => {
  const [schemaAnalysis, setSchemaAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyzeSchema = async () => {
    const samples = data.sampleFiles || [];
    const sourceSchema = { segments: [], document_type: data.ediStandard || 'X12 850' };
    if (samples.length > 0 && samples[0].file) {
      try {
        const text = await samples[0].file.text();
        const segmentMatches = text.match(/[A-Z]{2,4}\*/g) || [];
        sourceSchema.segments = [...new Set(segmentMatches.map((s) => s.replace('*', '')))];
      } catch {
        sourceSchema.segments = ['ISA', 'GS', 'ST', 'BEG', 'N1', 'IT1', 'SE', 'GE', 'IEA'];
      }
    } else {
      sourceSchema.segments = ['ISA', 'GS', 'ST', 'BEG', 'N1', 'IT1', 'SE', 'GE', 'IEA'];
    }
    const targetSchema = { fields: ['purchase_order_number', 'buyer_name', 'line_items', 'product_code', 'quantity'] };
    setAnalyzing(true);
    try {
      const res = await api.post('/ai/analyze-schema', {
        source_schema: sourceSchema,
        target_schema: targetSchema,
        document_type: data.ediStandard || '850',
      });
      setSchemaAnalysis(res.data.analysis);
      onChange({ schemaAnalysis: res.data.analysis });
    } catch (e) {
      setSchemaAnalysis({ notes: 'Analysis failed: ' + (e.response?.data?.detail || e.message) });
    } finally {
      setAnalyzing(false);
    }
  };
  const handleFileUpload = (type, files) => {
    const fileList = Array.from(files).map((file) => ({
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      file: file,
    }));

    const currentFiles = data[type] || [];
    onChange({
      [type]: [...currentFiles, ...fileList],
    });
  };

  const handleRemoveFile = (type, id) => {
    const files = (data[type] || []).filter((f) => f.id !== id);
    onChange({ [type]: files });
  };

  const handleExceptionRulesChange = (value) => {
    onChange({ exceptionRules: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Upload Partner Specifications</h2>
        <p className="text-muted-foreground">
          Upload EDI specification documents and sample files. The Discovery Agent will analyze these to learn partner behavior.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>EDI Specification Documents</CardTitle>
          <CardDescription>
            Upload PDF or Excel files containing EDI specifications, mapping guides, or implementation guides
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <Label htmlFor="specFiles" className="cursor-pointer">
              <span className="text-primary hover:underline">Click to upload</span> or drag and drop
            </Label>
            <Input
              id="specFiles"
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.doc,.docx"
              className="hidden"
              onChange={(e) => handleFileUpload('specFiles', e.target.files)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              PDF, Excel, Word documents (MAX. 10MB per file)
            </p>
          </div>

          {data.specFiles && data.specFiles.length > 0 && (
            <div className="space-y-2">
              {data.specFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFile('specFiles', file.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sample EDI Files</CardTitle>
          <CardDescription>
            Upload sample EDI transaction files. These help the system understand actual partner data formats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <Label htmlFor="sampleFiles" className="cursor-pointer">
              <span className="text-primary hover:underline">Click to upload</span> or drag and drop
            </Label>
            <Input
              id="sampleFiles"
              type="file"
              multiple
              accept=".edi,.txt,.x12"
              className="hidden"
              onChange={(e) => handleFileUpload('sampleFiles', e.target.files)}
            />
            <p className="text-xs text-muted-foreground mt-2">
              EDI, TXT files (MAX. 5MB per file)
            </p>
          </div>

          {data.sampleFiles && data.sampleFiles.length > 0 && (
            <div className="space-y-2">
              {data.sampleFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border border-border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFile('sampleFiles', file.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exception Rules</CardTitle>
          <CardDescription>
            Document any special rules, exceptions, or partner-specific quirks that the Discovery Agent should know about
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.exceptionRules || ''}
            onChange={(e) => handleExceptionRulesChange(e.target.value)}
            placeholder="Example: Partner uses non-standard date format YYYYMMDD instead of YYYY-MM-DD..."
            rows={6}
            className="font-mono text-sm"
          />
        </CardContent>
      </Card>

      {/* Schema Analysis (AI /analyze-schema) */}
      {(data.specFiles?.length > 0 || data.sampleFiles?.length > 0) && (
        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Schema Understanding Agent
            </CardTitle>
            <CardDescription>
              AI analyzes source vs target schema. Assist Mode — review before use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleAnalyzeSchema} disabled={analyzing} variant="outline" className="gap-2">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {analyzing ? 'Analyzing...' : 'Analyze Schema with AI'}
            </Button>
            {schemaAnalysis && (
              <div className="text-sm space-y-2 p-3 bg-background rounded border">
                {schemaAnalysis.notes && <p className="text-muted-foreground">{schemaAnalysis.notes}</p>}
                {schemaAnalysis.mapping_complexity && (
                  <p><strong>Complexity:</strong> {schemaAnalysis.mapping_complexity}</p>
                )}
                {schemaAnalysis.canonical_suggestions?.length > 0 && (
                  <p><strong>Canonical suggestions:</strong> {Array.isArray(schemaAnalysis.canonical_suggestions) ? schemaAnalysis.canonical_suggestions.map((s) => (typeof s === 'string' ? s : s?.name || JSON.stringify(s))).join(', ') : ''}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
