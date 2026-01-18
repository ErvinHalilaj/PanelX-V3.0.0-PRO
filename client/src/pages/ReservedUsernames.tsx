import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ShieldBan, Plus, Trash2, Save, Search } from "lucide-react";
import { format } from "date-fns";
import type { ReservedUsername } from "@shared/schema";

export default function ReservedUsernames() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    username: "",
    reason: "",
  });

  const { data: reserved = [], isLoading } = useQuery<ReservedUsername[]>({
    queryKey: ["/api/reserved-usernames"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/reserved-usernames", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reserved-usernames"] });
      toast({ title: "Username reserved successfully" });
      setIsDialogOpen(false);
      setFormData({ username: "", reason: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/reserved-usernames/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reserved-usernames"] });
      toast({ title: "Username removed from reserved list" });
    },
  });

  const filteredReserved = reserved.filter((r) =>
    r.username.toLowerCase().includes(search.toLowerCase()) ||
    (r.reason && r.reason.toLowerCase().includes(search.toLowerCase()))
  );

  if (isLoading) {
    return <div className="p-6">Loading reserved usernames...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldBan className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Reserved Usernames</h1>
            <p className="text-muted-foreground">Block usernames from being used</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-reserved">
              <Plus className="h-4 w-4 mr-2" />
              Reserve Username
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reserve Username</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Username</Label>
                <Input
                  data-testid="input-reserved-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username to reserve"
                />
              </div>
              <div>
                <Label>Reason (optional)</Label>
                <Textarea
                  data-testid="input-reserved-reason"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  placeholder="Why is this username reserved?"
                  rows={3}
                />
              </div>
              <Button
                onClick={() => createMutation.mutate(formData)}
                disabled={createMutation.isPending || !formData.username.trim()}
                className="w-full"
                data-testid="button-save-reserved"
              >
                <Save className="h-4 w-4 mr-2" />
                Reserve Username
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search reserved usernames..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reserved Usernames ({filteredReserved.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reserved At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredReserved.map((r) => (
                <TableRow key={r.id} data-testid={`reserved-row-${r.id}`}>
                  <TableCell className="font-mono font-medium">{r.username}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.reason || "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.createdAt ? format(new Date(r.createdAt), "MMM d, yyyy HH:mm") : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(r.id)}
                      data-testid={`button-delete-${r.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredReserved.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    {search ? "No matching reserved usernames" : "No reserved usernames yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Common Reserved Usernames</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Consider reserving these common usernames to prevent confusion:
          </p>
          <div className="flex flex-wrap gap-2">
            {["admin", "root", "system", "support", "test", "demo", "api", "www", "mail", "ftp"].map((name) => (
              <Button
                key={name}
                size="sm"
                variant="outline"
                onClick={() => {
                  setFormData({ username: name, reason: "System reserved" });
                  setIsDialogOpen(true);
                }}
                disabled={reserved.some((r) => r.username.toLowerCase() === name)}
                data-testid={`button-quick-reserve-${name}`}
              >
                {name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
