import { useState } from 'react';
import {
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useRestoreBackup,
  useVerifyBackup,
  useBackupStats,
  useBackupSchedules,
  useCreateBackupSchedule,
  useUpdateBackupSchedule,
  useDeleteBackupSchedule,
  useRestorePoints,
} from '@/hooks/use-backups';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Database, HardDrive, Clock, Download, Upload, Trash2, CheckCircle, XCircle, Plus, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BackupsManager() {
  const { toast } = useToast();
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    type: 'full' as const,
    frequency: 'daily' as const,
    time: '02:00',
    retention: 30,
    enabled: true,
  });

  // Fetch data
  const backups = useBackups();
  const stats = useBackupStats();
  const schedules = useBackupSchedules();
  const restorePoints = useRestorePoints();

  // Mutations
  const createBackup = useCreateBackup();
  const deleteBackup = useDeleteBackup();
  const restoreBackup = useRestoreBackup();
  const verifyBackup = useVerifyBackup();
  const createSchedule = useCreateBackupSchedule();
  const updateSchedule = useUpdateBackupSchedule();
  const deleteSchedule = useDeleteBackupSchedule();

  const handleCreateBackup = async (type: 'full' | 'incremental' | 'database' | 'files') => {
    try {
      await createBackup.mutateAsync(type);
      toast({ title: 'Success', description: `${type} backup started` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create backup', variant: 'destructive' });
    }
  };

  const handleDeleteBackup = async (id: string) => {
    if (!confirm('Delete this backup?')) return;
    try {
      await deleteBackup.mutateAsync(id);
      toast({ title: 'Success', description: 'Backup deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete backup', variant: 'destructive' });
    }
  };

  const handleRestoreBackup = async (id: string) => {
    if (!confirm('Restore from this backup? This will overwrite current data.')) return;
    try {
      await restoreBackup.mutateAsync({ id, verify: true });
      toast({ title: 'Success', description: 'Backup restored successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to restore backup', variant: 'destructive' });
    }
  };

  const handleVerifyBackup = async (id: string) => {
    try {
      const result = await verifyBackup.mutateAsync(id);
      toast({
        title: result.valid ? 'Valid' : 'Invalid',
        description: result.valid ? 'Backup is valid' : 'Backup verification failed',
        variant: result.valid ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to verify backup', variant: 'destructive' });
    }
  };

  const handleCreateSchedule = async () => {
    try {
      await createSchedule.mutateAsync(newSchedule);
      toast({ title: 'Success', description: 'Schedule created' });
      setScheduleDialogOpen(false);
      setNewSchedule({
        name: '',
        type: 'full',
        frequency: 'daily',
        time: '02:00',
        retention: 30,
        enabled: true,
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create schedule', variant: 'destructive' });
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-500">Completed</Badge>;
      case 'running': return <Badge className="bg-blue-500">Running</Badge>;
      case 'failed': return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            Automated Backups & Recovery
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage backups, schedules, and restore points
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleCreateBackup('full')} disabled={createBackup.isPending}>
            <Upload className="h-4 w-4 mr-2" />
            Full Backup
          </Button>
          <Button onClick={() => handleCreateBackup('database')} variant="outline" disabled={createBackup.isPending}>
            <Database className="h-4 w-4 mr-2" />
            Database Only
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Backups</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.data?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.data?.completed || 0} completed, {stats.data?.failed || 0} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatSize(stats.data?.totalSize || 0)}</div>
            <p className="text-xs text-muted-foreground">Across all backups</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Backup</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.data?.lastBackup
                ? new Date(stats.data.lastBackup).toLocaleDateString()
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.data?.lastBackup
                ? new Date(stats.data.lastBackup).toLocaleTimeString()
                : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.data?.nextScheduled
                ? new Date(stats.data.nextScheduled).toLocaleDateString()
                : 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.data?.nextScheduled
                ? new Date(stats.data.nextScheduled).toLocaleTimeString()
                : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="backups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="backups">Backups</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          <TabsTrigger value="restore">Restore Points</TabsTrigger>
        </TabsList>

        {/* Backups Tab */}
        <TabsContent value="backups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup History</CardTitle>
              <CardDescription>View and manage your backups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {backups.data?.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span className="font-medium capitalize">{backup.type} Backup</span>
                        {getStatusBadge(backup.status)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created: {new Date(backup.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Size: {formatSize(backup.size)} | ID: {backup.id}
                      </p>
                      {backup.error && (
                        <p className="text-xs text-red-500 mt-1">Error: {backup.error}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {backup.status === 'completed' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleVerifyBackup(backup.id)}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleRestoreBackup(backup.id)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteBackup(backup.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!backups.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No backups yet. Create one to get started.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedules Tab */}
        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backup Schedules</CardTitle>
              <CardDescription>Automate your backups</CardDescription>
              <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    New Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Backup Schedule</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={newSchedule.name}
                        onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                        placeholder="Daily Full Backup"
                      />
                    </div>
                    <div>
                      <Label>Backup Type</Label>
                      <Select
                        value={newSchedule.type}
                        onValueChange={(value: any) => setNewSchedule({ ...newSchedule, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="incremental">Incremental</SelectItem>
                          <SelectItem value="database">Database</SelectItem>
                          <SelectItem value="files">Files</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Frequency</Label>
                      <Select
                        value={newSchedule.frequency}
                        onValueChange={(value: any) => setNewSchedule({ ...newSchedule, frequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Time (HH:MM)</Label>
                      <Input
                        type="time"
                        value={newSchedule.time}
                        onChange={(e) => setNewSchedule({ ...newSchedule, time: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Retention (days)</Label>
                      <Input
                        type="number"
                        value={newSchedule.retention}
                        onChange={(e) => setNewSchedule({ ...newSchedule, retention: Number(e.target.value) })}
                      />
                    </div>
                    <Button onClick={handleCreateSchedule} className="w-full">
                      Create Schedule
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {schedules.data?.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">{schedule.name}</span>
                        <Badge variant={schedule.enabled ? 'default' : 'secondary'}>
                          {schedule.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {schedule.frequency} {schedule.type} backup at {schedule.time}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Retention: {schedule.retention} days
                        {schedule.nextRun && ` | Next: ${new Date(schedule.nextRun).toLocaleString()}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Switch
                        checked={schedule.enabled}
                        onCheckedChange={(checked) =>
                          updateSchedule.mutate({
                            id: schedule.id,
                            updates: { enabled: checked },
                          })
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this schedule?')) {
                            deleteSchedule.mutate(schedule.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!schedules.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No schedules configured yet.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Restore Points Tab */}
        <TabsContent value="restore" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restore Points</CardTitle>
              <CardDescription>Available restore points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {restorePoints.data?.map((point, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {point.verified ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                        <span className="font-medium">{point.description}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(point.timestamp).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Backup ID: {point.backupId}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleRestoreBackup(point.backupId)}>
                      <Download className="h-4 w-4 mr-2" />
                      Restore
                    </Button>
                  </div>
                ))}
                {!restorePoints.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No restore points available.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
