import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon,
  User,
  Brain,
  FileText,
  Server,
  Bell,
  Shield,
  Database,
  Save,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/components/ui/sonner';

export const Settings = () => {
  const [settings, setSettings] = useState({
    // General Settings
    platformName: 'AI EDI Platform',
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    language: 'en',
    
    // AI Configuration
    aiEnabled: true,
    autoApproveThreshold: 90,
    flagReviewThreshold: 75,
    requireApprovalThreshold: 75,
    aiModel: 'GPT-4',
    learningEnabled: true,
    
    // EDI Settings
    defaultEDIStandard: 'X12',
    defaultVersion: '5010',
    defaultCharacterSet: 'UTF-8',
    defaultDelimiters: {
      element: '*',
      segment: '~',
      subElement: '>',
    },
    autoValidate: true,
    strictValidation: false,
    
    // Transport Settings
    defaultTransport: 'SFTP',
    sftpHost: '',
    sftpPort: '22',
    sftpUsername: '',
    sftpPath: '/inbound/edi',
    s3Bucket: '',
    s3Region: 'us-east-1',
    autoRetry: true,
    retryAttempts: 3,
    retryInterval: 30,
    
    // Notification Settings
    emailNotifications: true,
    emailAddress: 'admin@company.com',
    exceptionAlerts: true,
    dailyDigest: true,
    realTimeAlerts: false,
    slackWebhook: '',
    
    // Security Settings
    sessionTimeout: 30,
    passwordPolicy: 'strong',
    twoFactorAuth: false,
    auditLogRetention: 7,
    encryptionEnabled: true,
    
    // Integration Settings
    erpType: 'SAP',
    erpEndpoint: '',
    erpApiKey: '',
    apiRateLimit: 100,
    webhookUrl: '',
    
    // User Profile
    userName: 'Admin User',
    userEmail: 'admin@company.com',
    userRole: 'Administrator',
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slackConfigured, setSlackConfigured] = useState(false);

  // Load Slack settings from backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { getSettings } = await import('@/services/settings');
        const data = await getSettings();
        setSlackConfigured(data.slack_webhook_configured || false);
        setSettings(prev => ({
          ...prev,
          ...(data.exception_alerts !== undefined && { exceptionAlerts: data.exception_alerts }),
          ...(data.document_alerts !== undefined && { realTimeAlerts: data.document_alerts }),
        }));
      } catch (err) {
        // API may not be available
      }
    };
    loadSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleNestedChange = (parentKey, childKey, value) => {
    setSettings(prev => ({
      ...prev,
      [parentKey]: {
        ...prev[parentKey],
        [childKey]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updateSettings } = await import('@/services/settings');
      await updateSettings({
        slack_webhook_url: settings.slackWebhook || null,
        exception_alerts: settings.exceptionAlerts,
        document_alerts: settings.realTimeAlerts,
      });
      setSlackConfigured(Boolean(settings.slackWebhook));
      setHasChanges(false);
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to defaults
    toast.info('Settings reset to defaults');
    setHasChanges(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure platform settings, AI behavior, and integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="secondary" className="gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="ai">AI Config</TabsTrigger>
          <TabsTrigger value="edi">EDI</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>Basic platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="platformName">Platform Name</Label>
                  <Input
                    id="platformName"
                    value={settings.platformName}
                    onChange={(e) => handleChange('platformName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(value) => handleChange('timezone', value)}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFormat">Date Format</Label>
                  <Select value={settings.dateFormat} onValueChange={(value) => handleChange('dateFormat', value)}>
                    <SelectTrigger id="dateFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeFormat">Time Format</Label>
                  <Select value={settings.timeFormat} onValueChange={(value) => handleChange('timeFormat', value)}>
                    <SelectTrigger id="timeFormat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h">12-hour</SelectItem>
                      <SelectItem value="24h">24-hour</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select value={settings.language} onValueChange={(value) => handleChange('language', value)}>
                    <SelectTrigger id="language">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Configuration */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                AI Configuration
              </CardTitle>
              <CardDescription>Configure AI behavior and confidence thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="aiEnabled">Enable AI Processing</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to autonomously process EDI documents
                  </p>
                </div>
                <Switch
                  id="aiEnabled"
                  checked={settings.aiEnabled}
                  onCheckedChange={(checked) => handleChange('aiEnabled', checked)}
                />
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <Label>Confidence Thresholds</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set confidence levels for automatic processing and review flags
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="autoApprove">Auto-Approve (%)</Label>
                      <Input
                        id="autoApprove"
                        type="number"
                        min="0"
                        max="100"
                        value={settings.autoApproveThreshold}
                        onChange={(e) => handleChange('autoApproveThreshold', parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">≥ {settings.autoApproveThreshold}% confidence</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="flagReview">Flag for Review (%)</Label>
                      <Input
                        id="flagReview"
                        type="number"
                        min="0"
                        max="100"
                        value={settings.flagReviewThreshold}
                        onChange={(e) => handleChange('flagReviewThreshold', parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">75-{settings.autoApproveThreshold - 1}% confidence</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requireApproval">Require Approval (%)</Label>
                      <Input
                        id="requireApproval"
                        type="number"
                        min="0"
                        max="100"
                        value={settings.requireApprovalThreshold}
                        onChange={(e) => handleChange('requireApprovalThreshold', parseInt(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">&lt; {settings.flagReviewThreshold}% confidence</p>
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="aiModel">AI Model</Label>
                    <Select value={settings.aiModel} onValueChange={(value) => handleChange('aiModel', value)}>
                      <SelectTrigger id="aiModel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GPT-4">GPT-4</SelectItem>
                        <SelectItem value="GPT-3.5">GPT-3.5</SelectItem>
                        <SelectItem value="Claude">Claude</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="learningEnabled">Learning Enabled</Label>
                      <p className="text-sm text-muted-foreground">
                        AI learns from corrections and approvals
                      </p>
                    </div>
                    <Switch
                      id="learningEnabled"
                      checked={settings.learningEnabled}
                      onCheckedChange={(checked) => handleChange('learningEnabled', checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EDI Settings */}
        <TabsContent value="edi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                EDI Configuration
              </CardTitle>
              <CardDescription>Default EDI standards and validation rules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="defaultEDIStandard">Default EDI Standard</Label>
                  <Select value={settings.defaultEDIStandard} onValueChange={(value) => handleChange('defaultEDIStandard', value)}>
                    <SelectTrigger id="defaultEDIStandard">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="X12">X12</SelectItem>
                      <SelectItem value="EDIFACT">EDIFACT</SelectItem>
                      <SelectItem value="TRADACOMS">TRADACOMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultVersion">Default Version</Label>
                  <Select value={settings.defaultVersion} onValueChange={(value) => handleChange('defaultVersion', value)}>
                    <SelectTrigger id="defaultVersion">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5010">5010</SelectItem>
                      <SelectItem value="4010">4010</SelectItem>
                      <SelectItem value="3060">3060</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultCharacterSet">Character Set</Label>
                  <Select value={settings.defaultCharacterSet} onValueChange={(value) => handleChange('defaultCharacterSet', value)}>
                    <SelectTrigger id="defaultCharacterSet">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTF-8">UTF-8</SelectItem>
                      <SelectItem value="ASCII">ASCII</SelectItem>
                      <SelectItem value="EBCDIC">EBCDIC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div>
                <Label>Default Delimiters</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="elementDelimiter">Element</Label>
                    <Input
                      id="elementDelimiter"
                      maxLength={1}
                      value={settings.defaultDelimiters.element}
                      onChange={(e) => handleNestedChange('defaultDelimiters', 'element', e.target.value)}
                      className="font-mono text-center text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="segmentDelimiter">Segment</Label>
                    <Input
                      id="segmentDelimiter"
                      maxLength={1}
                      value={settings.defaultDelimiters.segment}
                      onChange={(e) => handleNestedChange('defaultDelimiters', 'segment', e.target.value)}
                      className="font-mono text-center text-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subElementDelimiter">Sub-Element</Label>
                    <Input
                      id="subElementDelimiter"
                      maxLength={1}
                      value={settings.defaultDelimiters.subElement}
                      onChange={(e) => handleNestedChange('defaultDelimiters', 'subElement', e.target.value)}
                      className="font-mono text-center text-lg"
                    />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoValidate">Auto-Validate Documents</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically validate EDI documents against standards
                    </p>
                  </div>
                  <Switch
                    id="autoValidate"
                    checked={settings.autoValidate}
                    onCheckedChange={(checked) => handleChange('autoValidate', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="strictValidation">Strict Validation</Label>
                    <p className="text-sm text-muted-foreground">
                      Reject documents that don't strictly comply with standards
                    </p>
                  </div>
                  <Switch
                    id="strictValidation"
                    checked={settings.strictValidation}
                    onCheckedChange={(checked) => handleChange('strictValidation', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transport Settings */}
        <TabsContent value="transport" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" />
                Transport Configuration
              </CardTitle>
              <CardDescription>File transfer and connection settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="defaultTransport">Default Transport Method</Label>
                <Select value={settings.defaultTransport} onValueChange={(value) => handleChange('defaultTransport', value)}>
                  <SelectTrigger id="defaultTransport">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SFTP">SFTP</SelectItem>
                    <SelectItem value="S3">Amazon S3</SelectItem>
                    <SelectItem value="FTP">FTP</SelectItem>
                    <SelectItem value="AS2">AS2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              {settings.defaultTransport === 'SFTP' && (
                <div className="space-y-4">
                  <h3 className="font-semibold">SFTP Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sftpHost">Host</Label>
                      <Input
                        id="sftpHost"
                        value={settings.sftpHost}
                        onChange={(e) => handleChange('sftpHost', e.target.value)}
                        placeholder="sftp.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sftpPort">Port</Label>
                      <Input
                        id="sftpPort"
                        type="number"
                        value={settings.sftpPort}
                        onChange={(e) => handleChange('sftpPort', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sftpUsername">Username</Label>
                      <Input
                        id="sftpUsername"
                        value={settings.sftpUsername}
                        onChange={(e) => handleChange('sftpUsername', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sftpPath">Remote Path</Label>
                      <Input
                        id="sftpPath"
                        value={settings.sftpPath}
                        onChange={(e) => handleChange('sftpPath', e.target.value)}
                        placeholder="/inbound/edi"
                      />
                    </div>
                  </div>
                </div>
              )}
              {settings.defaultTransport === 'S3' && (
                <div className="space-y-4">
                  <h3 className="font-semibold">S3 Settings</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="s3Bucket">Bucket Name</Label>
                      <Input
                        id="s3Bucket"
                        value={settings.s3Bucket}
                        onChange={(e) => handleChange('s3Bucket', e.target.value)}
                        placeholder="my-edi-bucket"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="s3Region">Region</Label>
                      <Input
                        id="s3Region"
                        value={settings.s3Region}
                        onChange={(e) => handleChange('s3Region', e.target.value)}
                        placeholder="us-east-1"
                      />
                    </div>
                  </div>
                </div>
              )}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoRetry">Auto-Retry Failed Transfers</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically retry failed file transfers
                    </p>
                  </div>
                  <Switch
                    id="autoRetry"
                    checked={settings.autoRetry}
                    onCheckedChange={(checked) => handleChange('autoRetry', checked)}
                  />
                </div>
                {settings.autoRetry && (
                  <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-border">
                    <div className="space-y-2">
                      <Label htmlFor="retryAttempts">Retry Attempts</Label>
                      <Input
                        id="retryAttempts"
                        type="number"
                        min="1"
                        max="10"
                        value={settings.retryAttempts}
                        onChange={(e) => handleChange('retryAttempts', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retryInterval">Retry Interval (seconds)</Label>
                      <Input
                        id="retryInterval"
                        type="number"
                        min="10"
                        value={settings.retryInterval}
                        onChange={(e) => handleChange('retryInterval', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure how and when you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="emailNotifications">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="emailNotifications"
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => handleChange('emailNotifications', checked)}
                />
              </div>
              {settings.emailNotifications && (
                <div className="space-y-2 pl-6 border-l-2 border-border">
                  <Label htmlFor="emailAddress">Email Address</Label>
                  <Input
                    id="emailAddress"
                    type="email"
                    value={settings.emailAddress}
                    onChange={(e) => handleChange('emailAddress', e.target.value)}
                    placeholder="admin@company.com"
                  />
                </div>
              )}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="exceptionAlerts">Exception Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when exceptions occur
                    </p>
                  </div>
                  <Switch
                    id="exceptionAlerts"
                    checked={settings.exceptionAlerts}
                    onCheckedChange={(checked) => handleChange('exceptionAlerts', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dailyDigest">Daily Digest</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive daily summary of activities
                    </p>
                  </div>
                  <Switch
                    id="dailyDigest"
                    checked={settings.dailyDigest}
                    onCheckedChange={(checked) => handleChange('dailyDigest', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="realTimeAlerts">Real-Time Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive immediate notifications for critical events
                    </p>
                  </div>
                  <Switch
                    id="realTimeAlerts"
                    checked={settings.realTimeAlerts}
                    onCheckedChange={(checked) => handleChange('realTimeAlerts', checked)}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="slackWebhook">Slack Webhook URL (Optional)</Label>
                <Input
                  id="slackWebhook"
                  value={settings.slackWebhook}
                  onChange={(e) => handleChange('slackWebhook', e.target.value)}
                  placeholder={slackConfigured ? "Configured – enter new URL to replace" : "https://hooks.slack.com/services/..."}
                />
                <p className="text-xs text-muted-foreground">
                  Get a webhook from Slack: Apps → Incoming Webhooks. Alerts for exceptions and document status.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security Settings
              </CardTitle>
              <CardDescription>Configure security and access control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={settings.sessionTimeout}
                    onChange={(e) => handleChange('sessionTimeout', parseInt(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordPolicy">Password Policy</Label>
                  <Select value={settings.passwordPolicy} onValueChange={(value) => handleChange('passwordPolicy', value)}>
                    <SelectTrigger id="passwordPolicy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="strong">Strong</SelectItem>
                      <SelectItem value="very-strong">Very Strong</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="twoFactorAuth">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Require 2FA for all user accounts
                    </p>
                  </div>
                  <Switch
                    id="twoFactorAuth"
                    checked={settings.twoFactorAuth}
                    onCheckedChange={(checked) => handleChange('twoFactorAuth', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="encryptionEnabled">Data Encryption</Label>
                    <p className="text-sm text-muted-foreground">
                      Encrypt sensitive EDI data at rest
                    </p>
                  </div>
                  <Switch
                    id="encryptionEnabled"
                    checked={settings.encryptionEnabled}
                    onCheckedChange={(checked) => handleChange('encryptionEnabled', checked)}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="auditLogRetention">Audit Log Retention (years)</Label>
                <Input
                  id="auditLogRetention"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.auditLogRetention}
                  onChange={(e) => handleChange('auditLogRetention', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Audit logs will be retained for {settings.auditLogRetention} year(s) per compliance requirements
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Settings */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                User Profile
              </CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
                    {settings.userName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{settings.userName}</p>
                  <p className="text-sm text-muted-foreground">{settings.userEmail}</p>
                  <Badge variant="outline" className="mt-1">{settings.userRole}</Badge>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="userName">Full Name</Label>
                  <Input
                    id="userName"
                    value={settings.userName}
                    onChange={(e) => handleChange('userName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userEmail">Email Address</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={settings.userEmail}
                    onChange={(e) => handleChange('userEmail', e.target.value)}
                  />
                </div>
              </div>
              <Separator />
              <div>
                <Label>Role</Label>
                <p className="text-sm text-muted-foreground mt-1">{settings.userRole}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact your administrator to change your role
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Integration Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Integration Settings
              </CardTitle>
              <CardDescription>Configure ERP and external system integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="erpType">ERP System</Label>
                  <Select value={settings.erpType} onValueChange={(value) => handleChange('erpType', value)}>
                    <SelectTrigger id="erpType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SAP">SAP</SelectItem>
                      <SelectItem value="Oracle">Oracle</SelectItem>
                      <SelectItem value="NetSuite">NetSuite</SelectItem>
                      <SelectItem value="Custom">Custom API</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiRateLimit">API Rate Limit (requests/min)</Label>
                  <Input
                    id="apiRateLimit"
                    type="number"
                    min="10"
                    value={settings.apiRateLimit}
                    onChange={(e) => handleChange('apiRateLimit', parseInt(e.target.value))}
                  />
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="erpEndpoint">ERP Endpoint URL</Label>
                  <Input
                    id="erpEndpoint"
                    value={settings.erpEndpoint}
                    onChange={(e) => handleChange('erpEndpoint', e.target.value)}
                    placeholder="https://api.example.com/edi"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="erpApiKey">API Key</Label>
                  <Input
                    id="erpApiKey"
                    type="password"
                    value={settings.erpApiKey}
                    onChange={(e) => handleChange('erpApiKey', e.target.value)}
                    placeholder="Enter API key"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    value={settings.webhookUrl}
                    onChange={(e) => handleChange('webhookUrl', e.target.value)}
                    placeholder="https://webhook.example.com/callback"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
