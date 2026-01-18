import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Users, Tv, Calendar, Clock, Loader2, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, formatDistanceToNow } from "date-fns";
import type { StatisticsSnapshot } from "@shared/schema";

export default function StatsSnapshots() {
  const [period, setPeriod] = useState<string>("hourly");

  const { data: snapshots = [], isLoading, isError } = useQuery<StatisticsSnapshot[]>({
    queryKey: ["/api/statistics-snapshots", period],
  });

  const filteredSnapshots = snapshots.filter((s) => s.snapshotType === period);
  const sortedSnapshots = [...filteredSnapshots].sort(
    (a, b) => new Date(b.recordedAt!).getTime() - new Date(a.recordedAt!).getTime()
  );

  const latestSnapshot = sortedSnapshots[0];
  const previousSnapshot = sortedSnapshots[1];

  const calculateChange = (current: number | null, previous: number | null) => {
    if (!current || !previous || previous === 0) return null;
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  if (isError) {
    return (
      <Layout title="Statistics Snapshots" subtitle="Historical analytics and trends">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load statistics snapshots. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Statistics Snapshots" subtitle="Historical analytics and trends">
      <div className="flex justify-between items-center mb-6">
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="hourly" data-testid="tab-hourly">
              <Clock className="w-4 h-4 mr-2" /> Hourly
            </TabsTrigger>
            <TabsTrigger value="daily" data-testid="tab-daily">
              <Calendar className="w-4 h-4 mr-2" /> Daily
            </TabsTrigger>
            <TabsTrigger value="weekly" data-testid="tab-weekly">
              <BarChart3 className="w-4 h-4 mr-2" /> Weekly
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" data-testid="button-export">
          <Download className="w-4 h-4 mr-2" /> Export Data
        </Button>
      </div>

      {latestSnapshot && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{latestSnapshot.activeLines || 0}</div>
                <div className="text-sm text-muted-foreground">Active Lines</div>
              </div>
              {previousSnapshot && (
                <TrendingIndicator
                  change={calculateChange(latestSnapshot.activeLines, previousSnapshot.activeLines)}
                />
              )}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{latestSnapshot.totalConnections || 0}</div>
                <div className="text-sm text-muted-foreground">Total Connections</div>
              </div>
              {previousSnapshot && (
                <TrendingIndicator
                  change={calculateChange(
                    latestSnapshot.totalConnections,
                    previousSnapshot.totalConnections
                  )}
                />
              )}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{latestSnapshot.uniqueUsers || 0}</div>
                <div className="text-sm text-muted-foreground">Unique Users</div>
              </div>
              {previousSnapshot && (
                <TrendingIndicator
                  change={calculateChange(latestSnapshot.uniqueUsers, previousSnapshot.uniqueUsers)}
                />
              )}
            </div>
          </div>
          <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{latestSnapshot.peakConnections || 0}</div>
                <div className="text-sm text-muted-foreground">Peak Connections</div>
              </div>
              {previousSnapshot && (
                <TrendingIndicator
                  change={calculateChange(
                    latestSnapshot.peakConnections,
                    previousSnapshot.peakConnections
                  )}
                />
              )}
            </div>
          </div>
        </div>
      )}

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
                  Timestamp
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                  Type
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                  Active Lines
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                  Connections
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                  Peak
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                  Unique Users
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                  Bandwidth
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedSnapshots.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No snapshots available for this period.
                  </td>
                </tr>
              ) : (
                sortedSnapshots.slice(0, 50).map((snapshot) => (
                  <tr
                    key={snapshot.id}
                    className="border-b border-white/5 hover:bg-white/5"
                    data-testid={`snapshot-row-${snapshot.id}`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="text-sm">
                            {format(new Date(snapshot.recordedAt!), "MMM d, yyyy HH:mm")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(snapshot.recordedAt!), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline">{snapshot.snapshotType}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {snapshot.activeLines?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {snapshot.totalConnections?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {snapshot.peakConnections?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {snapshot.uniqueUsers?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {formatBytes(snapshot.totalBandwidth)}
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

function TrendingIndicator({ change }: { change: string | null }) {
  if (!change) return null;
  const value = parseFloat(change);
  const isPositive = value >= 0;

  return (
    <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-green-500" : "text-red-500"}`}>
      <TrendingUp className={`w-4 h-4 ${!isPositive ? "rotate-180" : ""}`} />
      <span>{isPositive ? "+" : ""}{change}%</span>
    </div>
  );
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}
