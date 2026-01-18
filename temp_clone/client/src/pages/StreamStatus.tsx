import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Tv, Search, RefreshCw, Play, Pause, AlertCircle, CheckCircle, Circle, Loader2 } from "lucide-react";
import type { Stream } from "@shared/schema";

export default function StreamStatus() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const { data: streams = [], isLoading, refetch } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
    refetchInterval: 10000,
  });

  const checkStatusMutation = useMutation({
    mutationFn: async (streamId: number) => {
      return apiRequest("POST", `/api/streams/${streamId}/check-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Status check complete" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleStreamMutation = useMutation({
    mutationFn: async ({ id, isMonitored }: { id: number; isMonitored: boolean }) => {
      return apiRequest("PUT", `/api/streams/${id}`, { isMonitored });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    }
  });

  const filteredStreams = streams.filter(stream =>
    stream.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stream.sourceUrl.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusIcon = (stream: Stream) => {
    if (!stream.isMonitored) {
      return <Circle className="w-4 h-4 text-gray-500" />;
    }
    switch (stream.monitorStatus) {
      case "online":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "offline":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Circle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (stream: Stream) => {
    if (!stream.isMonitored) {
      return <Badge variant="secondary">Not Monitored</Badge>;
    }
    switch (stream.monitorStatus) {
      case "online":
        return <Badge className="bg-green-600 text-white">Online</Badge>;
      case "offline":
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const onlineCount = streams.filter(s => s.isMonitored && s.monitorStatus === "online").length;
  const offlineCount = streams.filter(s => s.isMonitored && s.monitorStatus === "offline").length;
  const unknownCount = streams.filter(s => s.isMonitored && (!s.monitorStatus || s.monitorStatus === "unknown")).length;
  const notMonitored = streams.filter(s => !s.isMonitored).length;

  return (
    <Layout 
      title="Stream Status Monitor"
      actions={
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search streams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px]"
              data-testid="input-search-streams"
            />
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => refetch()}
            data-testid="button-refresh-streams"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Tv className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Streams</p>
              <p className="text-lg font-bold">{streams.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Online</p>
              <p className="text-lg font-bold text-green-500">{onlineCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Offline</p>
              <p className="text-lg font-bold text-red-500">{offlineCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-500/10">
              <Circle className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Unknown / Not Monitored</p>
              <p className="text-lg font-bold">{unknownCount + notMonitored}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="w-5 h-5" />
            Live Stream Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading streams...</div>
          ) : filteredStreams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No streams found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Stream Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStreams.map((stream) => (
                  <TableRow key={stream.id} data-testid={`row-stream-${stream.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(stream)}
                        {getStatusBadge(stream)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{stream.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{stream.streamType || "live"}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs font-mono text-muted-foreground" title={stream.sourceUrl}>
                      {stream.sourceUrl}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {stream.lastChecked 
                        ? new Date(stream.lastChecked).toLocaleString() 
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => checkStatusMutation.mutate(stream.id)}
                          disabled={checkStatusMutation.isPending}
                          title="Check status"
                          data-testid={`button-check-status-${stream.id}`}
                        >
                          {checkStatusMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => toggleStreamMutation.mutate({ id: stream.id, isMonitored: !stream.isMonitored })}
                          title={stream.isMonitored ? "Disable monitoring" : "Enable monitoring"}
                          data-testid={`button-toggle-stream-${stream.id}`}
                        >
                          {stream.isMonitored ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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
