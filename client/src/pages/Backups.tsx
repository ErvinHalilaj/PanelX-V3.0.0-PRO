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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, RotateCcw, Trash2, Database, Archive, Settings, Users, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Backup } from "@shared/schema";

export default function Backups() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [restoreBackupId, setRestoreBackupId] = useState<number | null>(null);
  const [newBackup, setNewBackup] = useState({
    backupName: "",
    description: "",
    backupType: "full"
  });

  const { data: backups = [], isLoading } = useQuery<Backup[]>({
    queryKey: ["/api/backups"]
  });

  const createBackupMutation = useMutation({
    mutationFn: async (data: typeof newBackup) => {
      return apiRequest("POST", "/api/backups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      setIsCreateOpen(false);
      setNewBackup({ backupName: "", description: "", backupType: "full" });
      toast({ title: "Backup created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/backups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "Backup deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const restoreBackupMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/backups/${id}/restore`);
    },
    onSuccess: () => {
      setRestoreBackupId(null);
      toast({ title: "Restore initiated", description: "The backup restoration has started." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600 text-white">Completed</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-600 text-white">In Progress</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "full":
        return <Database className="h-4 w-4" />;
      case "settings":
        return <Settings className="h-4 w-4" />;
      case "users":
        return <Users className="h-4 w-4" />;
      case "streams":
        return <Archive className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Backup Management</h1>
          <p className="text-muted-foreground">Create, manage, and restore system backups</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-backup">
              <Plus className="h-4 w-4 mr-2" />
              Create Backup
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Backup</DialogTitle>
              <DialogDescription>
                Create a backup of your system data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="backupName">Backup Name</Label>
                <Input
                  id="backupName"
                  data-testid="input-backup-name"
                  placeholder="My Backup"
                  value={newBackup.backupName}
                  onChange={(e) => setNewBackup({ ...newBackup, backupName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="backupType">Backup Type</Label>
                <Select
                  value={newBackup.backupType}
                  onValueChange={(value) => setNewBackup({ ...newBackup, backupType: value })}
                >
                  <SelectTrigger data-testid="select-backup-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Backup</SelectItem>
                    <SelectItem value="settings">Settings Only</SelectItem>
                    <SelectItem value="users">Users & Lines Only</SelectItem>
                    <SelectItem value="streams">Streams Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  data-testid="input-backup-description"
                  placeholder="Describe this backup..."
                  value={newBackup.description}
                  onChange={(e) => setNewBackup({ ...newBackup, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createBackupMutation.mutate(newBackup)} 
                disabled={createBackupMutation.isPending}
                data-testid="button-submit-backup"
              >
                {createBackupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Backup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
          <CardDescription>
            {backups.length} backup{backups.length !== 1 ? "s" : ""} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No backups yet</p>
              <p className="text-sm">Create your first backup to protect your data</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id} data-testid={`row-backup-${backup.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{backup.backupName}</p>
                        {backup.description && (
                          <p className="text-sm text-muted-foreground">{backup.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(backup.backupType || "full")}
                        <span className="capitalize">{backup.backupType || "full"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(backup.status || "pending")}</TableCell>
                    <TableCell>{formatFileSize(backup.fileSize || 0)}</TableCell>
                    <TableCell>
                      {backup.createdAt && format(new Date(backup.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={backup.status !== "completed"}
                          title="Download"
                          data-testid={`button-download-${backup.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Dialog 
                          open={restoreBackupId === backup.id} 
                          onOpenChange={(open) => setRestoreBackupId(open ? backup.id : null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={backup.status !== "completed"}
                              title="Restore"
                              data-testid={`button-restore-${backup.id}`}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Restore Backup</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to restore from "{backup.backupName}"? This will overwrite current data.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4">
                              <p className="text-sm text-muted-foreground">
                                Tables to restore: {(backup.includedTables as string[] || []).join(", ") || "All tables"}
                              </p>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setRestoreBackupId(null)}>Cancel</Button>
                              <Button 
                                variant="destructive"
                                onClick={() => restoreBackupMutation.mutate(backup.id)}
                                disabled={restoreBackupMutation.isPending}
                                data-testid="button-confirm-restore"
                              >
                                {restoreBackupMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                Restore Backup
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBackupMutation.mutate(backup.id)}
                          disabled={deleteBackupMutation.isPending}
                          title="Delete"
                          data-testid={`button-delete-${backup.id}`}
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
