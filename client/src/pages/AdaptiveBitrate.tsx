import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Wifi, 
  Loader2,
  Activity,
  Monitor,
  Play,
  StopCircle
} from "lucide-react";
import { useABRSessions, useStopABR } from "@/hooks/use-abr";

export default function AdaptiveBitrate() {
  const { data, isLoading } = useABRSessions();
  const stopABR = useStopABR();

  const handleStop = (streamId: number) => {
    if (confirm("Are you sure you want to stop adaptive bitrate streaming for this stream?")) {
      stopABR.mutate(streamId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-500 bg-green-500/20 border-green-500/30';
      case 'initializing':
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
        return <Wifi className="w-3 h-3" />;
      case 'initializing':
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case 'error':
        return <StopCircle className="w-3 h-3" />;
      default:
        return <Activity className="w-3 h-3" />;
    }
  };

  return (
    <Layout 
      title="Adaptive Bitrate (ABR)" 
      subtitle="Manage multi-quality streaming sessions"
    >
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Settings className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Sessions</p>
                <p className="text-2xl font-bold text-white" data-testid="text-active-abr-sessions">
                  {isLoading ? "..." : data?.sessions.length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <Wifi className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Streaming</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : data?.sessions.filter(s => s.status === 'active').length || 0}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Monitor className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Qualities</p>
                <p className="text-2xl font-bold text-white">
                  {isLoading ? "..." : 
                    data?.sessions.reduce((sum, s) => sum + s.variantCount, 0) || 0
                  }
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Active Sessions */}
        <Card className="p-6 bg-card/40 border-white/5 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Active ABR Sessions
          </h3>

          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading sessions...
            </div>
          ) : !data?.sessions.length ? (
            <div className="text-center py-12">
              <Settings className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-white mb-2">No Active Sessions</h4>
              <p className="text-muted-foreground">
                Enable adaptive bitrate streaming on streams to start multi-quality transcoding
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.sessions.map((session) => (
                <div
                  key={session.streamId}
                  className="flex items-center justify-between p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                  data-testid={`abr-session-${session.streamId}`}
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
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Monitor className="w-3 h-3" />
                          {session.variantCount} qualities
                        </span>
                      </div>
                    </div>

                    {/* Quality Badges */}
                    <div className="flex items-center gap-2">
                      {['1080p', '720p', '480p', '360p'].slice(0, session.variantCount).map((quality, index) => (
                        <Badge 
                          key={quality} 
                          variant="outline" 
                          className="bg-white/5 border-white/10"
                        >
                          {quality}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = `/streams?abr=${session.streamId}`}
                      data-testid={`button-view-abr-${session.streamId}`}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleStop(session.streamId)}
                      disabled={stopABR.isPending}
                      data-testid={`button-stop-abr-${session.streamId}`}
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
          <h3 className="text-lg font-semibold text-white mb-4">About Adaptive Bitrate Streaming</h3>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong className="text-white">Adaptive Bitrate (ABR)</strong> automatically adjusts video quality based on the viewer's network conditions, 
              providing the best possible experience across different devices and connection speeds.
            </p>
            <p>
              The system transcodes your stream into multiple quality variants (1080p, 720p, 480p, 360p) 
              and allows players to seamlessly switch between them without interruption.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <h4 className="text-white font-medium mb-1">📺 Quality Profiles</h4>
                <ul className="space-y-1 text-xs">
                  <li>• 1080p (5 Mbps) - Full HD</li>
                  <li>• 720p (3 Mbps) - HD</li>
                  <li>• 480p (1.5 Mbps) - SD</li>
                  <li>• 360p (800 kbps) - Mobile</li>
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <h4 className="text-white font-medium mb-1">⚙️ Technical</h4>
                <ul className="space-y-1 text-xs">
                  <li>• HLS protocol</li>
                  <li>• 4-second segments</li>
                  <li>• H.264 video codec</li>
                  <li>• AAC audio codec</li>
                </ul>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
