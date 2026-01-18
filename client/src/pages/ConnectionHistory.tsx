import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { History, Globe, Smartphone, Clock, Download, Filter, Loader2, AlertTriangle, Shield, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, formatDistanceToNow } from "date-fns";
import type { ConnectionHistory as ConnectionHistoryType, Line, Stream } from "@shared/schema";

export default function ConnectionHistory() {
  const [search, setSearch] = useState("");
  const [playerFilter, setPlayerFilter] = useState<string>("all");

  const { data: history = [], isLoading, isError } = useQuery<ConnectionHistoryType[]>({
    queryKey: ["/api/connection-history"],
  });

  const { data: lines = [] } = useQuery<Line[]>({
    queryKey: ["/api/lines"],
  });

  const { data: streams = [] } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  const getLineName = (lineId: number) => {
    const line = lines.find((l) => l.id === lineId);
    return line?.username || `Line #${lineId}`;
  };

  const getStreamName = (streamId: number | null) => {
    if (!streamId) return "Unknown";
    const stream = streams.find((s) => s.id === streamId);
    return stream?.name || `Stream #${streamId}`;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let size = bytes;
    while (size >= 1024 && i < units.length - 1) {
      size /= 1024;
      i++;
    }
    return `${size.toFixed(1)} ${units[i]}`;
  };

  const playerTypes = Array.from(new Set(history.map((h) => h.playerType).filter(Boolean)));

  const filteredHistory = history.filter((h) => {
    const matchesSearch =
      search === "" ||
      getLineName(h.lineId).toLowerCase().includes(search.toLowerCase()) ||
      h.ipAddress?.toLowerCase().includes(search.toLowerCase()) ||
      h.playerType?.toLowerCase().includes(search.toLowerCase());
    const matchesPlayer = playerFilter === "all" || h.playerType === playerFilter;
    return matchesSearch && matchesPlayer;
  });

  if (isError) {
    return (
      <Layout title="Connection History" subtitle="View detailed connection logs and analytics">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load connection history. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Connection History" subtitle="View detailed connection logs and analytics">
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Search by username, IP, or player..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
            data-testid="input-search-history"
          />
        </div>
        <Select value={playerFilter} onValueChange={setPlayerFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-player-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Player Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Players</SelectItem>
            {playerTypes.map((type) => (
              <SelectItem key={type} value={type || "unknown"}>
                {type || "Unknown"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" data-testid="button-export">
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="text-2xl font-bold">{history.length}</div>
          <div className="text-sm text-muted-foreground">Total Connections</div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="text-2xl font-bold">{new Set(history.map((h) => h.lineId)).size}</div>
          <div className="text-sm text-muted-foreground">Unique Users</div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="text-2xl font-bold text-yellow-500">
            {history.filter((h) => h.isVpn || h.isProxy).length}
          </div>
          <div className="text-sm text-muted-foreground">VPN/Proxy Detected</div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="text-2xl font-bold text-blue-500">
            {history.filter((h) => h.isDatacenter).length}
          </div>
          <div className="text-sm text-muted-foreground">Datacenter IPs</div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">User</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Stream</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">IP Address</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Player</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Duration</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Data</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Flags</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    No connection history found.
                  </td>
                </tr>
              ) : (
                filteredHistory.slice(0, 100).map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-b border-white/5 hover:bg-white/5"
                    data-testid={`history-row-${entry.id}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <History className="w-4 h-4 text-primary" />
                        <span className="font-medium">{getLineName(entry.lineId || 0)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{getStreamName(entry.streamId)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{entry.ipAddress}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{entry.playerType || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{formatDuration(entry.duration)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm">{formatBytes(entry.bytesTransferred)}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-1">
                        {entry.isVpn && (
                          <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                            <Shield className="w-3 h-3 mr-1" /> VPN
                          </Badge>
                        )}
                        {entry.isProxy && (
                          <Badge variant="outline" className="text-orange-500 border-orange-500/50">
                            <AlertTriangle className="w-3 h-3 mr-1" /> Proxy
                          </Badge>
                        )}
                        {entry.isDatacenter && (
                          <Badge variant="outline" className="text-blue-500 border-blue-500/50">
                            DC
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {entry.startedAt
                        ? formatDistanceToNow(new Date(entry.startedAt), { addSuffix: true })
                        : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
