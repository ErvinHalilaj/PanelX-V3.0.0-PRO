import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bell, Mail, MessageSquare, Send, Plus, Trash2, Loader2, CheckCircle, XCircle, AlertTriangle, Settings, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

interface NotificationSettings {
  id: number;
  emailEnabled: boolean;
  emailSmtpHost: string | null;
  emailSmtpPort: number | null;
  emailSmtpUser: string | null;
  emailFromAddress: string | null;
  emailFromName: string | null;
  telegramEnabled: boolean;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  discordEnabled: boolean;
  discordWebhookUrl: string | null;
  slackEnabled: boolean;
  slackWebhookUrl: string | null;
}

interface NotificationTrigger {
  id: number;
  name: string;
  enabled: boolean;
  eventType: string;
  channels: string[];
  messageTemplate: string | null;
  cooldownMinutes: number;
  lastTriggered: string | null;
}

interface NotificationLog {
  id: number;
  triggerType: string;
  triggerName: string;
  channel: string;
  message: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

interface NotificationStats {
  totalNotifications: number;
  sent: number;
  failed: number;
  pending: number;
  activeTriggers: number;
  byChannel: {
    email: number;
    telegram: number;
    discord: number;
    slack: number;
  };
}

export default function NotificationSettings() {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [triggerDialogOpen, setTriggerDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testChannel, setTestChannel] = useState("email");
  const [testMessage, setTestMessage] = useState("Test notification from PanelX");
  const [newTrigger, setNewTrigger] = useState({
    name: "",
    enabled: true,
    eventType: "stream_offline",
    channels: ["email"] as string[],
    messageTemplate: "",
    cooldownMinutes: 5,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery<NotificationSettings>({
    queryKey: ["/api/notifications/settings"],
  });

  const { data: triggers = [] } = useQuery<NotificationTrigger[]>({
    queryKey: ["/api/notifications/triggers"],
  });

  const { data: logs = [] } = useQuery<NotificationLog[]>({
    queryKey: ["/api/notifications/log"],
  });

  const { data: stats } = useQuery<NotificationStats>({
    queryKey: ["/api/notifications/stats"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<NotificationSettings>) => apiRequest("PUT", "/api/notifications/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/settings"] });
      setSettingsDialogOpen(false);
      toast({ title: "Settings updated" });
    },
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const createTriggerMutation = useMutation({
    mutationFn: (data: typeof newTrigger) => apiRequest("POST", "/api/notifications/triggers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/triggers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/stats"] });
      setTriggerDialogOpen(false);
      setNewTrigger({
        name: "",
        enabled: true,
        eventType: "stream_offline",
        channels: ["email"],
        messageTemplate: "",
        cooldownMinutes: 5,
      });
      toast({ title: "Trigger created" });
    },
    onError: () => toast({ title: "Failed to create trigger", variant: "destructive" }),
  });

  const deleteTriggerMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/notifications/triggers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/triggers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/stats"] });
      toast({ title: "Trigger deleted" });
    },
    onError: () => toast({ title: "Failed to delete trigger", variant: "destructive" }),
  });

  const toggleTriggerMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => 
      apiRequest("PUT", `/api/notifications/triggers/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/triggers"] });
      toast({ title: "Trigger updated" });
    },
  });

  const testNotificationMutation = useMutation({
    mutationFn: (data: { channel: string; message: string }) => 
      apiRequest("POST", "/api/notifications/test", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/log"] });
      setTestDialogOpen(false);
      toast({ title: "Test notification sent" });
    },
    onError: () => toast({ title: "Failed to send test", variant: "destructive" }),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Sent</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "email":
        return <Mail className="w-4 h-4" />;
      case "telegram":
        return <Send className="w-4 h-4" />;
      case "discord":
        return <MessageSquare className="w-4 h-4" />;
      case "slack":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  if (settingsLoading) {
    return (
      <Layout title="Notification Settings" subtitle="Configure multi-channel alerts">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Notification Settings" subtitle="Configure multi-channel alerts">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Notification Settings</h1>
            <p className="text-muted-foreground">Configure alerts via email, Telegram, Discord, and Slack</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" data-testid="button-test-notification">
                  <Zap className="w-4 h-4 mr-2" /> Test Notification
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Test Notification</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Channel</Label>
                    <Select value={testChannel} onValueChange={setTestChannel}>
                      <SelectTrigger data-testid="select-test-channel">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email" disabled={!settings?.emailEnabled}>Email</SelectItem>
                        <SelectItem value="telegram" disabled={!settings?.telegramEnabled}>Telegram</SelectItem>
                        <SelectItem value="discord" disabled={!settings?.discordEnabled}>Discord</SelectItem>
                        <SelectItem value="slack" disabled={!settings?.slackEnabled}>Slack</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Test message content"
                      data-testid="input-test-message"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTestDialogOpen(false)} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button
                    onClick={() => testNotificationMutation.mutate({ channel: testChannel, message: testMessage })}
                    disabled={testNotificationMutation.isPending}
                    data-testid="button-send-test"
                  >
                    {testNotificationMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Send Test
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-configure">
                  <Settings className="w-4 h-4 mr-2" /> Configure Channels
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Notification Channel Configuration</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 max-h-96 overflow-y-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        <Label className="text-lg">Email</Label>
                      </div>
                      <Switch
                        checked={settings?.emailEnabled || false}
                        onCheckedChange={(c) => updateSettingsMutation.mutate({ emailEnabled: c })}
                        data-testid="switch-email-enabled"
                      />
                    </div>
                    {settings?.emailEnabled && (
                      <div className="grid grid-cols-2 gap-4 pl-7">
                        <div className="space-y-2">
                          <Label>SMTP Host</Label>
                          <Input
                            defaultValue={settings?.emailSmtpHost || ""}
                            onBlur={(e) => updateSettingsMutation.mutate({ emailSmtpHost: e.target.value })}
                            placeholder="smtp.example.com"
                            data-testid="input-smtp-host"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>SMTP Port</Label>
                          <Input
                            type="number"
                            defaultValue={settings?.emailSmtpPort || 587}
                            onBlur={(e) => updateSettingsMutation.mutate({ emailSmtpPort: Number(e.target.value) })}
                            data-testid="input-smtp-port"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Address</Label>
                          <Input
                            defaultValue={settings?.emailFromAddress || ""}
                            onBlur={(e) => updateSettingsMutation.mutate({ emailFromAddress: e.target.value })}
                            placeholder="noreply@example.com"
                            data-testid="input-from-address"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>From Name</Label>
                          <Input
                            defaultValue={settings?.emailFromName || ""}
                            onBlur={(e) => updateSettingsMutation.mutate({ emailFromName: e.target.value })}
                            placeholder="PanelX"
                            data-testid="input-from-name"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className="w-5 h-5" />
                        <Label className="text-lg">Telegram</Label>
                      </div>
                      <Switch
                        checked={settings?.telegramEnabled || false}
                        onCheckedChange={(c) => updateSettingsMutation.mutate({ telegramEnabled: c })}
                        data-testid="switch-telegram-enabled"
                      />
                    </div>
                    {settings?.telegramEnabled && (
                      <div className="grid grid-cols-2 gap-4 pl-7">
                        <div className="space-y-2">
                          <Label>Bot Token</Label>
                          <Input
                            type="password"
                            defaultValue={settings?.telegramBotToken || ""}
                            onBlur={(e) => updateSettingsMutation.mutate({ telegramBotToken: e.target.value })}
                            placeholder="123456789:ABC..."
                            data-testid="input-telegram-token"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Chat ID</Label>
                          <Input
                            defaultValue={settings?.telegramChatId || ""}
                            onBlur={(e) => updateSettingsMutation.mutate({ telegramChatId: e.target.value })}
                            placeholder="-1001234567890"
                            data-testid="input-telegram-chat"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        <Label className="text-lg">Discord</Label>
                      </div>
                      <Switch
                        checked={settings?.discordEnabled || false}
                        onCheckedChange={(c) => updateSettingsMutation.mutate({ discordEnabled: c })}
                        data-testid="switch-discord-enabled"
                      />
                    </div>
                    {settings?.discordEnabled && (
                      <div className="pl-7 space-y-2">
                        <Label>Webhook URL</Label>
                        <Input
                          type="password"
                          defaultValue={settings?.discordWebhookUrl || ""}
                          onBlur={(e) => updateSettingsMutation.mutate({ discordWebhookUrl: e.target.value })}
                          placeholder="https://discord.com/api/webhooks/..."
                          data-testid="input-discord-webhook"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        <Label className="text-lg">Slack</Label>
                      </div>
                      <Switch
                        checked={settings?.slackEnabled || false}
                        onCheckedChange={(c) => updateSettingsMutation.mutate({ slackEnabled: c })}
                        data-testid="switch-slack-enabled"
                      />
                    </div>
                    {settings?.slackEnabled && (
                      <div className="pl-7 space-y-2">
                        <Label>Webhook URL</Label>
                        <Input
                          type="password"
                          defaultValue={settings?.slackWebhookUrl || ""}
                          onBlur={(e) => updateSettingsMutation.mutate({ slackWebhookUrl: e.target.value })}
                          placeholder="https://hooks.slack.com/services/..."
                          data-testid="input-slack-webhook"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSettingsDialogOpen(false)} data-testid="button-close">
                    Close
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-notifications">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total">{stats?.totalNotifications || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.activeTriggers || 0} active triggers
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-sent">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Sent</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-sent">{stats?.sent || 0}</div>
              <p className="text-xs text-muted-foreground">
                Successfully delivered
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-failed">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-failed">{stats?.failed || 0}</div>
              <p className="text-xs text-muted-foreground">
                Delivery errors
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-channels">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">By Channel</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {settings?.emailEnabled && <Badge variant="outline"><Mail className="w-3 h-3 mr-1" /> {stats?.byChannel?.email || 0}</Badge>}
                {settings?.telegramEnabled && <Badge variant="outline"><Send className="w-3 h-3 mr-1" /> {stats?.byChannel?.telegram || 0}</Badge>}
                {settings?.discordEnabled && <Badge variant="outline"><MessageSquare className="w-3 h-3 mr-1" /> {stats?.byChannel?.discord || 0}</Badge>}
                {settings?.slackEnabled && <Badge variant="outline"><MessageSquare className="w-3 h-3 mr-1" /> {stats?.byChannel?.slack || 0}</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="triggers" className="space-y-4">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="triggers" data-testid="tab-triggers">Triggers</TabsTrigger>
            <TabsTrigger value="log" data-testid="tab-log">Notification Log</TabsTrigger>
          </TabsList>

          <TabsContent value="triggers" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Notification Triggers</CardTitle>
                  <CardDescription>Configure when notifications are sent</CardDescription>
                </div>
                <Dialog open={triggerDialogOpen} onOpenChange={setTriggerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-trigger">
                      <Plus className="w-4 h-4 mr-2" /> Add Trigger
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Notification Trigger</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Trigger Name</Label>
                        <Input
                          value={newTrigger.name}
                          onChange={(e) => setNewTrigger({ ...newTrigger, name: e.target.value })}
                          placeholder="e.g., Stream Offline Alert"
                          data-testid="input-trigger-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Event Type</Label>
                        <Select value={newTrigger.eventType} onValueChange={(v) => setNewTrigger({ ...newTrigger, eventType: v })}>
                          <SelectTrigger data-testid="select-event-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="stream_offline">Stream Offline</SelectItem>
                            <SelectItem value="stream_error">Stream Error</SelectItem>
                            <SelectItem value="server_down">Server Down</SelectItem>
                            <SelectItem value="high_cpu">High CPU Usage</SelectItem>
                            <SelectItem value="high_memory">High Memory Usage</SelectItem>
                            <SelectItem value="line_expired">Line Expired</SelectItem>
                            <SelectItem value="line_expiring">Line Expiring Soon</SelectItem>
                            <SelectItem value="new_user">New User Registration</SelectItem>
                            <SelectItem value="backup_complete">Backup Complete</SelectItem>
                            <SelectItem value="backup_failed">Backup Failed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Channels</Label>
                        <div className="flex flex-wrap gap-2">
                          {["email", "telegram", "discord", "slack"].map((channel) => (
                            <Badge
                              key={channel}
                              variant={newTrigger.channels.includes(channel) ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => {
                                if (newTrigger.channels.includes(channel)) {
                                  setNewTrigger({ ...newTrigger, channels: newTrigger.channels.filter(c => c !== channel) });
                                } else {
                                  setNewTrigger({ ...newTrigger, channels: [...newTrigger.channels, channel] });
                                }
                              }}
                              data-testid={`badge-channel-${channel}`}
                            >
                              {getChannelIcon(channel)}
                              <span className="ml-1 capitalize">{channel}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Cooldown (minutes)</Label>
                        <Input
                          type="number"
                          value={newTrigger.cooldownMinutes}
                          onChange={(e) => setNewTrigger({ ...newTrigger, cooldownMinutes: Number(e.target.value) })}
                          data-testid="input-cooldown"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Message Template (optional)</Label>
                        <Textarea
                          value={newTrigger.messageTemplate}
                          onChange={(e) => setNewTrigger({ ...newTrigger, messageTemplate: e.target.value })}
                          placeholder="Use {{stream_name}}, {{server_name}}, etc."
                          data-testid="input-template"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={newTrigger.enabled}
                          onCheckedChange={(c) => setNewTrigger({ ...newTrigger, enabled: c })}
                          data-testid="switch-trigger-enabled"
                        />
                        <Label>Enabled</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setTriggerDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createTriggerMutation.mutate(newTrigger)}
                        disabled={!newTrigger.name || newTrigger.channels.length === 0 || createTriggerMutation.isPending}
                        data-testid="button-save-trigger"
                      >
                        {createTriggerMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Trigger
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {triggers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No notification triggers configured</p>
                ) : (
                  <div className="space-y-4">
                    {triggers.map((trigger) => (
                      <div key={trigger.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`trigger-${trigger.id}`}>
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={trigger.enabled}
                            onCheckedChange={(c) => toggleTriggerMutation.mutate({ id: trigger.id, enabled: c })}
                            data-testid={`switch-trigger-${trigger.id}`}
                          />
                          <div>
                            <p className="font-medium">{trigger.name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline">{trigger.eventType.replace(/_/g, " ")}</Badge>
                              <span>|</span>
                              <span>Cooldown: {trigger.cooldownMinutes}min</span>
                            </div>
                            <div className="flex gap-1 mt-1">
                              {trigger.channels?.map((channel) => (
                                <Badge key={channel} variant="secondary" className="text-xs">
                                  {getChannelIcon(channel)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteTriggerMutation.mutate(trigger.id)}
                          disabled={deleteTriggerMutation.isPending}
                          data-testid={`button-delete-trigger-${trigger.id}`}
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

          <TabsContent value="log" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Log</CardTitle>
                <CardDescription>History of sent notifications</CardDescription>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No notifications sent yet</p>
                ) : (
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-4 p-4 border rounded-lg" data-testid={`log-${log.id}`}>
                        <div className="mt-1">{getChannelIcon(log.channel)}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{log.triggerName}</span>
                            {getStatusBadge(log.status)}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{log.message}</p>
                          {log.errorMessage && (
                            <p className="text-sm text-red-500 mt-1">{log.errorMessage}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(log.createdAt).toLocaleString()}
                            {log.sentAt && ` | Sent: ${new Date(log.sentAt).toLocaleString()}`}
                          </p>
                        </div>
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
