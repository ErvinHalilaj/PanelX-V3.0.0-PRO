import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Server as ServerIcon, Plus, Trash2, Globe, Pencil } from "lucide-react";
import { useState } from "react";
import type { Server as ServerType } from "@shared/schema";

const defaultFormData = {
  serverName: "",
  serverUrl: "",
  serverPort: 80,
  rtmpPort: 1935,
  httpBroadcastPort: 25461,
  isMainServer: false,
  maxClients: 1000,
  enabled: true,
};

export default function Servers() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerType | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const { data: servers = [], isLoading } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/servers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setIsOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Server created successfully" });
    },
    onError: () => toast({ title: "Failed to create server", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof formData> }) => apiRequest("PUT", `/api/servers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setIsOpen(false);
      setEditingServer(null);
      setFormData(defaultFormData);
      toast({ title: "Server updated successfully" });
    },
    onError: () => toast({ title: "Failed to update server", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/servers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      toast({ title: "Server deleted" });
    },
  });

  const handleOpenEdit = (server: ServerType) => {
    setEditingServer(server);
    setFormData({
      serverName: server.serverName,
      serverUrl: server.serverUrl,
      serverPort: server.serverPort ?? 80,
      rtmpPort: server.rtmpPort ?? 1935,
      httpBroadcastPort: server.httpBroadcastPort ?? 25461,
      isMainServer: server.isMainServer ?? false,
      maxClients: server.maxClients ?? 1000,
      enabled: server.enabled ?? true,
    });
    setIsOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingServer) {
      updateMutation.mutate({ id: editingServer.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingServer(null);
      setFormData(defaultFormData);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <ServerIcon className="w-8 h-8 text-primary" />
              Servers
            </h1>
            <p className="text-muted-foreground mt-1">Manage streaming servers for load balancing</p>
          </div>
          <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-server">
                <Plus className="w-4 h-4" /> Add Server
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingServer ? "Edit Server" : "Add New Server"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Server Name</Label>
                  <Input value={formData.serverName} onChange={(e) => setFormData({ ...formData, serverName: e.target.value })} placeholder="Main Server" required data-testid="input-server-name" />
                </div>
                <div className="space-y-2">
                  <Label>Server URL</Label>
                  <Input value={formData.serverUrl} onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })} placeholder="streaming.example.com" required data-testid="input-server-url" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>HTTP Port</Label>
                    <Input type="number" value={formData.serverPort} onChange={(e) => setFormData({ ...formData, serverPort: parseInt(e.target.value) || 80 })} data-testid="input-server-port" />
                  </div>
                  <div className="space-y-2">
                    <Label>RTMP Port</Label>
                    <Input type="number" value={formData.rtmpPort} onChange={(e) => setFormData({ ...formData, rtmpPort: parseInt(e.target.value) || 1935 })} data-testid="input-rtmp-port" />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Clients</Label>
                    <Input type="number" value={formData.maxClients} onChange={(e) => setFormData({ ...formData, maxClients: parseInt(e.target.value) || 1000 })} data-testid="input-max-clients" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.isMainServer} onCheckedChange={(checked) => setFormData({ ...formData, isMainServer: checked })} data-testid="switch-main-server" />
                    <Label>Main Server</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.enabled} onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })} data-testid="switch-enabled" />
                    <Label>Enabled</Label>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-server">
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (editingServer ? "Update Server" : "Create Server")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-10">Loading...</div>
        ) : servers.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-10 text-center">
              <ServerIcon className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No servers configured yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add servers to enable load balancing</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => (
              <Card key={server.id} className="bg-card/50 border-border/50" data-testid={`card-server-${server.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    {server.serverName}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {server.isMainServer && <Badge variant="secondary">Main</Badge>}
                    <Badge variant={server.enabled ? "default" : "outline"}>
                      {server.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{server.serverUrl}:{server.serverPort}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Max: {server.maxClients} clients</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenEdit(server)} data-testid={`button-edit-server-${server.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(server.id)} className="text-destructive hover:text-destructive" data-testid={`button-delete-server-${server.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
