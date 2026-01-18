import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Search, Clock, User, Globe, Monitor } from "lucide-react";
import { format } from "date-fns";
import type { ActivityLog } from "@shared/schema";

export default function ActivityLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/activity-logs"],
    refetchInterval: 10000,
  });

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.ipAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userAgent?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case "auth_success":
        return <Badge className="bg-green-600 text-white">Auth Success</Badge>;
      case "auth_fail":
        return <Badge variant="destructive">Auth Failed</Badge>;
      case "stream_start":
        return <Badge className="bg-blue-600 text-white">Stream Start</Badge>;
      case "stream_stop":
        return <Badge className="bg-orange-600 text-white">Stream Stop</Badge>;
      default:
        return <Badge variant="secondary">{action}</Badge>;
    }
  };

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));

  return (
    <Layout 
      title="Activity Logs"
      actions={
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px]"
              data-testid="input-search-logs"
            />
          </div>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-action-filter">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>{action}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
              <Activity className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-lg font-bold">{logs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <User className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auth Success</p>
              <p className="text-lg font-bold">{logs.filter(l => l.action === "auth_success").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
              <Globe className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auth Failed</p>
              <p className="text-lg font-bold">{logs.filter(l => l.action === "auth_fail").length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10">
              <Monitor className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Stream Events</p>
              <p className="text-lg font-bold">{logs.filter(l => l.action.includes("stream")).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading logs...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No activity logs found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Line ID</TableHead>
                  <TableHead>Stream ID</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>User Agent</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {log.createdAt ? format(new Date(log.createdAt), "MMM dd, HH:mm:ss") : "-"}
                      </div>
                    </TableCell>
                    <TableCell>{getActionBadge(log.action)}</TableCell>
                    <TableCell>{log.lineId || "-"}</TableCell>
                    <TableCell>{log.streamId || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs" title={log.userAgent || ""}>
                      {log.userAgent || "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.details || "-"}</TableCell>
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
