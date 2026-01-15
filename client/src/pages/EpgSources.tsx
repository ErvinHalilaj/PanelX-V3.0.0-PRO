import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CalendarClock, Plus, Trash2, RefreshCw, ExternalLink } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { EpgSource } from "@shared/schema";

export default function EpgSources() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    sourceName: "",
    sourceUrl: "",
    updateInterval: 24,
    enabled: true,
  });

  const { data: sources = [], isLoading } = useQuery<EpgSource[]>({
    queryKey: ["/api/epg-sources"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/epg-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg-sources"] });
      setIsOpen(false);
      setFormData({ sourceName: "", sourceUrl: "", updateInterval: 24, enabled: true });
      toast({ title: "EPG source added successfully" });
    },
    onError: () => toast({ title: "Failed to add EPG source", variant: "destructive" }),
  });

  const refreshMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/epg-sources/${id}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg-sources"] });
      toast({ title: "EPG refresh initiated" });
    },
    onError: () => toast({ title: "Failed to refresh EPG", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/epg-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg-sources"] });
      toast({ title: "EPG source deleted" });
    },
  });

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <CalendarClock className="w-8 h-8 text-primary" />
              EPG Sources
            </h1>
            <p className="text-muted-foreground mt-1">Manage XMLTV program guide sources</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-epg-source">
                <Plus className="w-4 h-4" /> Add EPG Source
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add EPG Source</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Name</Label>
                  <Input value={formData.sourceName} onChange={(e) => setFormData({ ...formData, sourceName: e.target.value })} placeholder="EPG Provider" required data-testid="input-epg-name" />
                </div>
                <div className="space-y-2">
                  <Label>XMLTV URL</Label>
                  <Input value={formData.sourceUrl} onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })} placeholder="https://example.com/epg.xml" required data-testid="input-epg-url" />
                </div>
                <div className="space-y-2">
                  <Label>Update Interval (hours)</Label>
                  <Input type="number" value={formData.updateInterval} onChange={(e) => setFormData({ ...formData, updateInterval: parseInt(e.target.value) || 24 })} data-testid="input-update-interval" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.enabled} onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })} data-testid="switch-enabled" />
                  <Label>Enabled</Label>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-epg">
                  {createMutation.isPending ? "Adding..." : "Add EPG Source"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Program Guide Sources</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10">Loading...</div>
            ) : sources.length === 0 ? (
              <div className="text-center py-10">
                <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No EPG sources configured</p>
                <p className="text-sm text-muted-foreground mt-1">Add XMLTV sources for electronic program guides</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sources.map((source) => (
                    <TableRow key={source.id} data-testid={`row-epg-source-${source.id}`}>
                      <TableCell className="font-medium">{source.sourceName}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary">
                          {source.sourceUrl.substring(0, 40)}...
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={source.enabled ? "default" : "secondary"}>
                          {source.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>{source.lastUpdate ? format(new Date(source.lastUpdate), "PPp") : "Never"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => refreshMutation.mutate(source.id)} disabled={refreshMutation.isPending} data-testid={`button-refresh-epg-${source.id}`}>
                          <RefreshCw className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(source.id)} className="text-destructive" data-testid={`button-delete-epg-${source.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
