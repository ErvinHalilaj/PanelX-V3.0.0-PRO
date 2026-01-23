import { useState } from 'react';
import {
  useSecurityStats,
  useSecurityEvents,
  useSecuritySettings,
  useUpdateSecuritySettings,
  useUserDevices,
  useUpdateDeviceTrust,
  useRemoveDevice,
  useIpRestrictions,
  useSetIpRestrictions,
  useRateLimitRules,
  useCreateRateLimitRule,
  useUpdateRateLimitRule,
  useDeleteRateLimitRule,
} from '@/hooks/use-security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  AlertTriangle,
  Activity,
  Smartphone,
  Globe,
  Lock,
  TrendingUp,
  Ban,
  CheckCircle,
  XCircle,
  Trash2,
  Plus,
  Edit,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdvancedSecurity() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [ipDialogOpen, setIpDialogOpen] = useState(false);
  const [rateLimitDialogOpen, setRateLimitDialogOpen] = useState(false);
  const [allowedIps, setAllowedIps] = useState<string>('');
  const [deniedIps, setDeniedIps] = useState<string>('');
  
  const [newRule, setNewRule] = useState({
    name: '',
    endpoint: '',
    maxRequests: 100,
    windowSeconds: 60,
    action: 'throttle' as const,
    enabled: true,
  });

  // Fetch data
  const stats = useSecurityStats();
  const events = useSecurityEvents(undefined, undefined, 100);
  const settings = useSecuritySettings();
  const devices = useUserDevices(selectedUserId);
  const ipRestrictions = useIpRestrictions(selectedUserId);
  const rateLimitRules = useRateLimitRules();

  // Mutations
  const updateSettings = useUpdateSecuritySettings();
  const updateDeviceTrust = useUpdateDeviceTrust();
  const removeDevice = useRemoveDevice();
  const setIpRestrictions = useSetIpRestrictions();
  const createRateLimitRule = useCreateRateLimitRule();
  const updateRateLimitRule = useUpdateRateLimitRule();
  const deleteRateLimitRule = useDeleteRateLimitRule();

  const handleUpdateSettings = async (updates: any) => {
    try {
      await updateSettings.mutateAsync(updates);
      toast({ title: 'Success', description: 'Security settings updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update settings', variant: 'destructive' });
    }
  };

  const handleUpdateDeviceTrust = async (fingerprint: string, trustLevel: any) => {
    try {
      await updateDeviceTrust.mutateAsync({ fingerprint, trustLevel });
      toast({ title: 'Success', description: 'Device trust level updated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update device', variant: 'destructive' });
    }
  };

  const handleRemoveDevice = async (fingerprint: string) => {
    try {
      await removeDevice.mutateAsync(fingerprint);
      toast({ title: 'Success', description: 'Device removed' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to remove device', variant: 'destructive' });
    }
  };

  const handleSetIpRestrictions = async () => {
    try {
      const allowed = allowedIps.split('\n').map(ip => ip.trim()).filter(Boolean);
      const denied = deniedIps.split('\n').map(ip => ip.trim()).filter(Boolean);
      
      await setIpRestrictions.mutateAsync({
        userId: selectedUserId,
        allowedIps: allowed,
        deniedIps: denied,
      });
      
      toast({ title: 'Success', description: 'IP restrictions updated' });
      setIpDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update IP restrictions', variant: 'destructive' });
    }
  };

  const handleCreateRateLimitRule = async () => {
    try {
      await createRateLimitRule.mutateAsync(newRule);
      toast({ title: 'Success', description: 'Rate limit rule created' });
      setRateLimitDialogOpen(false);
      setNewRule({
        name: '',
        endpoint: '',
        maxRequests: 100,
        windowSeconds: 60,
        action: 'throttle',
        enabled: true,
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create rate limit rule', variant: 'destructive' });
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getTrustLevelBadge = (level: string) => {
    switch (level) {
      case 'trusted': return <Badge className="bg-green-500">Trusted</Badge>;
      case 'suspicious': return <Badge className="bg-yellow-500">Suspicious</Badge>;
      case 'blocked': return <Badge variant="destructive">Blocked</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Advanced Security
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage security threats, devices, and access controls
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.data?.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.data?.blockedDevices || 0}</div>
            <p className="text-xs text-muted-foreground">Devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.data?.activeRules || 0}</div>
            <p className="text-xs text-muted-foreground">Rate limit rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              {stats.data?.eventsBySeverity?.critical || 0}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="devices">Device Management</TabsTrigger>
          <TabsTrigger value="ip">IP Restrictions</TabsTrigger>
          <TabsTrigger value="ratelimit">Rate Limiting</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Security Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>Monitor suspicious activities and security incidents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {events.data?.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${getSeverityColor(event.severity)}`} />
                        <span className="font-medium">{event.eventType.replace(/_/g, ' ')}</span>
                        <Badge variant="outline">{event.severity}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        IP: {event.ipAddress} | User ID: {event.userId}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {Object.keys(event.details).length > 0 && (
                        <div className="text-xs text-muted-foreground mt-2">
                          {JSON.stringify(event.details)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {!events.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No security events recorded
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Management Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Management</CardTitle>
              <CardDescription>
                Manage and monitor devices accessing the system
              </CardDescription>
              <div className="mt-4">
                <Label>Select User</Label>
                <Input
                  type="number"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  placeholder="User ID"
                  className="max-w-xs mt-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devices.data?.map((device) => (
                  <div
                    key={device.id}
                    className="flex items-start justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        <span className="font-medium">{device.deviceInfo.platform}</span>
                        {getTrustLevelBadge(device.trustLevel)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {device.deviceInfo.userAgent}
                      </p>
                      <div className="text-xs text-muted-foreground mt-2 space-y-1">
                        <div>First seen: {new Date(device.firstSeen).toLocaleString()}</div>
                        <div>Last seen: {new Date(device.lastSeen).toLocaleString()}</div>
                        <div>Login count: {device.loginCount}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={device.trustLevel}
                        onValueChange={(value: any) => handleUpdateDeviceTrust(device.fingerprint, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trusted">Trusted</SelectItem>
                          <SelectItem value="suspicious">Suspicious</SelectItem>
                          <SelectItem value="blocked">Blocked</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveDevice(device.fingerprint)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!devices.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No devices registered for this user
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IP Restrictions Tab */}
        <TabsContent value="ip" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>IP Access Control</CardTitle>
              <CardDescription>
                Configure IP whitelists and blacklists for users
              </CardDescription>
              <div className="mt-4">
                <Label>User ID</Label>
                <Input
                  type="number"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  placeholder="User ID"
                  className="max-w-xs mt-1"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-sm font-medium">Current Restrictions</h3>
                  <Dialog open={ipDialogOpen} onOpenChange={setIpDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" onClick={() => {
                        setAllowedIps(ipRestrictions.data?.allowedIps?.join('\n') || '');
                        setDeniedIps(ipRestrictions.data?.deniedIps?.join('\n') || '');
                      }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>IP Restrictions</DialogTitle>
                        <DialogDescription>
                          Enter one IP address or CIDR range per line. Supports wildcards (*)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Allowed IPs (Whitelist)</Label>
                          <textarea
                            value={allowedIps}
                            onChange={(e) => setAllowedIps(e.target.value)}
                            placeholder="192.168.1.0/24&#10;10.0.0.*"
                            className="w-full h-32 p-2 border rounded"
                          />
                        </div>
                        <div>
                          <Label>Denied IPs (Blacklist)</Label>
                          <textarea
                            value={deniedIps}
                            onChange={(e) => setDeniedIps(e.target.value)}
                            placeholder="192.168.2.100&#10;10.0.1.*"
                            className="w-full h-32 p-2 border rounded"
                          />
                        </div>
                        <Button onClick={handleSetIpRestrictions} className="w-full">
                          Save Restrictions
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Allowed IPs ({ipRestrictions.data?.allowedIps?.length || 0})
                    </h4>
                    <div className="space-y-1">
                      {ipRestrictions.data?.allowedIps?.map((ip, i) => (
                        <div key={i} className="text-sm text-muted-foreground font-mono">
                          {ip}
                        </div>
                      ))}
                      {!ipRestrictions.data?.allowedIps?.length && (
                        <p className="text-sm text-muted-foreground">No restrictions</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      Denied IPs ({ipRestrictions.data?.deniedIps?.length || 0})
                    </h4>
                    <div className="space-y-1">
                      {ipRestrictions.data?.deniedIps?.map((ip, i) => (
                        <div key={i} className="text-sm text-muted-foreground font-mono">
                          {ip}
                        </div>
                      ))}
                      {!ipRestrictions.data?.deniedIps?.length && (
                        <p className="text-sm text-muted-foreground">No restrictions</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rate Limiting Tab */}
        <TabsContent value="ratelimit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limit Rules</CardTitle>
              <CardDescription>
                Configure rate limiting rules for endpoints
              </CardDescription>
              <Dialog open={rateLimitDialogOpen} onOpenChange={setRateLimitDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Rate Limit Rule</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Rule Name</Label>
                      <Input
                        value={newRule.name}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        placeholder="Login Rate Limit"
                      />
                    </div>
                    <div>
                      <Label>Endpoint Pattern</Label>
                      <Input
                        value={newRule.endpoint}
                        onChange={(e) => setNewRule({ ...newRule, endpoint: e.target.value })}
                        placeholder="/api/login"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Max Requests</Label>
                        <Input
                          type="number"
                          value={newRule.maxRequests}
                          onChange={(e) => setNewRule({ ...newRule, maxRequests: Number(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label>Window (seconds)</Label>
                        <Input
                          type="number"
                          value={newRule.windowSeconds}
                          onChange={(e) => setNewRule({ ...newRule, windowSeconds: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Action</Label>
                      <Select
                        value={newRule.action}
                        onValueChange={(value: any) => setNewRule({ ...newRule, action: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="throttle">Throttle</SelectItem>
                          <SelectItem value="block">Block</SelectItem>
                          <SelectItem value="alert">Alert Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleCreateRateLimitRule} className="w-full">
                      Create Rule
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rateLimitRules.data?.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rule.name}</span>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline">{rule.action}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {rule.endpoint} - {rule.maxRequests} requests per {rule.windowSeconds}s
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) =>
                          updateRateLimitRule.mutate({
                            id: rule.id,
                            updates: { enabled: checked },
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this rule?')) {
                            deleteRateLimitRule.mutate(rule.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure global security policies</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settings.data && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Device Fingerprinting</Label>
                      <p className="text-sm text-muted-foreground">
                        Track and verify devices accessing the system
                      </p>
                    </div>
                    <Switch
                      checked={settings.data.deviceFingerprintingEnabled}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ deviceFingerprintingEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-block Suspicious Activity</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically block users with critical security events
                      </p>
                    </div>
                    <Switch
                      checked={settings.data.autoBlockSuspiciousActivity}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ autoBlockSuspiciousActivity: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>IP Whitelist Mode</Label>
                      <p className="text-sm text-muted-foreground">
                        Enforce IP whitelist globally
                      </p>
                    </div>
                    <Switch
                      checked={settings.data.ipWhitelistEnabled}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ ipWhitelistEnabled: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Require Device Approval</Label>
                      <p className="text-sm text-muted-foreground">
                        New devices must be approved before access
                      </p>
                    </div>
                    <Switch
                      checked={settings.data.requireDeviceApproval}
                      onCheckedChange={(checked) =>
                        handleUpdateSettings({ requireDeviceApproval: checked })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Devices Per User</Label>
                    <Input
                      type="number"
                      value={settings.data.maxDevicesPerUser}
                      onChange={(e) =>
                        handleUpdateSettings({ maxDevicesPerUser: Number(e.target.value) })
                      }
                      className="max-w-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Concurrent Connections</Label>
                    <Input
                      type="number"
                      value={settings.data.maxConcurrentConnections}
                      onChange={(e) =>
                        handleUpdateSettings({ maxConcurrentConnections: Number(e.target.value) })
                      }
                      className="max-w-xs"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Session Timeout (milliseconds)</Label>
                    <Input
                      type="number"
                      value={settings.data.sessionTimeout}
                      onChange={(e) =>
                        handleUpdateSettings({ sessionTimeout: Number(e.target.value) })
                      }
                      className="max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Current: {(settings.data.sessionTimeout / 3600000).toFixed(1)} hours
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
