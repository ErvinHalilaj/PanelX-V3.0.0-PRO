import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { UserCog, Search, Loader2, User, Clock, AlertTriangle, Shield, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format, formatDistanceToNow } from "date-fns";
import type { ImpersonationLog, User as UserType } from "@shared/schema";

export default function ImpersonationLogs() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, isError } = useQuery<ImpersonationLog[]>({
    queryKey: ["/api/impersonation-logs"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    return user?.username || `User #${userId}`;
  };

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const adminName = getUserName(log.adminId);
    const targetName = getUserName(log.targetUserId);
    return (
      adminName.toLowerCase().includes(search.toLowerCase()) ||
      targetName.toLowerCase().includes(search.toLowerCase()) ||
      log.reason?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const sortedLogs = [...filteredLogs].sort(
    (a, b) => new Date(b.startedAt!).getTime() - new Date(a.startedAt!).getTime()
  );

  if (isError) {
    return (
      <Layout title="Impersonation Logs" subtitle="Audit trail for admin login-as-user actions">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load impersonation logs. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Impersonation Logs" subtitle="Audit trail for admin login-as-user actions">
      <Alert className="mb-6">
        <Shield className="w-4 h-4" />
        <AlertDescription>
          This page shows a complete audit trail of all admin "Login as User" actions. All
          impersonation sessions are logged for security and compliance purposes.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 mb-6">
        <div className="flex-1">
          <Input
            placeholder="Search by admin, target user, or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
            data-testid="input-search-logs"
          />
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
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Admin
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Target User
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Reason
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  IP Address
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Started
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Duration
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No impersonation logs found.
                  </td>
                </tr>
              ) : (
                sortedLogs.map((log) => {
                  const duration = log.endedAt
                    ? Math.floor(
                        (new Date(log.endedAt).getTime() - new Date(log.startedAt!).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <tr
                      key={log.id}
                      className="border-b border-white/5 hover:bg-white/5"
                      data-testid={`log-row-${log.id}`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <UserCog className="w-4 h-4 text-primary" />
                          </div>
                          <span className="font-medium">{getUserName(log.adminId)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <span>{getUserName(log.targetUserId)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-muted-foreground">
                          {log.reason || "No reason provided"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-sm font-mono">{log.ipAddress || "-"}</code>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="text-sm">
                            {format(new Date(log.startedAt!), "MMM d, HH:mm")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(log.startedAt!), { addSuffix: true })}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {log.endedAt ? (
                          <Badge variant="secondary">{formatDuration(duration)}</Badge>
                        ) : (
                          <Badge variant="default" className="bg-yellow-500/20 text-yellow-500">
                            <Clock className="w-3 h-3 mr-1" /> Active
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          Session logged
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
