import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Activity, RefreshCw, AlertTriangle, CheckCircle, XCircle, Play, Pause, Settings, Plus, Trash2, Loader2, Eye, Wifi, WifiOff, Zap } from "lucide-react";
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

interface StreamHealthMetric {
  id: number;
  streamId: number;
  status: string;
  uptime: number;
  bitrate: number;
  fps: number;
  resolution: string;
  codec: string;
  errorCount: number;
  activeViewers: number;
  restartCount: number;
  lastRestart: string | null;
  lastCheck: string;
  lastUpdated: string;
}

interface AutoRestartRule {
  id: number;
  name: string;
  enabled: boolean;
  triggerType: string;
  threshold: number;
  cooldownMinutes: number;
  maxRestarts: number;
  applyToCategories: number[];
  applyToStreams: number[];
}

interface StreamError {
  id: number;
  streamId: number;
  errorType: string;
  errorMessage: string;
  occurredAt: string;
  resolved: boolean;
}

interface Overview {
  totalStreams: number;
  monitoredStreams: number;
  online: number;
  offline: number;
  degraded: number;
  errors: number;
  totalViewers: number;
  avgBitrate: number;
}

export default function StreamMonitoring() {
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    enabled: true,
    triggerType: "offline",
    threshold: 60,
    cooldownMinutes: 5,
    maxRestarts: 3,
    applyToCategories: [] as number[],
    applyToStreams: [] as number[],
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<Overview>({
    queryKey: ["/api/stream-monitoring/overview"],
    refetchInterval: 30000,
  });

  const { data: healthMetrics = [], isLoading: metricsLoading } = useQuery<StreamHealthMetric[]>({
    queryKey: ["/api/stream-monitoring/health"],
    refetchInterval: 30000,
  });

  const { data: errors = [] } = useQuery<StreamError[]>({
    queryKey: ["/api/stream-monitoring/errors"],
  });

  const { data: autoRestartRules = [] } = useQuery<AutoRestartRule[]>({
    queryKey: ["/api/stream-monitoring/auto-restart-rules"],
  });

  const restartStreamMutation = useMutation({
    mutationFn: (streamId: number) => apiRequest("POST", `/api/stream-monitoring/restart/${streamId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stream-monitoring/health"] });
      toast({ title: "Stream restart initiated" });
    },
    onError: () => toast({ title: "Failed to restart stream", variant: "destructive" }),
  });

  const createRuleMutation = useMutation({
    mutationFn: (data: typeof newRule) => apiRequest("POST", "/api/stream-monitoring/auto-restart-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stream-monitoring/auto-restart-rules"] });
      setRuleDialogOpen(false);
      setNewRule({ name: "", enabled: true, triggerType: "offline", threshold: 60, cooldownMinutes: 5, maxRestarts: 3, applyToCategories: [], applyToStreams: [] });
      toast({ title: "Auto-restart rule created" });
    },
    onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/stream-monitoring/auto-restart-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stream-monitoring/auto-restart-rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => 
      apiRequest("PUT", `/api/stream-monitoring/auto-restart-rules/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stream-monitoring/auto-restart-rules"] });
      toast({ title: "Rule updated" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-600" data-testid="badge-status-online"><CheckCircle className="w-3 h-3 mr-1" /> Online</Badge>;
      case "offline":
        return <Badge variant="destructive" data-testid="badge-status-offline"><XCircle className="w-3 h-3 mr-1" /> Offline</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-600" data-testid="badge-status-degraded"><AlertTriangle className="w-3 h-3 mr-1" /> Degraded</Badge>;
      case "error":
        return <Badge variant="destructive" data-testid="badge-status-error"><AlertTriangle className="w-3 h-3 mr-1" /> Error</Badge>;
      case "restarting":
        return <Badge className="bg-blue-600" data-testid="badge-status-restarting"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Restarting</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-status-unknown">{status}</Badge>;
    }
  };

  if (overviewLoading || metricsLoading) {
    return (
      <Layout title="Stream Monitoring" subtitle="Real-time stream health monitoring">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Stream Monitoring" subtitle="Real-time stream health monitoring">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Stream Monitoring</h1>
            <p className="text-muted-foreground">Real-time stream health and auto-restart management</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/stream-monitoring/overview"] });
              queryClient.invalidateQueries({ queryKey: ["/api/stream-monitoring/health"] });
            }}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-streams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-streams">{overview?.totalStreams || 0}</div>
              <p className="text-xs text-muted-foreground">
                {overview?.monitoredStreams || 0} monitored
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-online-streams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Online</CardTitle>
              <Wifi className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-online-count">{overview?.online || 0}</div>
              <p className="text-xs text-muted-foreground">
                {overview?.degraded || 0} degraded, {overview?.errors || 0} errors
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-offline-streams">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Offline</CardTitle>
              <WifiOff className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-offline-count">{overview?.offline || 0}</div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-viewers">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Active Viewers</CardTitle>
              <Eye className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-viewers">{overview?.totalViewers || 0}</div>
              <p className="text-xs text-muted-foreground">
                Avg bitrate: {overview?.avgBitrate || 0} kbps
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="health" className="space-y-4">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="health" data-testid="tab-health">Stream Health</TabsTrigger>
            <TabsTrigger value="errors" data-testid="tab-errors">Error Log</TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">Auto-Restart Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="health" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stream Health Metrics</CardTitle>
                <CardDescription>Real-time health status of all monitored streams</CardDescription>
              </CardHeader>
              <CardContent>
                {healthMetrics.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No stream health data available. Health metrics will appear once streams are monitored.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Stream ID</th>
                          <th className="text-left p-2">Status</th>
                          <th className="text-left p-2">Uptime</th>
                          <th className="text-left p-2">Bitrate</th>
                          <th className="text-left p-2">FPS</th>
                          <th className="text-left p-2">Resolution</th>
                          <th className="text-left p-2">Viewers</th>
                          <th className="text-left p-2">Restarts</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {healthMetrics.map((metric) => (
                          <tr key={metric.id} className="border-b" data-testid={`row-stream-${metric.streamId}`}>
                            <td className="p-2">{metric.streamId}</td>
                            <td className="p-2">{getStatusBadge(metric.status)}</td>
                            <td className="p-2">{metric.uptime ? `${Math.round(metric.uptime / 3600)}h` : "N/A"}</td>
                            <td className="p-2">{metric.bitrate ? `${metric.bitrate} kbps` : "N/A"}</td>
                            <td className="p-2">{metric.fps || "N/A"}</td>
                            <td className="p-2">{metric.resolution || "N/A"}</td>
                            <td className="p-2">{metric.activeViewers || 0}</td>
                            <td className="p-2">{metric.restartCount || 0}</td>
                            <td className="p-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => restartStreamMutation.mutate(metric.streamId)}
                                disabled={restartStreamMutation.isPending}
                                data-testid={`button-restart-${metric.streamId}`}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" /> Restart
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Stream Error Log</CardTitle>
                <CardDescription>Recent errors and issues with streams</CardDescription>
              </CardHeader>
              <CardContent>
                {errors.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No stream errors recorded</p>
                ) : (
                  <div className="space-y-4">
                    {errors.map((error) => (
                      <div key={error.id} className="flex items-start gap-4 p-4 border rounded-lg" data-testid={`error-${error.id}`}>
                        <AlertTriangle className={`w-5 h-5 ${error.resolved ? "text-muted-foreground" : "text-red-500"}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Stream {error.streamId}</span>
                            <Badge variant={error.resolved ? "secondary" : "destructive"}>
                              {error.errorType}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{error.errorMessage}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(error.occurredAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Auto-Restart Rules</CardTitle>
                  <CardDescription>Configure automatic stream restart conditions</CardDescription>
                </div>
                <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-rule">
                      <Plus className="w-4 h-4 mr-2" /> Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Auto-Restart Rule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Rule Name</Label>
                        <Input
                          value={newRule.name}
                          onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                          placeholder="e.g., Restart on offline"
                          data-testid="input-rule-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trigger Type</Label>
                        <Select value={newRule.triggerType} onValueChange={(v) => setNewRule({ ...newRule, triggerType: v })}>
                          <SelectTrigger data-testid="select-trigger-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offline">Stream Offline</SelectItem>
                            <SelectItem value="error">Stream Error</SelectItem>
                            <SelectItem value="low_bitrate">Low Bitrate</SelectItem>
                            <SelectItem value="high_latency">High Latency</SelectItem>
                            <SelectItem value="no_viewers">No Viewers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Threshold (seconds before restart)</Label>
                        <Input
                          type="number"
                          value={newRule.threshold}
                          onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                          data-testid="input-threshold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cooldown (minutes between restarts)</Label>
                        <Input
                          type="number"
                          value={newRule.cooldownMinutes}
                          onChange={(e) => setNewRule({ ...newRule, cooldownMinutes: Number(e.target.value) })}
                          data-testid="input-cooldown"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Maximum Restarts</Label>
                        <Input
                          type="number"
                          value={newRule.maxRestarts}
                          onChange={(e) => setNewRule({ ...newRule, maxRestarts: Number(e.target.value) })}
                          data-testid="input-max-restarts"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={newRule.enabled}
                          onCheckedChange={(c) => setNewRule({ ...newRule, enabled: c })}
                          data-testid="switch-enabled"
                        />
                        <Label>Enabled</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setRuleDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createRuleMutation.mutate(newRule)}
                        disabled={!newRule.name || createRuleMutation.isPending}
                        data-testid="button-save-rule"
                      >
                        {createRuleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Rule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {autoRestartRules.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No auto-restart rules configured</p>
                ) : (
                  <div className="space-y-4">
                    {autoRestartRules.map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`rule-${rule.id}`}>
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(c) => toggleRuleMutation.mutate({ id: rule.id, enabled: c })}
                            data-testid={`switch-rule-${rule.id}`}
                          />
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Trigger: {rule.triggerType} | Threshold: {rule.threshold}s | Cooldown: {rule.cooldownMinutes}min | Max: {rule.maxRestarts}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRuleMutation.mutate(rule.id)}
                          disabled={deleteRuleMutation.isPending}
                          data-testid={`button-delete-rule-${rule.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
