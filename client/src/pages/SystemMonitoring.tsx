import { useState } from 'react';
import {
  useSystemMetrics,
  useSystemHealth,
  useAlerts,
  useCreateAlert,
  useUpdateAlert,
  useDeleteAlert,
} from '@/hooks/use-monitoring';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Activity, Cpu, HardDrive, Wifi, Users, Tv, AlertTriangle, CheckCircle, XCircle, Plus, Trash2, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SystemMonitoring() {
  const { toast } = useToast();
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [newAlert, setNewAlert] = useState({
    name: '',
    type: 'email' as const,
    condition: {
      metric: 'cpu',
      operator: 'gt',
      value: 80,
      duration: 5,
    },
    threshold: 80,
    enabled: true,
    recipients: [''],
    cooldown: 30,
  });

  const metrics = useSystemMetrics();
  const health = useSystemHealth();
  const alerts = useAlerts();

  const createAlert = useCreateAlert();
  const updateAlert = useUpdateAlert();
  const deleteAlert = useDeleteAlert();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Healthy</Badge>;
      case 'degraded': return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Degraded</Badge>;
      case 'unhealthy': return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Unhealthy</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleCreateAlert = async () => {
    try {
      await createAlert.mutateAsync(newAlert);
      toast({ title: 'Success', description: 'Alert created successfully' });
      setAlertDialogOpen(false);
      setNewAlert({
        name: '',
        type: 'email',
        condition: { metric: 'cpu', operator: 'gt', value: 80, duration: 5 },
        threshold: 80,
        enabled: true,
        recipients: [''],
        cooldown: 30,
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create alert', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8" />
            System Monitoring
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time system metrics, health checks, and alerts
          </p>
        </div>
        <Badge className={`text-lg px-4 py-2 ${
          health.data?.overall === 'healthy' ? 'bg-green-500' :
          health.data?.overall === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
        }`}>
          {health.data?.overall === 'healthy' && <CheckCircle className="h-5 w-5 mr-2" />}
          {health.data?.overall === 'degraded' && <AlertTriangle className="h-5 w-5 mr-2" />}
          {health.data?.overall === 'unhealthy' && <XCircle className="h-5 w-5 mr-2" />}
          System {health.data?.overall || 'Unknown'}
        </Badge>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.data?.cpu.usage.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">{metrics.data?.cpu.cores} cores</p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${metrics.data && metrics.data.cpu.usage > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${metrics.data?.cpu.usage || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.data?.memory.usagePercent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(metrics.data?.memory.used || 0)} / {formatBytes(metrics.data?.memory.total || 0)}
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${metrics.data && metrics.data.memory.usagePercent > 85 ? 'bg-red-500' : 'bg-green-500'}`}
                style={{ width: `${metrics.data?.memory.usagePercent || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.data?.disk.usagePercent.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(metrics.data?.disk.used || 0)} / {formatBytes(metrics.data?.disk.total || 0)}
            </p>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full ${metrics.data && metrics.data.disk.usagePercent > 90 ? 'bg-red-500' : 'bg-purple-500'}`}
                style={{ width: `${metrics.data?.disk.usagePercent || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.data?.users.online || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.data?.users.active || 0} active / {metrics.data?.users.total || 0} total
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="health" className="space-y-4">
        <TabsList>
          <TabsTrigger value="health">Health Checks</TabsTrigger>
          <TabsTrigger value="streams">Streams Status</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>

        {/* Health Checks Tab */}
        <TabsContent value="health" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>Current status of all services</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {health.data?.health.map((check) => (
                  <div key={check.service} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Activity className="h-5 w-5" />
                      <div>
                        <p className="font-medium capitalize">{check.service}</p>
                        <p className="text-sm text-muted-foreground">
                          Response time: {check.responseTime}ms
                        </p>
                        {check.message && (
                          <p className="text-xs text-red-500 mt-1">{check.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getHealthBadge(check.status)}
                      <span className="text-xs text-muted-foreground">
                        {new Date(check.lastCheck).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
                {!health.data?.health.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No health checks available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Streams Status Tab */}
        <TabsContent value="streams" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Streams Overview</CardTitle>
              <CardDescription>Current streaming statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Tv className="h-5 w-5" />
                    <span className="font-medium">Total Streams</span>
                  </div>
                  <p className="text-3xl font-bold">{metrics.data?.streams.total || 0}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="font-medium">Online</span>
                  </div>
                  <p className="text-3xl font-bold text-green-500">{metrics.data?.streams.online || 0}</p>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Offline</span>
                  </div>
                  <p className="text-3xl font-bold text-red-500">{metrics.data?.streams.offline || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert Rules</CardTitle>
              <CardDescription>Manage system alerts and notifications</CardDescription>
              <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    New Alert
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Alert Rule</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Alert Name</Label>
                      <Input
                        value={newAlert.name}
                        onChange={(e) => setNewAlert({ ...newAlert, name: e.target.value })}
                        placeholder="High CPU Usage"
                      />
                    </div>
                    <div>
                      <Label>Metric</Label>
                      <Select
                        value={newAlert.condition.metric}
                        onValueChange={(value) => setNewAlert({
                          ...newAlert,
                          condition: { ...newAlert.condition, metric: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpu">CPU Usage</SelectItem>
                          <SelectItem value="memory">Memory Usage</SelectItem>
                          <SelectItem value="disk">Disk Usage</SelectItem>
                          <SelectItem value="streams_offline">Streams Offline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Operator</Label>
                        <Select
                          value={newAlert.condition.operator}
                          onValueChange={(value) => setNewAlert({
                            ...newAlert,
                            condition: { ...newAlert.condition, operator: value }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gt">Greater Than</SelectItem>
                            <SelectItem value="lt">Less Than</SelectItem>
                            <SelectItem value="eq">Equal To</SelectItem>
                            <SelectItem value="gte">Greater Than or Equal</SelectItem>
                            <SelectItem value="lte">Less Than or Equal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Threshold</Label>
                        <Input
                          type="number"
                          value={newAlert.threshold}
                          onChange={(e) => setNewAlert({ ...newAlert, threshold: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Notification Type</Label>
                      <Select
                        value={newAlert.type}
                        onValueChange={(value: any) => setNewAlert({ ...newAlert, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Recipient</Label>
                      <Input
                        value={newAlert.recipients[0]}
                        onChange={(e) => setNewAlert({ ...newAlert, recipients: [e.target.value] })}
                        placeholder="admin@example.com"
                      />
                    </div>
                    <Button onClick={handleCreateAlert} className="w-full">
                      Create Alert
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.data?.map((alert) => (
                  <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        <span className="font-medium">{alert.name}</span>
                        <Badge variant={alert.enabled ? 'default' : 'secondary'}>
                          {alert.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {alert.condition.metric} {alert.condition.operator} {alert.threshold}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Triggered {alert.triggerCount} times | Cooldown: {alert.cooldown}min
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={alert.enabled}
                        onCheckedChange={(checked) =>
                          updateAlert.mutate({
                            id: alert.id,
                            updates: { enabled: checked },
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this alert?')) {
                            deleteAlert.mutate(alert.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!alerts.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No alerts configured yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
