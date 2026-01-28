import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Server, Activity, RefreshCw, Settings, Plus, Trash2, Loader2, AlertTriangle, CheckCircle, XCircle, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";

interface LoadBalancingSettings {
  id: number;
  enabled: boolean;
  strategy: string;
  healthCheckEnabled: boolean;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  maxFailuresBeforeRemoval: number;
  autoFailover: boolean;
  stickySessionsEnabled: boolean;
  stickySessionTtl: number;
  geoRoutingEnabled: boolean;
  defaultGeoZone: string;
}

interface ServerWithHealth {
  id: number;
  serverName: string;
  serverUrl: string;
  status: string;
  enabled: boolean;
  cpuUsage: number;
  memoryUsage: number;
  bandwidth: number;
  currentClients: number;
  maxClients: number;
  geoZone: string | null;
  lastHealth: {
    status: string;
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    createdAt: string;
  } | null;
}

interface LoadBalancingRule {
  id: number;
  name: string;
  strategy: string;
  priority: number;
  serverIds: number[];
  enableFailover: boolean;
  enabled: boolean;
}

interface FailoverHistory {
  id: number;
  fromServerId: number;
  toServerId: number;
  reason: string;
  createdAt: string;
}

interface Stats {
  totalServers: number;
  onlineServers: number;
  offlineServers: number;
  totalConnections: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
}

