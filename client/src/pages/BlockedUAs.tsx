import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { BlockedUserAgent } from "@shared/schema";

export default function BlockedUAs() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    userAgent: "",
    reason: "",
    exactMatch: false,
  });

  const { data: blockedUAs = [], isLoading } = useQuery<BlockedUserAgent[]>({
    queryKey: ["/api/blocked-user-agents"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("/api/blocked-user-agents", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-user-agents"] });
      setIsOpen(false);
      setFormData({ userAgent: "", reason: "", exactMatch: false });
      toast({ title: "User agent blocked successfully" });
    },
    onError: () => toast({ title: "Failed to block user agent", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/blocked-user-agents/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-user-agents"] });
      toast({ title: "User agent unblocked" });
    },
  });

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="w-8 h-8 text-orange-500" />
              Blocked User Agents
            </h1>
            <p className="text-muted-foreground mt-1">Block specific apps or devices from accessing streams</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="destructive" data-testid="button-add-blocked-ua">
                <Plus className="w-4 h-4" /> Block User Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block User Agent</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>User Agent String</Label>
                  <Input value={formData.userAgent} onChange={(e) => setFormData({ ...formData, userAgent: e.target.value })} placeholder="VLC/3.0.16 LibVLC" required data-testid="input-user-agent" />
                  <p className="text-xs text-muted-foreground">Enter the user agent string to block</p>
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Unauthorized client" data-testid="input-reason" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.exactMatch} onCheckedChange={(checked) => setFormData({ ...formData, exactMatch: checked })} data-testid="switch-exact-match" />
                  <Label>Exact match only</Label>
                </div>
                <p className="text-xs text-muted-foreground">If disabled, will block any user agent containing the string</p>
                <Button type="submit" variant="destructive" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-block">
                  {createMutation.isPending ? "Blocking..." : "Block User Agent"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Blocked User Agents</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10">Loading...</div>
            ) : blockedUAs.length === 0 ? (
              <div className="text-center py-10">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No blocked user agents</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User Agent</TableHead>
                    <TableHead>Match Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedUAs.map((ua) => (
                    <TableRow key={ua.id} data-testid={`row-blocked-ua-${ua.id}`}>
                      <TableCell className="font-mono max-w-xs truncate">{ua.userAgent}</TableCell>
                      <TableCell>
                        <Badge variant={ua.exactMatch ? "default" : "secondary"}>
                          {ua.exactMatch ? "Exact" : "Contains"}
                        </Badge>
                      </TableCell>
                      <TableCell>{ua.reason || "-"}</TableCell>
                      <TableCell>{ua.createdAt ? format(new Date(ua.createdAt), "PPp") : "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(ua.id)} data-testid={`button-unblock-ua-${ua.id}`}>
                          <Trash2 className="w-4 h-4 text-destructive" />
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
