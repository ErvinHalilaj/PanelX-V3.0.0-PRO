import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Archive, Clock, Download, Upload, Play, Trash2, Plus, Loader2, Calendar, HardDrive, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

interface ScheduledBackup {
  id: number;
  name: string;
  enabled: boolean;
  schedule: string;
  backupType: string;
  retentionDays: number;
  includeDatabase: boolean;
  includeMedia: boolean;
  includeConfig: boolean;
  storageLocation: string;
  lastRun: string | null;
  lastStatus: string | null;
  nextRun: string | null;
  createdAt: string;
}

interface Backup {
  id: number;
  backupName: string;
  size: number;
  status: string;
  type: string;
  description: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function BackupRestore() {
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [newSchedule, setNewSchedule] = useState({
    name: "",
    enabled: true,
    schedule: "0 0 * * *",
    backupType: "full",
    retentionDays: 7,
    includeDatabase: true,
    includeMedia: false,
    includeConfig: true,
    storageLocation: "local",
  });

  const { data: schedules = [], isLoading: schedulesLoading } = useQuery<ScheduledBackup[]>({
    queryKey: ["/api/scheduled-backups"],
  });

  const { data: backups = [], isLoading: backupsLoading } = useQuery<Backup[]>({
    queryKey: ["/api/backups"],
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data: typeof newSchedule) => apiRequest("POST", "/api/scheduled-backups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-backups"] });
      setScheduleDialogOpen(false);
      setNewSchedule({
        name: "",
        enabled: true,
        schedule: "0 0 * * *",
        backupType: "full",
        retentionDays: 7,
        includeDatabase: true,
        includeMedia: false,
        includeConfig: true,
        storageLocation: "local",
      });
      toast({ title: "Backup schedule created" });
    },
    onError: () => toast({ title: "Failed to create schedule", variant: "destructive" }),
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/scheduled-backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-backups"] });
      toast({ title: "Schedule deleted" });
    },
    onError: () => toast({ title: "Failed to delete schedule", variant: "destructive" }),
  });

  const runScheduleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/scheduled-backups/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-backups"] });
      toast({ title: "Backup initiated" });
    },
    onError: () => toast({ title: "Failed to start backup", variant: "destructive" }),
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => 
      apiRequest("PUT", `/api/scheduled-backups/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-backups"] });
      toast({ title: "Schedule updated" });
    },
  });

  const createBackupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backups", { backupName: `manual_${Date.now()}`, type: "full" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "Backup created" });
    },
    onError: () => toast({ title: "Failed to create backup", variant: "destructive" }),
  });

  const restoreBackupMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/backups/${id}/restore`),
    onSuccess: () => {
      setRestoreDialogOpen(false);
      toast({ title: "Restore initiated" });
    },
    onError: () => toast({ title: "Restore failed", variant: "destructive" }),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "Backup deleted" });
    },
    onError: () => toast({ title: "Failed to delete backup", variant: "destructive" }),
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "running":
        return <Badge className="bg-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  const totalSize = backups.reduce((sum, b) => sum + (b.size || 0), 0);

  if (schedulesLoading || backupsLoading) {
    return (
      <Layout title="Backup & Restore" subtitle="Schedule automated backups">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Backup & Restore" subtitle="Schedule automated backups">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Backup & Restore</h1>
            <p className="text-muted-foreground">Schedule automated backups and restore from previous points</p>
          </div>
          <Button
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            data-testid="button-create-backup"
          >
            {createBackupMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Archive className="w-4 h-4 mr-2" />}
            Create Backup Now
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-backups">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
              <Archive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-backup-count">{backups.length}</div>
              <p className="text-xs text-muted-foreground">
                {formatSize(totalSize)} total
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-scheduled">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-schedule-count">{schedules.length}</div>
              <p className="text-xs text-muted-foreground">
                {schedules.filter(s => s.enabled).length} active
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-last-backup">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold" data-testid="text-last-backup">
                {backups.length > 0 
                  ? new Date(backups[0].createdAt).toLocaleDateString()
                  : "Never"}
              </div>
              <p className="text-xs text-muted-foreground">
                {backups.length > 0 ? backups[0].backupName : "No backups yet"}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-storage">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-storage-used">{formatSize(totalSize)}</div>
              <p className="text-xs text-muted-foreground">
                Across all backups
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="backups" className="space-y-4">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="backups" data-testid="tab-backups">Backups</TabsTrigger>
            <TabsTrigger value="schedules" data-testid="tab-schedules">Scheduled Jobs</TabsTrigger>
          </TabsList>

          <TabsContent value="backups" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Backup History</CardTitle>
                <CardDescription>View and restore from previous backups</CardDescription>
              </CardHeader>
              <CardContent>
                {backups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No backups found. Create your first backup to get started.</p>
                ) : (
                  <div className="space-y-4">
                    {backups.map((backup) => (
                      <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`backup-${backup.id}`}>
                        <div className="flex items-center gap-4">
                          <Archive className="w-8 h-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{backup.backupName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{new Date(backup.createdAt).toLocaleString()}</span>
                              <span>|</span>
                              <span>{formatSize(backup.size)}</span>
                              <span>|</span>
                              <Badge variant="outline">{backup.type}</Badge>
                            </div>
                            {backup.description && (
                              <p className="text-sm text-muted-foreground">{backup.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(backup.status)}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedBackup(backup);
                              setRestoreDialogOpen(true);
                            }}
                            disabled={backup.status !== "completed"}
                            data-testid={`button-restore-${backup.id}`}
                          >
                            <Upload className="w-4 h-4 mr-1" /> Restore
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteBackupMutation.mutate(backup.id)}
                            disabled={deleteBackupMutation.isPending}
                            data-testid={`button-delete-${backup.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Scheduled Backups</CardTitle>
                  <CardDescription>Automated backup jobs with retention policies</CardDescription>
                </div>
                <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-schedule">
                      <Plus className="w-4 h-4 mr-2" /> Add Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Backup Schedule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Schedule Name</Label>
                        <Input
                          value={newSchedule.name}
                          onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                          placeholder="e.g., Daily Database Backup"
                          data-testid="input-schedule-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cron Schedule</Label>
                        <Input
                          value={newSchedule.schedule}
                          onChange={(e) => setNewSchedule({ ...newSchedule, schedule: e.target.value })}
                          placeholder="0 0 * * * (midnight daily)"
                          data-testid="input-cron"
                        />
                        <p className="text-xs text-muted-foreground">Standard cron format: minute hour day month weekday</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Backup Type</Label>
                        <Select value={newSchedule.backupType} onValueChange={(v) => setNewSchedule({ ...newSchedule, backupType: v })}>
                          <SelectTrigger data-testid="select-backup-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">Full Backup</SelectItem>
                            <SelectItem value="incremental">Incremental</SelectItem>
                            <SelectItem value="database">Database Only</SelectItem>
                            <SelectItem value="config">Config Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Retention (days)</Label>
                        <Input
                          type="number"
                          value={newSchedule.retentionDays}
                          onChange={(e) => setNewSchedule({ ...newSchedule, retentionDays: Number(e.target.value) })}
                          data-testid="input-retention"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Storage Location</Label>
                        <Select value={newSchedule.storageLocation} onValueChange={(v) => setNewSchedule({ ...newSchedule, storageLocation: v })}>
                          <SelectTrigger data-testid="select-storage">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="local">Local Storage</SelectItem>
                            <SelectItem value="s3">Amazon S3</SelectItem>
                            <SelectItem value="ftp">FTP Server</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newSchedule.includeDatabase}
                            onCheckedChange={(c) => setNewSchedule({ ...newSchedule, includeDatabase: c })}
                            data-testid="switch-include-db"
                          />
                          <Label>Include Database</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newSchedule.includeConfig}
                            onCheckedChange={(c) => setNewSchedule({ ...newSchedule, includeConfig: c })}
                            data-testid="switch-include-config"
                          />
                          <Label>Include Configuration</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newSchedule.includeMedia}
                            onCheckedChange={(c) => setNewSchedule({ ...newSchedule, includeMedia: c })}
                            data-testid="switch-include-media"
                          />
                          <Label>Include Media Files</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={newSchedule.enabled}
                            onCheckedChange={(c) => setNewSchedule({ ...newSchedule, enabled: c })}
                            data-testid="switch-enabled"
                          />
                          <Label>Enabled</Label>
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createScheduleMutation.mutate(newSchedule)}
                        disabled={!newSchedule.name || createScheduleMutation.isPending}
                        data-testid="button-save-schedule"
                      >
                        {createScheduleMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Schedule
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {schedules.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No scheduled backups configured</p>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`schedule-${schedule.id}`}>
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={schedule.enabled}
                            onCheckedChange={(c) => toggleScheduleMutation.mutate({ id: schedule.id, enabled: c })}
                            data-testid={`switch-schedule-${schedule.id}`}
                          />
                          <div>
                            <p className="font-medium">{schedule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              Schedule: {schedule.schedule} | Type: {schedule.backupType} | Retention: {schedule.retentionDays} days
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Last run: {schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : "Never"}
                              {schedule.lastStatus && ` (${schedule.lastStatus})`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => runScheduleMutation.mutate(schedule.id)}
                            disabled={runScheduleMutation.isPending}
                            data-testid={`button-run-${schedule.id}`}
                          >
                            <Play className="w-4 h-4 mr-1" /> Run Now
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                            disabled={deleteScheduleMutation.isPending}
                            data-testid={`button-delete-schedule-${schedule.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                Confirm Restore
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Are you sure you want to restore from this backup?</p>
              {selectedBackup && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedBackup.backupName}</p>
                  <p className="text-sm text-muted-foreground">
                    Created: {new Date(selectedBackup.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Size: {formatSize(selectedBackup.size)}
                  </p>
                </div>
              )}
              <p className="text-sm text-destructive">
                Warning: This will overwrite current data. This action cannot be undone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRestoreDialogOpen(false)} data-testid="button-cancel-restore">
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedBackup && restoreBackupMutation.mutate(selectedBackup.id)}
                disabled={restoreBackupMutation.isPending}
                data-testid="button-confirm-restore"
              >
                {restoreBackupMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Restore
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
