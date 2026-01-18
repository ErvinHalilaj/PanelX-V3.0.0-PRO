import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Play, Trash2, RefreshCw, Loader2, Calendar, Timer } from "lucide-react";
import { format } from "date-fns";
import type { CronJob } from "@shared/schema";

export default function CronJobs() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newJob, setNewJob] = useState({
    jobName: "",
    description: "",
    intervalMinutes: 60,
    enabled: true
  });

  const { data: jobs = [], isLoading } = useQuery<CronJob[]>({
    queryKey: ["/api/cron-jobs"],
    refetchInterval: 5000,
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: typeof newJob) => {
      return apiRequest("POST", "/api/cron-jobs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cron-jobs"] });
      setIsCreateOpen(false);
      setNewJob({ jobName: "", description: "", intervalMinutes: 60, enabled: true });
      toast({ title: "Job created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const runJobMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/cron-jobs/${id}/run`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cron-jobs"] });
      toast({ title: "Job started" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleJobMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return apiRequest("PUT", `/api/cron-jobs/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cron-jobs"] });
    }
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/cron-jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cron-jobs"] });
      toast({ title: "Job deleted" });
    }
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "running":
        return <Badge className="bg-blue-600 text-white"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Idle</Badge>;
    }
  };

  const formatInterval = (minutes: number | null) => {
    if (!minutes) return "-";
    if (minutes < 60) return `${minutes}m`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
    return `${Math.floor(minutes / 1440)}d`;
  };

  return (
    <Layout 
      title="Scheduled Tasks"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-job">
              <Plus className="w-4 h-4" /> Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create Scheduled Task</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Job Name</Label>
                <Input
                  data-testid="input-job-name"
                  value={newJob.jobName}
                  onChange={(e) => setNewJob({ ...newJob, jobName: e.target.value })}
                  placeholder="e.g., EPG Update"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  data-testid="input-job-description"
                  value={newJob.description}
                  onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                  placeholder="What does this task do?"
                />
              </div>
              <div className="space-y-2">
                <Label>Interval (minutes)</Label>
                <Input
                  data-testid="input-job-interval"
                  type="number"
                  value={newJob.intervalMinutes}
                  onChange={(e) => setNewJob({ ...newJob, intervalMinutes: parseInt(e.target.value) })}
                  min={1}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  data-testid="switch-job-enabled"
                  checked={newJob.enabled}
                  onCheckedChange={(checked) => setNewJob({ ...newJob, enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={() => createJobMutation.mutate(newJob)}
                disabled={createJobMutation.isPending || !newJob.jobName}
                className="w-full"
                data-testid="button-submit-job"
              >
                {createJobMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Task
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Tasks</p>
              <p className="text-lg font-bold">{jobs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
              <Timer className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-lg font-bold">{jobs.filter(j => j.enabled).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10">
              <RefreshCw className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Running</p>
              <p className="text-lg font-bold">{jobs.filter(j => j.status === "running").length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Scheduled Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tasks...</div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No scheduled tasks</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                    <TableCell className="font-medium">{job.jobName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{job.description || "-"}</TableCell>
                    <TableCell>{formatInterval(job.intervalMinutes)}</TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {job.lastRun ? format(new Date(job.lastRun), "MMM dd, HH:mm") : "Never"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {job.nextRun ? format(new Date(job.nextRun), "MMM dd, HH:mm") : "-"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={job.enabled ?? false}
                        onCheckedChange={(checked) => toggleJobMutation.mutate({ id: job.id, enabled: checked })}
                        data-testid={`switch-job-${job.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => runJobMutation.mutate(job.id)}
                          disabled={job.status === "running"}
                          data-testid={`button-run-job-${job.id}`}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this task?")) {
                              deleteJobMutation.mutate(job.id);
                            }
                          }}
                          data-testid={`button-delete-job-${job.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
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
    </Layout>
  );
}
