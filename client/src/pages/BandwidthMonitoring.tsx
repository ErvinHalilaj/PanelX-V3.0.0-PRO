import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Activity, Bell, Plus, Trash2, Loader2, Settings, Server, User, Send, AlertTriangle } from "lucide-react";
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

interface BandwidthOverview {
  totalBytesIn: number;
  totalBytesOut: number;
  totalBytesTotal: number;
  activeConnections: number;
  peakBandwidth: number;
  avgBandwidth: number;
}

interface BandwidthStats {
  hourly: Array<{
    hour: string;
    bytesIn: number;
    bytesOut: number;
    bytesTotal: number;
  }>;
  totalBytesIn: number;
  totalBytesOut: number;
  totalBytesTotal: number;
}

interface BandwidthAlert {
  id: number;
  name: string;
  alertType: string;
  thresholdValue: number;
  thresholdUnit: string;
  notificationMethod: string;
  recipient: string;
  enabled: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

interface NotificationHistory {
  id: number;
  type: string;
  recipient: string;
  subject: string | null;
  message: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function BandwidthMonitoring() {
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testType, setTestType] = useState("email");
  const [testRecipient, setTestRecipient] = useState("");

  const { data: overview, isLoading: overviewLoading } = useQuery<BandwidthOverview>({
    queryKey: ["/api/bandwidth/overview"],
  });

