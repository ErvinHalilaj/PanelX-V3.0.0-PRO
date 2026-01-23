import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Clock, 
  Calendar, 
  Loader2,
  Plus,
  Trash2,
  Power,
  StopCircle
} from "lucide-react";
import {
  useSchedules,
  useCreateSchedule,
  useDeleteSchedule,
  useUpdateSchedule,
  type StreamSchedule
} from "@/hooks/use-schedules";
import { formatDistanceToNow } from "date-fns";

export default function Schedules() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedStream, setSelectedStream] = useState<number>(1);
  const [formData, setFormData] = useState<Partial<StreamSchedule>>({
    scheduleType: 'daily',
    action: 'both',
    timezone: 'UTC',
    enabled: true,
    daysOfWeek: [],
  });

  const { data, isLoading } = useSchedules();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const updateSchedule = useUpdateSchedule();

  const handleCreate = () => {
    createSchedule.mutate(
      { streamId: selectedStream, schedule: formData },
      {
        onSuccess: () => {
          setIsCreateOpen(false);
          setFormData({
            scheduleType: 'daily',
            action: 'both',
            timezone: 'UTC',
            enabled: true,
            daysOfWeek: [],
          });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this schedule?")) {
      deleteSchedule.mutate(id);
    }
  };

  const handleToggleEnabled = (schedule: StreamSchedule) => {
    updateSchedule.mutate({
      id: schedule.id,
      updates: { enabled: !schedule.enabled }
    });
  };

  const getDaysOfWeekDisplay = (days: number[] = []): string => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (days.length === 0) return 'Every day';
    if (days.length === 7) return 'Every day';
    return days.map(d => dayNames[d]).join(', ');
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'start':
        return 'bg-green-500/20 text-green-500 border-green-500/30';
      case 'stop':
        return 'bg-red-500/20 text-red-500 border-red-500/30';
      case 'both':
        return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-500 border-gray-500/30';
    }
  };

  return (
    <Layout 
      title="Stream Schedules" 
      subtitle="Manage automatic start/stop schedules for streams"
      actions={
        <Button onClick={() => setIsCreateOpen(true)} className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Add Schedule
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Calendar className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : data?.schedules.length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Power className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enabled</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : data?.schedules.filter(s => s.enabled).length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : data?.schedules.filter(s => s.scheduleType === 'daily').length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-purple-500/10">
                <Calendar className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weekly</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : data?.schedules.filter(s => s.scheduleType === 'weekly').length || 0}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Schedules List */}
        <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Active Schedules
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading schedules...
            </div>
          ) : !data?.schedules.length ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Schedules</h4>
              <p className="text-muted-foreground mb-4">
                Create your first schedule to automate stream start/stop times
              </p>
              <Button onClick={() => setIsCreateOpen(true)} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {data.schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Action Badge */}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getActionColor(schedule.action)}`}>
                      {schedule.action === 'start' && <Power className="w-3 h-3" />}
                      {schedule.action === 'stop' && <StopCircle className="w-3 h-3" />}
                      {schedule.action === 'both' && <Clock className="w-3 h-3" />}
                      <span className="text-xs font-medium uppercase">
                        {schedule.action}
                      </span>
                    </div>

                    {/* Schedule Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          Stream #{schedule.streamId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          •
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {schedule.scheduleType}
                        </span>
                        {!schedule.enabled && (
                          <Badge variant="outline" className="bg-gray-500/20 text-gray-500 border-gray-500/30">
                            Disabled
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {schedule.startTime && (
                          <span>Start: {schedule.startTime}</span>
                        )}
                        {schedule.stopTime && (
                          <span>Stop: {schedule.stopTime}</span>
                        )}
                        {schedule.scheduleType === 'weekly' && (
                          <span>{getDaysOfWeekDisplay(schedule.daysOfWeek)}</span>
                        )}
                        <span>TZ: {schedule.timezone}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleEnabled(schedule)}
                      disabled={updateSchedule.isPending}
                    >
                      {schedule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(schedule.id)}
                      disabled={deleteSchedule.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Create Schedule Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create Schedule</DialogTitle>
              <DialogDescription>
                Set up automatic start/stop times for a stream
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label>Stream ID</Label>
                <Input
                  type="number"
                  value={selectedStream}
                  onChange={(e) => setSelectedStream(Number(e.target.value))}
                  placeholder="Enter stream ID"
                />
              </div>

              <div>
                <Label>Schedule Type</Label>
                <Select
                  value={formData.scheduleType}
                  onValueChange={(value: any) => setFormData({ ...formData, scheduleType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Action</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value: any) => setFormData({ ...formData, action: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="start">Start Only</SelectItem>
                    <SelectItem value="stop">Stop Only</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.action === 'start' || formData.action === 'both') && (
                <div>
                  <Label>Start Time (24h format)</Label>
                  <Input
                    type="time"
                    value={formData.startTime || ''}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
              )}

              {(formData.action === 'stop' || formData.action === 'both') && (
                <div>
                  <Label>Stop Time (24h format)</Label>
                  <Input
                    type="time"
                    value={formData.stopTime || ''}
                    onChange={(e) => setFormData({ ...formData, stopTime: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label>Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createSchedule.isPending}
                  className="btn-primary"
                >
                  {createSchedule.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Schedule'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