export default function LoadBalancing() {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<LoadBalancingSettings>({
    queryKey: ["/api/load-balancing/settings"],
  });

  const { data: servers = [], isLoading: serversLoading } = useQuery<ServerWithHealth[]>({
    queryKey: ["/api/load-balancing/servers"],
  });

  const { data: rules = [], isLoading: rulesLoading } = useQuery<LoadBalancingRule[]>({
    queryKey: ["/api/load-balancing/rules"],
  });

  const { data: failoverHistory = [] } = useQuery<FailoverHistory[]>({
    queryKey: ["/api/load-balancing/failover-history"],
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/load-balancing/stats"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<LoadBalancingSettings>) => apiRequest("PUT", "/api/load-balancing/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-balancing/settings"] });
      setSettingsDialogOpen(false);
      toast({ title: "Load balancing settings updated" });
    },
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/load-balancing/rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-balancing/rules"] });
      setRuleDialogOpen(false);
      toast({ title: "Rule created" });
    },
    onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/load-balancing/rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-balancing/rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
  });

  const healthCheckMutation = useMutation({
    mutationFn: (serverId: number) => apiRequest("POST", `/api/load-balancing/servers/${serverId}/health-check`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-balancing/servers"] });
      toast({ title: "Health check completed" });
    },
    onError: () => toast({ title: "Health check failed", variant: "destructive" }),
  });

  const failoverMutation = useMutation({
    mutationFn: (data: { fromServerId: number; toServerId: number; reason?: string }) =>
      apiRequest("POST", "/api/load-balancing/failover", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/load-balancing/servers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/load-balancing/failover-history"] });
      toast({ title: "Failover triggered" });
    },
    onError: () => toast({ title: "Failover failed", variant: "destructive" }),
  });

  const handleSettingsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSettingsMutation.mutate({
      enabled: formData.get("enabled") === "on",
      strategy: formData.get("strategy") as string,
      healthCheckEnabled: formData.get("healthCheckEnabled") === "on",
      healthCheckInterval: Number(formData.get("healthCheckInterval")),
      healthCheckTimeout: Number(formData.get("healthCheckTimeout")),
      maxFailuresBeforeRemoval: Number(formData.get("maxFailuresBeforeRemoval")),
      autoFailover: formData.get("autoFailover") === "on",
      stickySessionsEnabled: formData.get("stickySessionsEnabled") === "on",
      stickySessionTtl: Number(formData.get("stickySessionTtl")),
      geoRoutingEnabled: formData.get("geoRoutingEnabled") === "on",
      defaultGeoZone: formData.get("defaultGeoZone") as string,
    });
  };

  const handleRuleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createRuleMutation.mutate({
      name: formData.get("name"),
      strategy: formData.get("strategy"),
      priority: Number(formData.get("priority")),
      enableFailover: formData.get("enableFailover") === "on",
      enabled: true,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
      case "healthy":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Online</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" /> Warning</Badge>;
      case "critical":
      case "offline":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Offline</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (settingsLoading) {
    return (
      <Layout title="Load Balancing">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Load Balancing">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Load Balancing & Multi-Server</h1>
            <p className="text-muted-foreground">Manage server distribution, health checks, and failover</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-lb-settings">
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Load Balancing Settings</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSettingsSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch name="enabled" defaultChecked={settings?.enabled} />
                      <Label>Enable Load Balancing</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch name="autoFailover" defaultChecked={settings?.autoFailover} />
                      <Label>Auto Failover</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Strategy</Label>
                      <Select name="strategy" defaultValue={settings?.strategy || "least_connections"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round_robin">Round Robin</SelectItem>
                          <SelectItem value="least_connections">Least Connections</SelectItem>
                          <SelectItem value="weighted">Weighted</SelectItem>
                          <SelectItem value="geographic">Geographic</SelectItem>
                          <SelectItem value="random">Random</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Default Geo Zone</Label>
                      <Input name="defaultGeoZone" defaultValue={settings?.defaultGeoZone || "global"} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch name="healthCheckEnabled" defaultChecked={settings?.healthCheckEnabled} />
                      <Label>Health Checks</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch name="geoRoutingEnabled" defaultChecked={settings?.geoRoutingEnabled} />
                      <Label>Geo Routing</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Check Interval (sec)</Label>
                      <Input name="healthCheckInterval" type="number" defaultValue={settings?.healthCheckInterval || 30} />
                    </div>
                    <div>
                      <Label>Check Timeout (sec)</Label>
                      <Input name="healthCheckTimeout" type="number" defaultValue={settings?.healthCheckTimeout || 10} />
                    </div>
                    <div>
                      <Label>Max Failures</Label>
                      <Input name="maxFailuresBeforeRemoval" type="number" defaultValue={settings?.maxFailuresBeforeRemoval || 3} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Switch name="stickySessionsEnabled" defaultChecked={settings?.stickySessionsEnabled} />
                      <Label>Sticky Sessions</Label>
                    </div>
                    <div>
                      <Label>Session TTL (sec)</Label>
                      <Input name="stickySessionTtl" type="number" defaultValue={settings?.stickySessionTtl || 3600} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={updateSettingsMutation.isPending}>
                      {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Settings
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalServers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.onlineServers || 0} online, {stats?.offlineServers || 0} offline
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalConnections || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg CPU Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.avgCpuUsage?.toFixed(1) || 0}%</div>
              <Progress value={stats?.avgCpuUsage || 0} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Memory Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.avgMemoryUsage?.toFixed(1) || 0}%</div>
              <Progress value={stats?.avgMemoryUsage || 0} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="servers">
          <TabsList>
            <TabsTrigger value="servers" data-testid="tab-servers">Servers</TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">Rules</TabsTrigger>
            <TabsTrigger value="failover" data-testid="tab-failover">Failover History</TabsTrigger>
          </TabsList>

          <TabsContent value="servers" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {serversLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : servers.map((server) => (
                <Card key={server.id} data-testid={`card-server-${server.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        {server.serverName}
                      </CardTitle>
                      {getStatusBadge(server.status)}
                    </div>
                    <CardDescription>{server.serverUrl}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">CPU:</span>{" "}
                        <span className="font-medium">{server.cpuUsage?.toFixed(1) || 0}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Memory:</span>{" "}
                        <span className="font-medium">{server.memoryUsage?.toFixed(1) || 0}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Clients:</span>{" "}
                        <span className="font-medium">{server.currentClients || 0}/{server.maxClients || 1000}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Zone:</span>{" "}
                        <span className="font-medium">{server.geoZone || "global"}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>CPU</span>
                        <span>{server.cpuUsage?.toFixed(0) || 0}%</span>
                      </div>
                      <Progress value={server.cpuUsage || 0} className="h-1" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Memory</span>
                        <span>{server.memoryUsage?.toFixed(0) || 0}%</span>
                      </div>
                      <Progress value={server.memoryUsage || 0} className="h-1" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => healthCheckMutation.mutate(server.id)}
                        disabled={healthCheckMutation.isPending}
                        data-testid={`button-health-check-${server.id}`}
                      >
                        <RefreshCw className={`w-3 h-3 mr-1 ${healthCheckMutation.isPending ? 'animate-spin' : ''}`} />
                        Check
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const toServer = servers.find(s => s.id !== server.id && s.status === 'online');
                          if (toServer) {
                            failoverMutation.mutate({ fromServerId: server.id, toServerId: toServer.id });
                          } else {
                            toast({ title: "No available server for failover", variant: "destructive" });
                          }
                        }}
                        data-testid={`button-failover-${server.id}`}
                      >
                        <Zap className="w-3 h-3 mr-1" /> Failover
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-rule">
                    <Plus className="w-4 h-4 mr-2" /> Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Load Balancing Rule</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRuleSubmit} className="space-y-4">
                    <div>
                      <Label>Rule Name</Label>
                      <Input name="name" required placeholder="e.g., Europe Traffic" />
                    </div>
                    <div>
                      <Label>Strategy</Label>
                      <Select name="strategy" defaultValue="least_connections">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round_robin">Round Robin</SelectItem>
                          <SelectItem value="least_connections">Least Connections</SelectItem>
                          <SelectItem value="weighted">Weighted</SelectItem>
                          <SelectItem value="geographic">Geographic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority</Label>
                      <Input name="priority" type="number" defaultValue={0} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch name="enableFailover" defaultChecked />
                      <Label>Enable Failover</Label>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={createRuleMutation.isPending}>
                        {createRuleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Rule
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Strategy</th>
                    <th className="p-3 text-left">Priority</th>
                    <th className="p-3 text-left">Failover</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rulesLoading ? (
                    <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  ) : rules.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No rules configured</td></tr>
                  ) : rules.map((rule) => (
                    <tr key={rule.id} className="border-b" data-testid={`row-rule-${rule.id}`}>
                      <td className="p-3">{rule.name}</td>
                      <td className="p-3"><Badge variant="secondary">{rule.strategy}</Badge></td>
                      <td className="p-3">{rule.priority}</td>
                      <td className="p-3">{rule.enableFailover ? <Badge className="bg-green-500">Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          disabled={deleteRuleMutation.isPending}
                          data-testid={`button-delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="failover" className="space-y-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">From Server</th>
                    <th className="p-3 text-left">To Server</th>
                    <th className="p-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {failoverHistory.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No failover events</td></tr>
                  ) : failoverHistory.map((event) => (
                    <tr key={event.id} className="border-b" data-testid={`row-failover-${event.id}`}>
                      <td className="p-3">{new Date(event.createdAt).toLocaleString()}</td>
                      <td className="p-3">{servers.find(s => s.id === event.fromServerId)?.serverName || event.fromServerId}</td>
                      <td className="p-3">{servers.find(s => s.id === event.toServerId)?.serverName || event.toServerId}</td>
                      <td className="p-3">{event.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