  const { data: stats } = useQuery<BandwidthStats>({
    queryKey: ["/api/bandwidth/stats"],
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<BandwidthAlert[]>({
    queryKey: ["/api/bandwidth/alerts"],
  });

  const { data: notifications = [] } = useQuery<NotificationHistory[]>({
    queryKey: ["/api/bandwidth/notifications"],
  });

  const { data: servers = [] } = useQuery<any[]>({
    queryKey: ["/api/servers"],
  });

  const createAlertMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/bandwidth/alerts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bandwidth/alerts"] });
      setAlertDialogOpen(false);
      toast({ title: "Alert created" });
    },
    onError: () => toast({ title: "Failed to create alert", variant: "destructive" }),
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bandwidth/alerts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bandwidth/alerts"] });
      toast({ title: "Alert deleted" });
    },
    onError: () => toast({ title: "Failed to delete alert", variant: "destructive" }),
  });

  const toggleAlertMutation = useMutation({
    mutationFn: (alert: BandwidthAlert) =>
      apiRequest("PUT", `/api/bandwidth/alerts/${alert.id}`, { enabled: !alert.enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bandwidth/alerts"] });
      toast({ title: "Alert updated" });
    },
    onError: () => toast({ title: "Failed to update alert", variant: "destructive" }),
  });

  const testNotificationMutation = useMutation({
    mutationFn: (data: { type: string; recipient: string; message?: string }) =>
      apiRequest("POST", "/api/bandwidth/test-notification", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bandwidth/notifications"] });
      setTestDialogOpen(false);
      toast({ title: "Test notification sent" });
    },
    onError: () => toast({ title: "Failed to send notification", variant: "destructive" }),
  });

  const handleAlertSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createAlertMutation.mutate({
      name: formData.get("name"),
      alertType: formData.get("alertType"),
      thresholdValue: Number(formData.get("thresholdValue")),
      thresholdUnit: formData.get("thresholdUnit"),
      notificationMethod: formData.get("notificationMethod"),
      recipient: formData.get("recipient"),
      enabled: true,
    });
  };

  if (overviewLoading) {
    return (
      <Layout title="Bandwidth Monitoring">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Bandwidth Monitoring">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bandwidth Monitoring</h1>
            <p className="text-muted-foreground">Track bandwidth usage and set up alerts</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-test-notification">
                  <Send className="w-4 h-4 mr-2" /> Test Notification
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Test Notification</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={testType} onValueChange={setTestType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Recipient</Label>
                    <Input
                      value={testRecipient}
                      onChange={(e) => setTestRecipient(e.target.value)}
                      placeholder={testType === "email" ? "email@example.com" : testType === "webhook" ? "https://..." : "Chat ID"}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => testNotificationMutation.mutate({ type: testType, recipient: testRecipient })}
                      disabled={testNotificationMutation.isPending}
                    >
                      {testNotificationMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Send Test
                    </Button>
                  </DialogFooter>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-alert">
                  <Plus className="w-4 h-4 mr-2" /> Add Alert
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Bandwidth Alert</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAlertSubmit} className="space-y-4">
                  <div>
                    <Label>Alert Name</Label>
                    <Input name="name" required placeholder="e.g., High Bandwidth Warning" />
                  </div>
                  <div>
                    <Label>Alert Type</Label>
                    <Select name="alertType" defaultValue="bandwidth_threshold">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bandwidth_threshold">Bandwidth Threshold</SelectItem>
                        <SelectItem value="connection_threshold">Connection Threshold</SelectItem>
                        <SelectItem value="server_offline">Server Offline</SelectItem>
                        <SelectItem value="usage_quota">Usage Quota</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Threshold Value</Label>
                      <Input name="thresholdValue" type="number" required defaultValue={100} />
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Select name="thresholdUnit" defaultValue="mbps">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mbps">Mbps</SelectItem>
                          <SelectItem value="gbps">Gbps</SelectItem>
                          <SelectItem value="gb">GB (total)</SelectItem>
                          <SelectItem value="connections">Connections</SelectItem>
                          <SelectItem value="percent">Percent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Notification Method</Label>
                    <Select name="notificationMethod" defaultValue="email">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="telegram">Telegram</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Recipient</Label>
                    <Input name="recipient" required placeholder="Email, webhook URL, or chat ID" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createAlertMutation.isPending}>
                      {createAlertMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Alert
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
              <CardTitle className="text-sm font-medium">Total Inbound</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(overview?.totalBytesIn || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Outbound</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(overview?.totalBytesOut || 0)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview?.activeConnections || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Peak Bandwidth</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(overview?.peakBandwidth || 0)}/s</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="servers" data-testid="tab-servers">By Server</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
            <TabsTrigger value="notifications" data-testid="tab-notifications">Notification History</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Bandwidth Usage (Last 24h)</CardTitle>
                <CardDescription>Inbound and outbound traffic over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total In</p>
                      <p className="text-xl font-bold">{formatBytes(stats?.totalBytesIn || 0)}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Out</p>
                      <p className="text-xl font-bold">{formatBytes(stats?.totalBytesOut || 0)}</p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-xl font-bold">{formatBytes(stats?.totalBytesTotal || 0)}</p>
                    </div>
                  </div>
                  {stats?.hourly && stats.hourly.length > 0 ? (
                    <div className="h-64 flex items-end gap-1">
                      {stats.hourly.slice(-24).map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-primary rounded-t"
                          style={{ height: `${Math.max(5, (h.bytesTotal / (stats.hourly.reduce((max, hh) => Math.max(max, hh.bytesTotal), 1))) * 100)}%` }}
                          title={`${h.hour}: ${formatBytes(h.bytesTotal)}`}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground">No bandwidth data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="servers" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {servers.map((server: any) => (
                <Card key={server.id} data-testid={`card-server-bw-${server.id}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Server className="w-5 h-5" />
                      {server.serverName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Bandwidth:</span>
                      <span className="font-medium">{formatBytes(server.bandwidth || 0)}/s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Connections:</span>
                      <span className="font-medium">{server.currentClients || 0}</span>
                    </div>
                    <Progress value={(server.bandwidth || 0) / 1000000} className="mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Threshold</th>
                    <th className="p-3 text-left">Method</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {alertsLoading ? (
                    <tr><td colSpan={6} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  ) : alerts.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No alerts configured</td></tr>
                  ) : alerts.map((alert) => (
                    <tr key={alert.id} className="border-b" data-testid={`row-alert-${alert.id}`}>
                      <td className="p-3">{alert.name}</td>
                      <td className="p-3"><Badge variant="secondary">{alert.alertType}</Badge></td>
                      <td className="p-3">{alert.thresholdValue} {alert.thresholdUnit}</td>
                      <td className="p-3">{alert.notificationMethod}</td>
                      <td className="p-3">
                        <Switch
                          checked={alert.enabled}
                          onCheckedChange={() => toggleAlertMutation.mutate(alert)}
                        />
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteAlertMutation.mutate(alert.id)}
                          disabled={deleteAlertMutation.isPending}
                          data-testid={`button-delete-alert-${alert.id}`}
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

          <TabsContent value="notifications" className="space-y-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Recipient</th>
                    <th className="p-3 text-left">Subject</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No notifications sent</td></tr>
                  ) : notifications.map((notif) => (
                    <tr key={notif.id} className="border-b" data-testid={`row-notification-${notif.id}`}>
                      <td className="p-3">{new Date(notif.createdAt).toLocaleString()}</td>
                      <td className="p-3"><Badge variant="secondary">{notif.type}</Badge></td>
                      <td className="p-3">{notif.recipient}</td>
                      <td className="p-3">{notif.subject || "-"}</td>
                      <td className="p-3">
                        <Badge className={notif.status === "sent" ? "bg-green-500" : notif.status === "failed" ? "bg-red-500" : "bg-yellow-500"}>
                          {notif.status}
                        </Badge>
                      </td>
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
