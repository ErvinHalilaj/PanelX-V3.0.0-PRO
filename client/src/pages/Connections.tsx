import { Layout } from "@/components/Layout";
import { useConnections, useKillConnection } from "@/hooks/use-connections";
import { Wifi, WifiOff, Monitor, Clock, MapPin, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function Connections() {
  const { data: connections, isLoading } = useConnections();
  const killConnection = useKillConnection();

  const handleKill = async (id: number) => {
    try {
      await killConnection.mutateAsync(id);
      toast({ title: "Connection Killed", description: "The connection has been terminated" });
    } catch {
      toast({ title: "Error", description: "Failed to kill connection", variant: "destructive" });
    }
  };

  return (
    <Layout title="Active Connections">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-500" />
            </div>
            <span className="text-muted-foreground font-medium">Active Now</span>
          </div>
          <p className="text-3xl font-display font-bold text-white" data-testid="text-active-count">{connections?.length || 0}</p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-blue-500" />
            </div>
            <span className="text-muted-foreground font-medium">Unique IPs</span>
          </div>
          <p className="text-3xl font-display font-bold text-white" data-testid="text-unique-ips">
            {new Set(connections?.map((c) => c.ipAddress)).size || 0}
          </p>
        </div>
        <div className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-muted-foreground font-medium">Avg. Duration</span>
          </div>
          <p className="text-3xl font-display font-bold text-white" data-testid="text-avg-duration">--</p>
        </div>
      </div>

      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-semibold text-white">Live Connections</h3>
          <Badge variant="outline" className="gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Real-time
          </Badge>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading connections...</div>
        ) : connections?.length === 0 ? (
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
                <th className="px-6 py-4">Line ID</th>
                <th className="px-6 py-4">Stream</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">User Agent</th>
                <th className="px-6 py-4">Started</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {connections?.map((conn) => (
                <tr key={conn.id} className="hover:bg-white/5 transition-colors" data-testid={`row-connection-${conn.id}`}>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" data-testid={`text-lineid-${conn.id}`}>#{conn.lineId}</Badge>
                  </td>
                  <td className="px-6 py-4 font-medium text-white" data-testid={`text-streamid-${conn.id}`}>
                    Stream #{conn.streamId}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span data-testid={`text-ip-${conn.id}`}>{conn.ipAddress || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={conn.userAgent || ""}>
                    {conn.userAgent?.slice(0, 30) || "Unknown"}...
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {conn.startedAt ? formatDistanceToNow(new Date(conn.startedAt), { addSuffix: true }) : "Unknown"}
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
