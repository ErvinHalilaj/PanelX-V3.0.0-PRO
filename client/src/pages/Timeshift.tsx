import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Radio, 
  Loader2,
  Play,
  StopCircle,
  Activity,
  Calendar
} from "lucide-react";
import { useTimeshiftSessions, useStopTimeshift } from "@/hooks/use-timeshift";
import { formatDistanceToNow } from "date-fns";

export default function Timeshift() {
  const { data, isLoading } = useTimeshiftSessions();
  const stopTimeshift = useStopTimeshift();

  const handleStop = (streamId: number) => {
    if (confirm("Are you sure you want to stop timeshift for this stream?")) {
      stopTimeshift.mutate(streamId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/20 border-green-500/30';
      case 'buffering':
        return 'text-yellow-500 bg-yellow-500/20 border-yellow-500/30';
      case 'error':
        return 'text-red-500 bg-red-500/20 border-red-500/30';
      case 'stopped':
        return 'text-gray-500 bg-gray-500/20 border-gray-500/30';
      default:
        return 'text-blue-500 bg-blue-500/20 border-blue-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Radio className="w-3 h-3" />;
      case 'buffering':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'error':
        return <StopCircle className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <Layout 
      title="Timeshift & Catchup" 
      subtitle="Manage live stream buffering and time-shifting sessions"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Clock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold text-white" data-testid="text-active-sessions">
                  {isLoading ? "..." : data?.sessions.length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Radio className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Buffering</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : data?.sessions.filter(s => s.status === 'buffering').length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Segments</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : 
                    data?.sessions.reduce((sum, s) => sum + s.segmentCount, 0) || 0
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Active Sessions */}
        <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Active Timeshift Sessions
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading sessions...
            </div>
          ) : !data?.sessions.length ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Active Sessions</h4>
              <p className="text-muted-foreground">
                Enable timeshift on streams to start buffering and time-shifting
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.sessions.map((session) => (
                <div
                  key={session.streamId}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  data-testid={`session-${session.streamId}`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Status Badge */}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(session.status)}`}>
                      {getStatusIcon(session.status)}
                      <span className="text-xs font-medium uppercase">
                        {session.status}
                      </span>
                    </div>

                    {/* Stream Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">
                          Stream #{session.streamId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          •
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Started {formatDistanceToNow(new Date(session.startTime), { addSuffix: true })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          Position: <span className="text-white font-medium">{formatTime(session.currentPosition)}</span>
                        </span>
                        <span>•</span>
                        <span>
                          Segments: <span className="text-white font-medium">{session.segmentCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/streams?timeshift=${session.streamId}`}
                      data-testid={`button-view-${session.streamId}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStop(session.streamId)}
                      disabled={stopTimeshift.isPending}
                      data-testid={`button-stop-${session.streamId}`}
                    >
                      <StopCircle className="w-4 h-4 mr-2" />
                      Stop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Info Card */}
        <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4">About Timeshift & Catchup</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-white">Timeshift</strong> allows users to pause, rewind, and watch live streams from the beginning.
              The system automatically buffers live content for up to 2 hours.
            </p>
            <p>
              <strong className="text-white">Catchup</strong> enables viewers to watch previously aired content within the buffered timeframe.
              Use the timeline controls to seek to any position in the buffer.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <h4 className="text-white font-medium mb-1">🎯 Features</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Watch from start</li>
                  <li>• Time-based seeking</li>
                  <li>• Skip forward/backward (30s)</li>
                  <li>• Return to live</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <h4 className="text-white font-medium mb-1">⚙️ Technical</h4>
                <ul className="space-y-1 text-xs">
                  <li>• 10-second HLS segments</li>
                  <li>• 2-hour max buffer</li>
                  <li>• Auto-cleanup after 3 hours</li>
                  <li>• FFmpeg-based buffering</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
