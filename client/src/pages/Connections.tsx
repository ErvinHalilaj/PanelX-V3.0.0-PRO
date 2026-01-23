import { Layout } from "@/components/Layout";
import { useConnections, useKillConnection } from "@/hooks/use-connections";
import { useWebSocket } from "@/hooks/use-websocket";
import { Wifi, WifiOff, Monitor, Clock, MapPin, XCircle, Globe, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function Connections() {
  const { data: connections, isLoading } = useConnections();
  const killConnection = useKillConnection();
  
  // Real-time WebSocket connection
  const { connected, activeConnections: liveConnections } = useWebSocket();
  
  // Use WebSocket data if available, otherwise fallback to API data
  const displayConnections = liveConnections.length > 0 ? liveConnections : connections || [];

  const handleKill = async (id: number) => {
    try {
      await killConnection.mutateAsync(id);
      toast({ title: "Connection Killed", description: "The connection has been terminated" });
    } catch {
      toast({ title: "Error", description: "Failed to kill connection", variant: "destructive" });
    }
  };
  
  // Calculate average duration
  const avgDuration = displayConnections.length > 0 
    ? Math.floor(displayConnections.reduce((sum, conn) => sum + (conn.duration || 0), 0) / displayConnections.length)
    : 0;
  
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <Layout title="Active Connections">
      {/* Real-time connection indicator */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-muted-foreground">
          {connected ? 'Real-time monitoring active' : 'Using cached data - reconnecting...'}
        </span>
        <span className="ml-4 text-muted-foreground flex items-center gap-1">
          <Radio className="w-3 h-3" />
          Updates every 5s
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-muted-foreground font-medium">Active Now</span>
          </div>
          <p className="text-3xl font-display font-bold text-white" data-testid="text-active-count">
            {displayConnections.length}
            {connected && <span className="text-xs ml-2 text-green-500 font-normal">LIVE</span>}
          </p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-muted-foreground font-medium">Unique IPs</span>
          </div>
          <p className="text-3xl font-display font-bold text-white" data-testid="text-unique-ips">
            {new Set(displayConnections.map((c) => c.ip)).size || 0}
          </p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-muted-foreground font-medium">Avg. Duration</span>
          </div>
          <p className="text-3xl font-display font-bold text-white" data-testid="text-avg-duration">
            {avgDuration > 0 ? formatDuration(avgDuration) : '--'}
          </p>
        </div>
      </div>

      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold text-white">Live Connections</h3>
          <Badge variant="outline" className="gap-1">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
            {connected ? 'Real-time' : 'Cached'}
          </Badge>
        </div>

        {isLoading && displayConnections.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Loading connections...</div>
        ) : displayConnections.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white">No active connections</h3>
            <p className="text-sm text-muted-foreground">Connections will appear here when users start streaming</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Stream</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Bandwidth</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {displayConnections.map((conn, index) => (
                <tr key={conn.id || index} className="hover:bg-white/5 transition-colors" data-testid={`row-connection-${conn.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{conn.username}</span>
                      <span className="text-xs text-muted-foreground">{conn.ip}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{conn.streamName}</span>
                      <Badge variant="secondary" className="w-fit mt-1">{conn.streamType}</Badge>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="w-3 h-3" />
                      <div className="flex flex-col">
                        {conn.country && <span>{conn.country}</span>}
                        {conn.city && <span className="text-xs">{conn.city}</span>}
                        {conn.isp && <span className="text-xs">{conn.isp}</span>}
                        {!conn.country && !conn.city && <span>Unknown</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {conn.duration ? formatDuration(conn.duration) : formatDistanceToNow(new Date(conn.connectedAt), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {conn.bytesTransferred ? `${(conn.bytesTransferred / (1024 * 1024)).toFixed(2)} MB` : '--'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleKill(conn.id)}
                      data-testid={`button-kill-${conn.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Kill
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
