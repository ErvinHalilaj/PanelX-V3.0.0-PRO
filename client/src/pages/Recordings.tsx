import { Layout } from "@/components/Layout";
import { useRecordings, useDeleteRecording, useStopRecording, useStorageUsage } from "@/hooks/use-recordings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Video, Trash2, StopCircle, Clock, HardDrive, Film, Calendar, AlertCircle, Play, Download } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export default function Recordings() {
  const { data: recordings, isLoading } = useRecordings();
  const { data: storageUsage } = useStorageUsage();
  const deleteRecording = useDeleteRecording();
  const stopRecording = useStopRecording();

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this recording? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteRecording.mutateAsync(id);
      toast({ title: "Success", description: "Recording deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete recording", variant: "destructive" });
    }
  };

  const handleStop = async (id: number) => {
    try {
      await stopRecording.mutateAsync(id);
      toast({ title: "Success", description: "Recording stopped" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to stop recording", variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'recording':
        return <Badge className="bg-red-500 text-white animate-pulse">Recording</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 text-white">Completed</Badge>;
      case 'error':
        return <Badge className="bg-orange-500 text-white">Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const activeRecordings = recordings?.filter(r => r.status === 'recording') || [];
  const completedRecordings = recordings?.filter(r => r.status === 'completed') || [];
  const errorRecordings = recordings?.filter(r => r.status === 'error') || [];

  // Calculate storage percentage (assuming 100GB limit)
  const storageLimit = 100 * 1024 * 1024 * 1024; // 100GB in bytes
  const storagePercentage = storageUsage ? (storageUsage.storageUsed / storageLimit) * 100 : 0;

  return (
    <Layout title="Recordings">
      {/* Storage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Recordings</p>
                <p className="text-2xl font-bold text-white">{activeRecordings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Film className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-white">{completedRecordings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <HardDrive className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Storage Used</p>
                <p className="text-lg font-bold text-white">
                  {storageUsage ? `${storageUsage.storageUsedGB} GB` : '0 GB'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-white">{errorRecordings.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Usage Bar */}
      {storageUsage && (
        <Card className="bg-card/40 border-white/5 mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-white">Storage Usage</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {storageUsage.storageUsedGB} GB / 100 GB
              </span>
            </div>
            <Progress 
              value={storagePercentage} 
              className="h-3"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {storagePercentage.toFixed(1)}% used • {(100 - storagePercentage).toFixed(1)}% available
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recordings List */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            All Recordings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading recordings...</div>
          ) : !recordings || recordings.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                <Video className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-white">No recordings yet</h3>
              <p className="text-sm text-muted-foreground">Start recording streams from the Streams page</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div 
                  key={recording.id} 
                  className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                        <Film className="w-6 h-6 text-blue-500" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white truncate">
                            Recording #{recording.id}
                          </h4>
                          {getStatusBadge(recording.status)}
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            Stream #{recording.streamId}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(recording.startTime), 'MMM dd, yyyy HH:mm')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(recording.startTime), { addSuffix: true })}
                          </span>
                          {recording.fileSize > 0 && (
                            <span className="flex items-center gap-1">
                              <HardDrive className="w-3 h-3" />
                              {formatFileSize(recording.fileSize)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {recording.status === 'recording' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleStop(recording.id)}
                          disabled={stopRecording.isPending}
                          className="gap-1"
                        >
                          <StopCircle className="w-4 h-4" />
                          Stop
                        </Button>
                      ) : recording.status === 'completed' ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled
                          >
                            <Play className="w-4 h-4" />
                            Play
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1"
                            disabled
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </>
                      ) : null}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(recording.id)}
                        disabled={deleteRecording.isPending}
                        className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
