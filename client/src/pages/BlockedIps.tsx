import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Ban, Plus, Trash2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import type { BlockedIp } from "@shared/schema";

export default function BlockedIps() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    ipAddress: "",
    reason: "",
    expiresAt: "",
  });

  const { data: blockedIps = [], isLoading } = useQuery<BlockedIp[]>({
    queryKey: ["/api/blocked-ips"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { ipAddress: string; reason: string; expiresAt?: string }) => 
      apiRequest("/api/blocked-ips", { 
        method: "POST", 
        body: JSON.stringify({
          ...data,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-ips"] });
      setIsOpen(false);
      setFormData({ ipAddress: "", reason: "", expiresAt: "" });
      toast({ title: "IP blocked successfully" });
    },
    onError: () => toast({ title: "Failed to block IP", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/blocked-ips/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blocked-ips"] });
      toast({ title: "IP unblocked" });
    },
  });

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Ban className="w-8 h-8 text-destructive" />
              Blocked IPs
            </h1>
            <p className="text-muted-foreground mt-1">Manage IP address blocking and restrictions</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="destructive" data-testid="button-add-blocked-ip">
                <Plus className="w-4 h-4" /> Block IP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block IP Address</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>IP Address</Label>
                  <Input value={formData.ipAddress} onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })} placeholder="192.168.1.100" required data-testid="input-ip-address" />
                </div>
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Input value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} placeholder="Suspicious activity" data-testid="input-reason" />
                </div>
                <div className="space-y-2">
                  <Label>Expires At (optional)</Label>
                  <Input type="datetime-local" value={formData.expiresAt} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} data-testid="input-expires-at" />
                  <p className="text-xs text-muted-foreground">Leave empty for permanent block</p>
                </div>
                <Button type="submit" variant="destructive" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-block">
                  {createMutation.isPending ? "Blocking..." : "Block IP Address"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              Blocked IP Addresses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10">Loading...</div>
            ) : blockedIps.length === 0 ? (
              <div className="text-center py-10">
                <Ban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No blocked IP addresses</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked At</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIps.map((ip) => (
                    <TableRow key={ip.id} data-testid={`row-blocked-ip-${ip.id}`}>
                      <TableCell className="font-mono text-destructive">{ip.ipAddress}</TableCell>
                      <TableCell>{ip.reason || "-"}</TableCell>
                      <TableCell>{ip.createdAt ? format(new Date(ip.createdAt), "PPp") : "-"}</TableCell>
                      <TableCell>{ip.expiresAt ? format(new Date(ip.expiresAt), "PPp") : "Never"}</TableCell>
                      <TableCell>{ip.attemptsBlocked || 0}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(ip.id)} data-testid={`button-unblock-ip-${ip.id}`}>
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
