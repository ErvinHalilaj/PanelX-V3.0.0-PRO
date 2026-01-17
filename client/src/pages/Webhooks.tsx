import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Webhook, Play, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import type { Webhook as WebhookType } from "@shared/schema";

const EVENT_OPTIONS = [
  { value: '*', label: 'All Events' },
  { value: 'line.created', label: 'Line Created' },
  { value: 'line.expired', label: 'Line Expired' },
  { value: 'line.deleted', label: 'Line Deleted' },
  { value: 'stream.offline', label: 'Stream Offline' },
  { value: 'stream.online', label: 'Stream Online' },
  { value: 'stream.created', label: 'Stream Created' },
  { value: 'connection.started', label: 'Connection Started' },
  { value: 'connection.ended', label: 'Connection Ended' },
  { value: 'user.created', label: 'User Created' },
  { value: 'ticket.created', label: 'Ticket Created' },
  { value: 'backup.completed', label: 'Backup Completed' },
];

export default function Webhooks() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [newWebhook, setNewWebhook] = useState({
    name: "",
    url: "",
    secret: "",
    events: [] as string[],
    enabled: true
  });

  const { data: webhooks = [], isLoading } = useQuery<WebhookType[]>({
    queryKey: ["/api/webhooks"]
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: typeof newWebhook) => {
      return apiRequest("POST", "/api/webhooks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      setIsCreateOpen(false);
      setNewWebhook({ name: "", url: "", secret: "", events: [], enabled: true });
      toast({ title: "Webhook created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/webhooks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
      toast({ title: "Webhook deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return apiRequest("PUT", `/api/webhooks/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/webhooks"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: number) => {
      setTestingId(id);
      const response = await apiRequest("POST", `/api/webhooks/${id}/test`);
      return response.json();
    },
    onSuccess: (data) => {
      setTestingId(null);
      if (data.success) {
        toast({ title: "Test successful", description: `Status: ${data.status}` });
      } else {
        toast({ title: "Test failed", description: data.error || `Status: ${data.status}`, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      setTestingId(null);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleEvent = (event: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  const getStatusBadge = (webhook: WebhookType) => {
    if (!webhook.lastStatus) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Never triggered</Badge>;
    }
    if (webhook.lastStatus >= 200 && webhook.lastStatus < 300) {
      return <Badge className="bg-green-600 text-white"><CheckCircle2 className="h-3 w-3 mr-1" />OK ({webhook.lastStatus})</Badge>;
    }
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Error ({webhook.lastStatus})</Badge>;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-muted-foreground">Configure external notifications for system events</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-webhook">
              <Plus className="h-4 w-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Webhook</DialogTitle>
              <DialogDescription>
                Configure an endpoint to receive event notifications
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  data-testid="input-webhook-name"
                  placeholder="My Webhook"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  data-testid="input-webhook-url"
                  placeholder="https://example.com/webhook"
                  value={newWebhook.url}
                  onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">Secret (Optional)</Label>
                <Input
                  id="secret"
                  data-testid="input-webhook-secret"
                  placeholder="For signing payloads"
                  value={newWebhook.secret}
                  onChange={(e) => setNewWebhook({ ...newWebhook, secret: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {EVENT_OPTIONS.map((event) => (
                    <label key={event.value} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-secondary">
                      <input
                        type="checkbox"
                        checked={newWebhook.events.includes(event.value)}
                        onChange={() => toggleEvent(event.value)}
                        className="rounded"
                      />
                      <span className="text-sm">{event.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createWebhookMutation.mutate(newWebhook)} 
                disabled={createWebhookMutation.isPending || !newWebhook.name || !newWebhook.url}
                data-testid="button-submit-webhook"
              >
                {createWebhookMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Webhooks</CardTitle>
          <CardDescription>
            {webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhooks configured</p>
              <p className="text-sm">Add a webhook to receive event notifications</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id} data-testid={`row-webhook-${webhook.id}`}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <code className="text-xs">{webhook.url}</code>
                    </TableCell>
                    <TableCell>
                      {(webhook.events as string[] || []).slice(0, 2).map((event) => (
                        <Badge key={event} variant="secondary" className="mr-1 text-xs">
                          {event}
                        </Badge>
                      ))}
                      {(webhook.events as string[] || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(webhook.events as string[] || []).length - 2}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(webhook)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.enabled ?? false}
                        onCheckedChange={(checked) => toggleWebhookMutation.mutate({ id: webhook.id, enabled: checked })}
                        data-testid={`switch-enabled-${webhook.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => testWebhookMutation.mutate(webhook.id)}
                          disabled={testingId === webhook.id}
                          title="Test webhook"
                          data-testid={`button-test-${webhook.id}`}
                        >
                          {testingId === webhook.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                          disabled={deleteWebhookMutation.isPending}
                          title="Delete"
                          data-testid={`button-delete-${webhook.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
