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
import { Server as ServerIcon, Plus, Trash2, Activity, Globe } from "lucide-react";
import { useState } from "react";
import type { Server as ServerType } from "@shared/schema";

export default function Servers() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    serverName: "",
    serverUrl: "",
    httpPort: 80,
    httpsPort: 443,
    rtmpPort: 1935,
    serverProtocol: "http",
    weight: 1,
    isMain: false,
    enabled: true,
  });

  const { data: servers = [], isLoading } = useQuery<ServerType[]>({
    queryKey: ["/api/servers"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("/api/servers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      setIsOpen(false);
      setFormData({ serverName: "", serverUrl: "", httpPort: 80, httpsPort: 443, rtmpPort: 1935, serverProtocol: "http", weight: 1, isMain: false, enabled: true });
      toast({ title: "Server created successfully" });
    },
    onError: () => toast({ title: "Failed to create server", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/servers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/servers"] });
      toast({ title: "Server deleted" });
    },
  });

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
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-server">
                <Plus className="w-4 h-4" /> Add Server
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Server</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
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
                    <Input type="number" value={formData.httpPort} onChange={(e) => setFormData({ ...formData, httpPort: parseInt(e.target.value) })} data-testid="input-http-port" />
                  </div>
                  <div className="space-y-2">
                    <Label>HTTPS Port</Label>
                    <Input type="number" value={formData.httpsPort} onChange={(e) => setFormData({ ...formData, httpsPort: parseInt(e.target.value) })} data-testid="input-https-port" />
                  </div>
                  <div className="space-y-2">
                    <Label>Weight</Label>
                    <Input type="number" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: parseInt(e.target.value) })} data-testid="input-weight" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.isMain} onCheckedChange={(checked) => setFormData({ ...formData, isMain: checked })} data-testid="switch-main-server" />
                    <Label>Main Server</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.enabled} onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })} data-testid="switch-enabled" />
                    <Label>Enabled</Label>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-server">
                  {createMutation.isPending ? "Creating..." : "Create Server"}
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
                    {server.isMain && <Badge variant="secondary">Main</Badge>}
                    <Badge variant={server.enabled ? "default" : "outline"}>
                      {server.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">{server.serverUrl}:{server.httpPort}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Weight: {server.weight}</span>
                      <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(server.id)} className="text-destructive hover:text-destructive" data-testid={`button-delete-server-${server.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
