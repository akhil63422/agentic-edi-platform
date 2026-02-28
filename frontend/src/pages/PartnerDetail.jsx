import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { partnersService } from '@/services/partners';
import { 
  ArrowLeft, 
  Edit, 
  Settings, 
  FileText, 
  Link2, 
  Server, 
  CheckCircle2, 
  AlertTriangle,
  AlertCircle,
  Clock,
  XCircle,
  Database,
  Globe,
  Brain,
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const DOC_NAMES = { '850': 'Purchase Order', '810': 'Invoice', '856': 'Advance Ship Notice', '997': 'Functional Acknowledgment' };

const mapApiPartnerToUI = (api) => {
  if (!api) return null;
  const bc = api.business_contact;
  const tc = api.technical_contact;
  const edi = api.edi_config;
  const erp = api.erp_context;
  const docs = api.document_agreements || [];
  const transport = api.transport_config;
  const creds = transport?.credentials || {};
  return {
    id: api._id || api.id,
    name: api.business_name || '',
    code: api.partner_code || '',
    role: api.role || 'Both',
    status: api.status || 'Draft',
    industry: api.industry || null,
    country: api.country || null,
    timezone: api.timezone || null,
    businessContact: bc ? { name: bc.name || '', email: bc.email || '', phone: bc.phone || '' } : { name: '', email: '', phone: '' },
    technicalContact: tc ? { name: tc.name || '', email: tc.email || '', phone: tc.phone || '' } : { name: '', email: '', phone: '' },
    ediProfile: edi ? {
      standard: edi.standard || 'X12',
      version: edi.version || '5010',
      functionalGroups: edi.functional_group ? [edi.functional_group] : [],
      characterSet: edi.character_set || 'UTF-8',
      delimiters: edi.delimiters || { element: '*', segment: '~', subElement: '>' },
      isaSenderId: edi.isa_sender_id || '',
      isaReceiverId: edi.isa_receiver_id || '',
      gsIds: edi.gs_ids || { sender: '', receiver: '' },
    } : { standard: 'X12', version: '5010', functionalGroups: [], characterSet: 'UTF-8', delimiters: { element: '*', segment: '~', subElement: '>' }, isaSenderId: '', isaReceiverId: '', gsIds: { sender: '', receiver: '' } },
    erpContext: erp ? {
      partnerERP: {
        system: erp.backend_system || '',
        version: erp.version || '',
        hasCustomizations: !!(erp.customizations && erp.customizations.length > 0),
        notes: erp.notes || '',
      },
      targetSystem: { system: erp.backend_system || '', integrationMethod: 'API', dataOwner: '' },
    } : { partnerERP: { system: '', version: '', hasCustomizations: false, notes: '' }, targetSystem: { system: '', integrationMethod: '', dataOwner: '' } },
    documents: docs.map((d, i) => ({
      id: `doc${i}`,
      transactionSet: d.transaction_set || '',
      name: (d.transaction_set && DOC_NAMES[d.transaction_set]) || `Transaction ${d.transaction_set || '—'}`,
      direction: d.direction || 'Inbound',
      frequency: d.frequency || '—',
      acknowledgmentRequired: d.acknowledgment_required !== false,
      sla: d.sla || { deliveryTime: '—', retryRules: '' },
      status: 'Active',
    })),
    transport: transport ? {
      type: transport.type || 'SFTP',
      config: {
        host: creds.host || transport.endpoint || '—',
        port: creds.port || '22',
        username: creds.username || '—',
        path: creds.path || '/',
        encryption: !!transport.encryption,
      },
      schedule: transport.schedule || 'event-driven',
      autoRetry: true,
    } : { type: '—', config: { host: '—', port: '—', username: '—', path: '—', encryption: false }, schedule: '—', autoRetry: false },
    stats: { totalTransactions: 0, successRate: 0, avgProcessingTime: '—', lastTransaction: '—', exceptions: 0 },
    recentActivity: [],
    exceptions: [],
  };
};

export const PartnerDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [partnerData, setPartnerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Invalid partner ID');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const api = await partnersService.getById(id);
        if (!cancelled) setPartnerData(mapApiPartnerToUI(api));
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.detail || err.message || 'Failed to load partner');
          setPartnerData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      'Active': { variant: 'secondary', icon: CheckCircle2, bg: 'bg-green-500/10', text: 'text-green-700 dark:text-green-400' },
      'Testing': { variant: 'secondary', icon: Clock, bg: 'bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-400' },
      'Draft': { variant: 'secondary', icon: AlertCircle, bg: 'bg-muted', text: 'text-muted-foreground' },
      'Suspended': { variant: 'secondary', icon: XCircle, bg: 'bg-red-500/10', text: 'text-red-700 dark:text-red-400' },
    };
    const config = statusConfig[status] || statusConfig['Draft'];
    const StatusIcon = config.icon;
    return (
      <Badge variant={config.variant} className={`${config.bg} ${config.text} border-0 gap-1.5`}>
        <StatusIcon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  const handleViewDocument = (fileId) => {
    navigate(`/document/${fileId}`);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-cyan-300 font-mono">Loading partner...</p>
        </div>
      </div>
    );
  }

  if (error || !partnerData) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-300 font-mono mb-4">{error || 'Partner not found'}</p>
            <Button onClick={() => navigate('/partners')} variant="outline">
              Back to Partners
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/partners')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                {partnerData.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{partnerData.name}</h1>
              <p className="text-muted-foreground mt-1">
                Code: {partnerData.code} • {partnerData.role}{partnerData.industry ? ` • ${partnerData.industry}` : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(partnerData.status)}
          <Button variant="outline" className="gap-2">
            <Edit className="w-4 h-4" />
            Edit Partner
          </Button>
          <Button variant="outline" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
                <p className="text-2xl font-bold mt-1">{partnerData.stats.totalTransactions.toLocaleString()}</p>
              </div>
              <Activity className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold mt-1">{partnerData.stats.successRate}%</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-success opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Processing</p>
                <p className="text-2xl font-bold mt-1">{partnerData.stats.avgProcessingTime}</p>
              </div>
              <Clock className="w-8 h-8 text-primary opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Exceptions</p>
                <p className="text-2xl font-bold mt-1">{partnerData.stats.exceptions}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edi">EDI Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="mappings">Mappings</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Business Information */}
            <Card>
              <CardHeader>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>Partner business details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Legal Name</p>
                    <p className="font-medium">{partnerData.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Partner Code</p>
                    <p className="font-medium font-mono">{partnerData.code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Role</p>
                    <Badge variant="outline">{partnerData.role}</Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Industry</p>
                    <p className="font-medium">{partnerData.industry}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Country</p>
                    <p className="font-medium">{partnerData.country}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Timezone</p>
                    <p className="font-medium">{partnerData.timezone}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Business Contact</p>
                  <div className="space-y-1 text-sm">
                    <p>{partnerData.businessContact?.name || '—'}</p>
                    <p className="text-muted-foreground">{partnerData.businessContact?.email || '—'}</p>
                    <p className="text-muted-foreground">{partnerData.businessContact?.phone || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Technical Contact</p>
                  <div className="space-y-1 text-sm">
                    <p>{partnerData.technicalContact?.name || '—'}</p>
                    <p className="text-muted-foreground">{partnerData.technicalContact?.email || '—'}</p>
                    <p className="text-muted-foreground">{partnerData.technicalContact?.phone || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ERP & System Context */}
            <Card>
              <CardHeader>
                <CardTitle>ERP & System Context</CardTitle>
                <CardDescription>System integration details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Partner Backend System</p>
                  <div className="space-y-1">
                    <Badge variant="outline">{partnerData.erpContext?.partnerERP?.system || '—'}</Badge>
                    <p className="text-sm text-muted-foreground">
                      {partnerData.erpContext?.partnerERP?.version || '—'}
                    </p>
                    {partnerData.erpContext.partnerERP.hasCustomizations && (
                      <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-0 text-xs">Has Customizations</Badge>
                    )}
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Target System</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{partnerData.erpContext?.targetSystem?.system || '—'}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Integration: {partnerData.erpContext?.targetSystem?.integrationMethod || '—'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Data Owner: {partnerData.erpContext?.targetSystem?.dataOwner || '—'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Document Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Document Agreements</CardTitle>
                <CardDescription>
                  {partnerData.documents?.length ? `${partnerData.documents.length} document type(s) configured` : 'No documents configured'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(partnerData.documents || []).map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{doc.transactionSet}</Badge>
                        <div>
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.direction} • {doc.frequency}
                          </p>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={doc.status === 'Active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' : ''}
                      >
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Transport Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Transport Configuration</CardTitle>
                <CardDescription>File transfer settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">{partnerData.transport.type}</p>
                    <p className="text-sm text-muted-foreground">
                      {partnerData.transport.config.host}:{partnerData.transport.config.port}
                    </p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Schedule:</span>
                    <span className="font-medium">{partnerData.transport.schedule}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Auto Retry:</span>
                  <Badge 
                    variant="secondary"
                    className={partnerData.transport.autoRetry ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' : ''}
                  >
                    {partnerData.transport.autoRetry ? 'Enabled' : 'Disabled'}
                  </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* EDI Profile Tab */}
        <TabsContent value="edi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>EDI Standard Configuration</CardTitle>
              <CardDescription>How this partner communicates using EDI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">EDI Standard</p>
                  <p className="font-medium">{partnerData.ediProfile.standard}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Version</p>
                  <p className="font-medium">{partnerData.ediProfile.version}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Character Set</p>
                  <p className="font-medium">{partnerData.ediProfile.characterSet}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Functional Groups</p>
                  <div className="flex gap-1">
                    {partnerData.ediProfile.functionalGroups.map((group) => (
                      <Badge key={group} variant="outline">{group}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Delimiters</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Element</p>
                    <p className="font-mono text-lg">{partnerData.ediProfile.delimiters.element}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Segment</p>
                    <p className="font-mono text-lg">{partnerData.ediProfile.delimiters.segment}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Sub-Element</p>
                    <p className="font-mono text-lg">{partnerData.ediProfile.delimiters.subElement}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-3">Control IDs</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">ISA Sender ID</p>
                    <p className="font-mono">{partnerData.ediProfile.isaSenderId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">ISA Receiver ID</p>
                    <p className="font-mono">{partnerData.ediProfile.isaReceiverId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">GS Sender ID</p>
                    <p className="font-mono">{partnerData.ediProfile.gsIds.sender}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">GS Receiver ID</p>
                    <p className="font-mono">{partnerData.ediProfile.gsIds.receiver}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Agreements</CardTitle>
              <CardDescription>Configured document types and their settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(partnerData.documents || []).length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No document agreements configured</p>
                ) : (
                partnerData.documents.map((doc) => (
                  <Card key={doc.id} className="border-border">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-base px-3 py-1">
                            {doc.transactionSet}
                          </Badge>
                          <div>
                            <p className="font-semibold">{doc.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Transaction Set {doc.transactionSet}
                            </p>
                          </div>
                        </div>
                        <Badge 
                          variant="secondary"
                          className={doc.status === 'Active' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' : ''}
                        >
                          {doc.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Direction</p>
                          <Badge variant={doc.direction === 'Inbound' ? 'default' : 'secondary'} className="gap-1">
                            {doc.direction === 'Inbound' ? (
                              <ArrowDownToLine className="w-3 h-3" />
                            ) : (
                              <ArrowUpFromLine className="w-3 h-3" />
                            )}
                            {doc.direction}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Frequency</p>
                          <p className="text-sm font-medium">{doc.frequency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">ACK Required</p>
                          <Badge 
                            variant="secondary"
                            className={doc.acknowledgmentRequired ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' : ''}
                          >
                            {doc.acknowledgmentRequired ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">SLA</p>
                          <p className="text-sm font-medium">{doc.sla?.deliveryTime || '—'}</p>
                        </div>
                      </div>
                      {doc.sla?.retryRules && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground">Retry Rules: {doc.sla.retryRules}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mappings Tab */}
        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Field Mappings</CardTitle>
              <CardDescription>EDI to Canonical JSON field mappings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Link2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="mb-2">No mappings configured</p>
                <Button variant="outline" onClick={() => navigate('/mapper')}>
                  Configure Mappings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transport Tab */}
        <TabsContent value="transport" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transport Configuration</CardTitle>
              <CardDescription>File transfer connection details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <Server className="w-6 h-6 text-primary" />
                <div>
                  <p className="font-semibold">{partnerData.transport.type}</p>
                  <p className="text-sm text-muted-foreground">Secure File Transfer Protocol</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Host / Server</p>
                  <p className="font-mono">{partnerData.transport.config.host}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Port</p>
                  <p className="font-mono">{partnerData.transport.config.port}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Username</p>
                  <p className="font-mono">{partnerData.transport.config.username}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Remote Path</p>
                  <p className="font-mono">{partnerData.transport.config.path}</p>
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Encryption</span>
                  <Badge 
                    variant="secondary"
                    className={partnerData.transport.config.encryption ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' : ''}
                  >
                    {partnerData.transport.config.encryption ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Schedule</span>
                  <span className="text-sm font-medium">{partnerData.transport.schedule}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Auto Retry</span>
                  <Badge 
                    variant="secondary"
                    className={partnerData.transport.autoRetry ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' : ''}
                  >
                    {partnerData.transport.autoRetry ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest transactions with this partner</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="font-semibold">File ID</TableHead>
                    <TableHead className="font-semibold">Doc Type</TableHead>
                    <TableHead className="font-semibold">Direction</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Timestamp</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerData.recentActivity.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className="hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => handleViewDocument(activity.fileId)}
                    >
                      <TableCell 
                        className="font-mono text-sm font-medium text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDocument(activity.fileId);
                        }}
                      >
                        {activity.fileId}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {activity.docType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={activity.direction === 'Inbound' ? 'default' : 'secondary'} className="gap-1">
                          {activity.direction === 'Inbound' ? (
                            <ArrowDownToLine className="w-3 h-3" />
                          ) : (
                            <ArrowUpFromLine className="w-3 h-3" />
                          )}
                          {activity.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={
                            activity.status === 'Completed' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border-0' :
                            activity.status === 'Processing' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-0' :
                            'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-0'
                          }
                        >
                          {activity.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{activity.time}</TableCell>
                      <TableCell 
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDocument(activity.fileId)}
                          className="hover:bg-primary hover:text-primary-foreground"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
