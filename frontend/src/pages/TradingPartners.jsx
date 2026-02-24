import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, CheckCircle2, AlertCircle, Clock, XCircle, Loader2, Eye, Edit, Trash2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Avatar,
  AvatarFallback,
} from '@/components/ui/avatar';
import { toast } from 'sonner';
import { AddTradingPartnerChat } from '@/components/AddTradingPartnerChat';
import { partnersService } from '@/services/partners';
import { exceptionsService } from '@/services/exceptions';

export const TradingPartners = () => {
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await partnersService.getAll({ limit: 1000 });
      
      // Ensure response is an array
      const data = Array.isArray(response) ? response : [];
      
      // Fetch exception counts for all partners
      let exceptionCountsMap = {};
      try {
        const allExceptions = await exceptionsService.getAll({ limit: 1000, skip: 0 });
        // Group exceptions by partner_code
        if (Array.isArray(allExceptions)) {
          exceptionCountsMap = allExceptions.reduce((acc, exc) => {
            const partnerCode = exc.partner_code;
            if (partnerCode) {
              acc[partnerCode] = (acc[partnerCode] || 0) + 1;
            }
            return acc;
          }, {});
        }
      } catch (err) {
        console.warn('Failed to load exception counts:', err);
        // Continue without exception counts
      }
      
      const transformedPartners = data
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .map(partner => ({
          id: partner._id || partner.id,
          name: partner.business_name,
          code: partner.partner_code,
          role: partner.role,
          status: partner.status,
          ediStandard: partner.edi_config?.standard && partner.edi_config?.version 
            ? `${partner.edi_config.standard} ${partner.edi_config.version}`
            : 'Not configured',
          documents: partner.document_agreements?.map(da => da.transaction_set) || [],
          lastActivity: partner.updated_at 
            ? new Date(partner.updated_at).toLocaleDateString()
            : 'Never',
          exceptionCount: exceptionCountsMap[partner.partner_code] || 0,
        }));
      setPartners(transformedPartners);
    } catch (err) {
      console.error('Error loading partners:', err);
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || 'Failed to load partners';
      setError(errorMessage);
      toast.error(`Failed to load trading partners: ${errorMessage}`);
      // Fallback to empty array
      setPartners([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (partner) => {
    try {
      const newStatus = partner.status === 'Active' ? 'Suspended' : 'Active';
      await partnersService.update(partner.id, { status: newStatus });
      toast.success(`Partner ${newStatus === 'Active' ? 'activated' : 'suspended'} successfully`);
      await loadPartners();
    } catch (err) {
      console.error('Error updating partner status:', err);
      toast.error('Failed to update partner status');
    }
  };

  const handleDeletePartner = async (partner) => {
    if (!window.confirm(`Are you sure you want to delete ${partner.name}? This action cannot be undone.`)) {
      return;
    }
    try {
      await partnersService.delete(partner.id);
      toast.success('Partner deleted successfully');
      await loadPartners();
    } catch (err) {
      console.error('Error deleting partner:', err);
      toast.error('Failed to delete partner');
    }
  };

  const handlePartnerCreated = async (partnerData) => {
    try {
      const hasBusinessContact = partnerData.businessContact &&
        (partnerData.businessContact.name || partnerData.businessContact.email);
      const hasTechnicalContact = partnerData.technicalContact &&
        (partnerData.technicalContact.name || partnerData.technicalContact.email);
      const hasEdiConfig = partnerData.ediStandard || partnerData.ediConfig?.standard;

      const apiData = {
        business_name: partnerData.businessName || partnerData.business_name,
        partner_code: (partnerData.partnerCode || partnerData.partner_code || '').toUpperCase(),
        role: partnerData.role || 'Both',
        industry: partnerData.industry || null,
        country: partnerData.country || null,
        timezone: partnerData.timezone || null,
        business_contact: hasBusinessContact ? {
          name: partnerData.businessContact.name || 'N/A',
          email: partnerData.businessContact.email || 'N/A',
          phone: partnerData.businessContact.phone || null,
        } : null,
        technical_contact: hasTechnicalContact ? {
          name: partnerData.technicalContact.name || 'N/A',
          email: partnerData.technicalContact.email || 'N/A',
          phone: partnerData.technicalContact.phone || null,
        } : null,
        edi_config: hasEdiConfig ? {
          standard: partnerData.ediStandard || partnerData.ediConfig?.standard || 'X12',
          version: partnerData.version || partnerData.ediConfig?.version || '5010',
          isa_sender_id: partnerData.isaSenderId || partnerData.ediConfig?.isaSenderId || null,
          isa_receiver_id: partnerData.isaReceiverId || partnerData.ediConfig?.isaReceiverId || null,
        } : null,
        document_agreements: (partnerData.documents || []).map(doc => ({
          transaction_set: doc.replace(/\s*\(.*\)/, ''),
          direction: 'Inbound',
        })),
        status: partnerData.status || 'Draft',
      };

      await partnersService.create(apiData);
      toast.success('Trading partner added successfully!');
      setShowWizard(false);
      await loadPartners();
    } catch (err) {
      console.error('Error creating partner:', err);
      const detail = err.response?.data?.detail || err.message;
      toast.error(`Failed to create trading partner: ${detail}`);
    }
  };

  // Mock data fallback for development
  const mockPartners = [
    {
      id: '1',
      name: 'Walmart Inc.',
      code: 'WMT',
      role: 'Customer',
      status: 'Active',
      ediStandard: 'X12 5010',
      documents: ['850', '810', '856'],
      lastActivity: '2 hours ago',
      exceptionCount: 0,
    },
    {
      id: '2',
      name: 'Target Corporation',
      code: 'TGT',
      role: 'Customer',
      status: 'Active',
      ediStandard: 'X12 5010',
      documents: ['850', '856'],
      lastActivity: '5 hours ago',
      exceptionCount: 2,
    },
    {
      id: '3',
      name: 'Amazon.com',
      code: 'AMZN',
      role: 'Both',
      status: 'Active',
      ediStandard: 'X12 5010',
      documents: ['850', '810', '856', '997'],
      lastActivity: '1 day ago',
      exceptionCount: 0,
    },
    {
      id: '4',
      name: 'Home Depot',
      code: 'HD',
      role: 'Supplier',
      status: 'Testing',
      ediStandard: 'X12 4010',
      documents: ['850'],
      lastActivity: '3 days ago',
      exceptionCount: 5,
    },
    {
      id: '5',
      name: 'Costco Wholesale',
      code: 'COST',
      role: 'Customer',
      status: 'Draft',
      ediStandard: 'EDIFACT',
      documents: [],
      lastActivity: '1 week ago',
      exceptionCount: 0,
    },
  ];

  const getStatusBadge = (status) => {
    const variants = {
      Active: { variant: 'success', icon: CheckCircle2 },
      Testing: { variant: 'warning', icon: Clock },
      Draft: { variant: 'secondary', icon: AlertCircle },
      Suspended: { variant: 'error', icon: XCircle },
    };
    return variants[status] || variants.Draft;
  };

  const filteredPartners = partners.filter(partner =>
    partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    partner.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          <p className="text-cyan-300 font-mono">Loading trading partners...</p>
        </div>
      </div>
    );
  }

  if (error && partners.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
            <p className="text-red-300 font-mono mb-4">Error loading partners: {error}</p>
            <Button onClick={loadPartners} variant="outline">
              Retry
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trading Partners</h1>
          <p className="text-muted-foreground mt-1">
            Manage your EDI trading partner relationships and configurations
          </p>
        </div>
        <Button onClick={() => setShowWizard(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Trading Partner
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search partners by name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{filteredPartners.length} Partners</Badge>
              <Badge variant="success">
                {partners.filter(p => p.status === 'Active').length} Active
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPartners.map((partner) => {
          const statusInfo = getStatusBadge(partner.status);
          const StatusIcon = statusInfo.icon;

          return (
            <Card 
              key={partner.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/partners/${partner.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                        {partner.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{partner.name}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Code: {partner.code}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/partners/${partner.id}`);
                      }}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement edit functionality
                        toast.info('Edit functionality coming soon');
                      }}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Partner
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStatus(partner);
                      }}>
                        <Power className="w-4 h-4 mr-2" />
                        {partner.status === 'Active' ? 'Deactivate' : 'Activate'}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePartner(partner);
                        }}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Partner
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant={statusInfo.variant} className="gap-1.5">
                    <StatusIcon className="w-3 h-3" />
                    {partner.status}
                  </Badge>
                  <Badge variant="outline">{partner.role}</Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">EDI Standard:</span>
                    <span className="font-medium">{partner.ediStandard}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Documents:</span>
                    <div className="flex gap-1">
                      {partner.documents.length > 0 ? (
                        partner.documents.map((doc) => (
                          <Badge key={doc} variant="secondary" className="text-xs">
                            {doc}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">None</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last Activity:</span>
                    <span className="font-medium">{partner.lastActivity}</span>
                  </div>
                </div>

                {partner.exceptionCount > 0 && (
                  <div className="pt-2 border-t border-border">
                    <Badge variant="error" className="gap-1.5">
                      <AlertCircle className="w-3 h-3" />
                      {partner.exceptionCount} Exception{partner.exceptionCount !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredPartners.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? 'No partners found matching your search.' : 'No trading partners yet.'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowWizard(true)} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Trading Partner
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Trading Partner Chat */}
      {showWizard && (
        <AddTradingPartnerChat
          open={showWizard}
          onClose={() => setShowWizard(false)}
          onComplete={handlePartnerCreated}
        />
      )}
    </div>
  );
};
