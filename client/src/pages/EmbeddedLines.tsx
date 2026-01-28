import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Code, Plus, Trash2, Edit2, Loader2, Copy, Eye, EyeOff, Shield, BarChart3, Globe } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface EmbeddedLine {
  id: number;
  lineId: number;
  embedToken: string;
  allowedDomains: string[];
  allowedIps: string[];
  enabled: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Line {
  id: number;
  username: string;
  expDate: string | null;
}

export default function EmbeddedLines() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmbed, setEditingEmbed] = useState<EmbeddedLine | null>(null);
  const [showToken, setShowToken] = useState<number | null>(null);
  const [viewingEmbed, setViewingEmbed] = useState<EmbeddedLine | null>(null);

  const { data: embeds = [], isLoading } = useQuery<EmbeddedLine[]>({
    queryKey: ["/api/embedded-lines"],
  });

  const { data: lines = [] } = useQuery<Line[]>({
    queryKey: ["/api/lines"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { lineId: number; allowedDomains?: string[]; allowedIps?: string[]; expiresAt?: string }) =>
      apiRequest("POST", "/api/embedded-lines", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/embedded-lines"] });
      setDialogOpen(false);
      toast({ title: "Embedded line created" });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to create embedded line", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EmbeddedLine> }) =>
      apiRequest("PUT", `/api/embedded-lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/embedded-lines"] });
      setDialogOpen(false);
      setEditingEmbed(null);
      toast({ title: "Embedded line updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/embedded-lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/embedded-lines"] });
      toast({ title: "Embedded line deleted" });
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const regenerateTokenMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/embedded-lines/${id}/regenerate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/embedded-lines"] });
      toast({ title: "Token regenerated" });
    },
    onError: () => toast({ title: "Failed to regenerate token", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const allowedDomains = (formData.get("allowedDomains") as string)
      .split("\n")
      .map(d => d.trim())
      .filter(Boolean);
    
    const allowedIps = (formData.get("allowedIps") as string)
      .split("\n")
      .map(ip => ip.trim())
      .filter(Boolean);
    
    const expiresAt = formData.get("expiresAt") as string || undefined;

    if (editingEmbed) {
      updateMutation.mutate({
        id: editingEmbed.id,
        data: {
          allowedDomains,
          allowedIps,
          enabled: formData.get("enabled") === "on",
          expiresAt: expiresAt || null,
        },
      });
    } else {
      const lineIdStr = formData.get("lineId") as string;
      const lineId = parseInt(lineIdStr);
      createMutation.mutate({
        lineId,
        allowedDomains,
        allowedIps,
        expiresAt,
      });
    }
  };

  const getLineName = (lineId: number) => {
    const line = lines.find(l => l.id === lineId);
    return line?.username || `Line #${lineId}`;
  };

  const copyEmbedUrl = (embed: EmbeddedLine) => {
    const url = `${window.location.origin}/api/embed/${embed.embedToken}/playlist.m3u8`;
    navigator.clipboard.writeText(url);
    toast({ title: "Embed URL copied to clipboard" });
  };

  const openEditDialog = (embed: EmbeddedLine) => {
    setEditingEmbed(embed);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingEmbed(null);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Layout title="Embedded Lines" subtitle="Manage embed tokens">
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Embedded Lines"
      subtitle="Create embed tokens for embedding players without exposing credentials"
    >
      <div className="space-y-6">
        <Alert>
          <Shield className="w-4 h-4" />
          <AlertDescription>
            Embedded lines allow you to embed streams in websites without exposing the username and password. 
            Use domain restrictions to limit where the embed can be used.
          </AlertDescription>
        </Alert>

        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} data-testid="button-add-embed">
                <Plus className="w-4 h-4 mr-2" />
                Create Embed Token
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingEmbed ? "Edit Embedded Line" : "Create Embedded Line"}</DialogTitle>
                <DialogDescription>
                  {editingEmbed ? "Update the embed configuration" : "Create a new embed token for a line"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!editingEmbed && (
                  <div className="space-y-2">
                    <Label htmlFor="lineId">Select Line</Label>
                    <Select name="lineId" required>
                      <SelectTrigger data-testid="select-line">
                        <SelectValue placeholder="Choose a line..." />
                      </SelectTrigger>
                      <SelectContent>
                        {lines.map((line) => (
                          <SelectItem key={line.id} value={line.id.toString()}>
                            {line.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="allowedDomains">Allowed Domains (one per line)</Label>
                  <Textarea
                    id="allowedDomains"
                    name="allowedDomains"
                    className="h-20"
                    defaultValue={editingEmbed?.allowedDomains?.join("\n") || ""}
                    placeholder="example.com&#10;*.mysite.com"
                    data-testid="input-allowed-domains"
                  />
                  <p className="text-xs text-muted-foreground">Use *.domain.com for wildcard subdomains. Leave empty to allow all domains.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allowedIps">Allowed IPs (one per line)</Label>
                  <Textarea
                    id="allowedIps"
                    name="allowedIps"
                    className="h-20"
                    defaultValue={editingEmbed?.allowedIps?.join("\n") || ""}
                    placeholder="1.2.3.4&#10;5.6.7.8"
                    data-testid="input-allowed-ips"
                  />
                  <p className="text-xs text-muted-foreground">Leave empty to allow all IPs</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
                  <Input
                    id="expiresAt"
                    name="expiresAt"
                    type="datetime-local"
                    defaultValue={editingEmbed?.expiresAt ? new Date(editingEmbed.expiresAt).toISOString().slice(0, 16) : ""}
                  />
                </div>
                {editingEmbed && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Enabled</Label>
                    <Switch id="enabled" name="enabled" defaultChecked={editingEmbed.enabled} />
                  </div>
                )}
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingEmbed ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {embeds.length === 0 ? (
          <Alert>
            <Code className="w-4 h-4" />
            <AlertDescription>No embedded lines yet. Create an embed token to get started.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {embeds.map((embed) => (
              <Card key={embed.id} className={!embed.enabled ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{getLineName(embed.lineId)}</CardTitle>
                    <Badge variant={embed.enabled ? "default" : "secondary"}>
                      {embed.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs flex items-center gap-1">
                    {showToken === embed.id ? embed.embedToken : "••••••••••••••••"}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowToken(showToken === embed.id ? null : embed.id)}
                      data-testid={`button-toggle-token-${embed.id}`}
                    >
                      {showToken === embed.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <BarChart3 className="w-4 h-4" />
                      {embed.viewCount} views
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Globe className="w-4 h-4" />
                      {embed.allowedDomains?.length || 0} domains
                    </div>
                  </div>
                  {embed.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Expires: {new Date(embed.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => copyEmbedUrl(embed)} data-testid={`button-copy-${embed.id}`}>
                      <Copy className="w-4 h-4 mr-1" />
                      Copy URL
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditDialog(embed)} data-testid={`button-edit-${embed.id}`}>
                      <Edit2 className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => regenerateTokenMutation.mutate(embed.id)}
                      disabled={regenerateTokenMutation.isPending}
                      data-testid={`button-regenerate-${embed.id}`}
                    >
                      Regenerate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(embed.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${embed.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
