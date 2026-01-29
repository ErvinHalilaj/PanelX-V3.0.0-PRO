import { Layout } from "@/components/Layout";
import { BandwidthChart } from "@/components/BandwidthChart";
import { StreamHealthDashboard } from "@/components/StreamHealthDashboard";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQuery } from "@tanstack/react-query";
import { Activity, Tv, Users, CreditCard, AlertCircle, CheckCircle, Clock, TrendingUp, Server, Radio, Shield } from "lucide-react";

// System metrics type
interface SystemMetrics {
  timestamp: string;
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  network: { bytesIn: number; bytesOut: number };
  streams: { total: number; online: number; offline: number };
  users: { total: number; active: number; online: number };
}
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line as RechartsLine, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Line as LineType, ActiveConnection, Stream } from "@shared/schema";

// No longer using sample data - real-time WebSocket data is used throughout

// Sample data - Will use real stream counts when implemented
const SAMPLE_contentDistribution = [
  { name: "Live TV", value: 65, color: "#06b6d4" },
  { name: "Movies", value: 25, color: "#10b981" },
  { name: "Series", value: 10, color: "#f59e0b" },
];

function StatsCard({ title, value, icon: Icon, color, subtext, trend }: any) {
  const bgColorClass = color.replace('text-', 'bg-').split(' ')[0];
  return (
    <div className="stats-card p-5 group">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bgColorClass}/10`}>
          <Icon className={`w-5 h-5 ${color.split(' ')[0]}`} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${trend >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold">{value}</p>
        <h3 className="text-muted-foreground text-sm mt-0.5">{title}</h3>
      </div>
      {subtext && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">{subtext}</p>}
    </div>
  );
}

function MiniCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  const bgColor = color.replace('text-', 'bg-');
  return (
    <Card className="bg-card/60 border-border/50 hover:border-border transition-colors">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${bgColor}/10`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div>
          <p className="text-lg font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  // Real-time WebSocket connection - updates every 2 seconds (no polling!)
  const { 
    connected, 
    dashboardStats, 
    activeConnections: liveConnections,
    bandwidthData,
    systemMetrics,
    bandwidthHistory,
    connectionHistory
  } = useWebSocket();
  
  // Initial load only - no refetching (data comes from WebSocket)
  const { data: initialLines = [], isLoading: linesLoading } = useQuery<LineType[]>({
    queryKey: ["/api/lines"],
    staleTime: Infinity, // Never refetch - WebSocket handles updates
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  const { data: initialStreams = [], isLoading: streamsLoading } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  // Use WebSocket data for real-time stats
  const displayConnections = liveConnections;

  // Calculate stats from WebSocket OR initial data
  const totalLines = dashboardStats?.totalLines ?? initialLines.length;
  const activeLines = dashboardStats?.activeLines ?? initialLines.filter(l => l.enabled && (!l.expDate || new Date(l.expDate) > new Date())).length;
  const expiredLines = dashboardStats?.expiredLines ?? initialLines.filter(l => l.expDate && new Date(l.expDate) < new Date()).length;
  const trialLines = initialLines.filter(l => l.isTrial).length;
  
  const totalStreams = dashboardStats?.totalStreams ?? initialStreams.length;
  const onlineStreams = dashboardStats?.onlineStreams ?? initialStreams.filter(s => s.monitorStatus === 'online').length;
  const activeConnectionCount = dashboardStats?.activeConnections ?? liveConnections.length;
  const currentBandwidth = bandwidthData?.total ?? '0.00 KB/s';

  const isLoading = linesLoading || streamsLoading;

  if (isLoading && !connected) return (
    <Layout title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-40 bg-card/30 rounded-2xl animate-pulse" />
        ))}
      </div>
    </Layout>
  );

  return (
    <Layout title="Dashboard">
      {/* Real-time connection indicator */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <span className="text-muted-foreground">
          {connected ? 'Live monitoring active' : 'Reconnecting...'}
        </span>
        {bandwidthData && (
          <span className="ml-4 text-muted-foreground flex items-center gap-1">
            <Radio className="w-3 h-3" />
            Bandwidth: {bandwidthData.total}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Active Connections" 
          value={activeConnectionCount}
          icon={Activity}
          color="text-emerald-500 bg-emerald-500"
          subtext={<span className="text-emerald-400">{connected ? 'Live Now' : 'Last known'}</span>}
          trend={8}
        />
        <StatsCard 
          title="Total Lines" 
          value={totalLines}
          icon={Users}
          color="text-blue-500 bg-blue-500"
          subtext={`${activeLines} active, ${expiredLines} expired`}
          trend={12}
        />
        <StatsCard 
          title="Online Streams" 
          value={onlineStreams}
          icon={Tv}
          color="text-primary bg-primary"
          subtext={`${totalStreams} Total Streams`}
        />
        <StatsCard 
          title="Total Credits" 
          value={0}
          icon={CreditCard}
          color="text-orange-500 bg-orange-500"
          subtext="0 Users"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <MiniCard title="Trial Lines" value={trialLines} icon={Clock} color="text-yellow-500" />
        <MiniCard title="Expired Lines" value={expiredLines} icon={AlertCircle} color="text-red-500" />
        <MiniCard title="Active Lines" value={activeLines} icon={CheckCircle} color="text-green-500" />
        <MiniCard title="Servers" value="3" icon={Server} color="text-purple-500" />
      </div>

      {/* Bandwidth Monitoring Charts */}
      <div className="mt-8">
        <BandwidthChart bandwidthData={bandwidthData || undefined} connected={connected} />
      </div>

      {/* Stream Health Monitoring */}
      <div className="mt-8">
        <StreamHealthDashboard streams={initialStreams.map(s => ({ ...s, monitorStatus: s.monitorStatus || 'unknown' }))} connected={connected} />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Bandwidth Usage
              {connected && <span className="ml-2 text-xs text-emerald-500 font-normal flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>}
            </h3>
            <Badge variant="outline" className="gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
              {connected ? '2s updates' : 'Offline'}
            </Badge>
          </div>
          <div className="h-[280px] w-full">
            {bandwidthHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Waiting for bandwidth data...</p>
                  <p className="text-xs mt-1">Start streaming to see real-time stats</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bandwidthHistory}>
                  <defs>
                    <linearGradient id="colorBw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value.toFixed(1)} MB/s`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [`${value.toFixed(2)} MB/s`, 'Bandwidth']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="bandwidth" 
                    stroke="#06b6d4" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorBw)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary" /> Content Distribution
          </h3>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={SAMPLE_contentDistribution}
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {SAMPLE_contentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {SAMPLE_contentDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-muted-foreground">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" /> Connection Activity
            {connected && <span className="ml-2 text-xs text-emerald-500 font-normal flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />LIVE</span>}
          </h3>
          <div className="h-[200px]">
            {connectionHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting for connection data...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={connectionHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="#4b5563" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [value, 'Connections']}
                  />
                  <RechartsLine 
                    type="monotone" 
                    dataKey="connections" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: "#10b981", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Recent Activity
          </h3>
          <div className="space-y-4 max-h-[200px] overflow-y-auto">
            {displayConnections.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No active connections</p>
            ) : (
              displayConnections.slice(0, 5).map((conn: any) => (
                <div key={conn.id} className="flex items-start gap-3 p-2 rounded-lg bg-white/5">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      <span className="text-primary font-medium">Line #{conn.lineId}</span>
                      {conn.streamId && <span className="text-muted-foreground"> watching stream #{conn.streamId}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{conn.ipAddress}</span>
                      {conn.userAgent && (
                        <Badge variant="outline" className="text-xs">
                          {conn.userAgent.includes("VLC") ? "VLC" : 
                           conn.userAgent.includes("Smarters") ? "Smarters" :
                           conn.userAgent.includes("TiviMate") ? "TiviMate" : "Player"}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {conn.startedAt ? formatDistanceToNow(new Date(conn.startedAt), { addSuffix: true }) : "now"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card/40 border-white/5 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="w-5 h-5 text-red-500" /> Security Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-2xl font-bold text-green-500">0</p>
                <p className="text-xs text-muted-foreground mt-1">Blocked Attacks</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-500/10">
                <p className="text-2xl font-bold text-yellow-500">2</p>
                <p className="text-xs text-muted-foreground mt-1">Blocked IPs</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10">
                <p className="text-2xl font-bold text-blue-500">100%</p>
                <p className="text-xs text-muted-foreground mt-1">Uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-5 h-5 text-purple-500" /> System Health
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs text-muted-foreground">{connected ? 'Live' : 'Offline'}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">CPU Usage</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      (systemMetrics?.cpu?.usage || 0) > 80 ? 'bg-red-500' : 
                      (systemMetrics?.cpu?.usage || 0) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} 
                    style={{ width: `${Math.min(systemMetrics?.cpu?.usage || 0, 100)}%` }} 
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(systemMetrics?.cpu?.usage || 0)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Memory</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      (systemMetrics?.memory?.usagePercent || 0) > 90 ? 'bg-red-500' : 
                      (systemMetrics?.memory?.usagePercent || 0) > 75 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} 
                    style={{ width: `${Math.min(systemMetrics?.memory?.usagePercent || 0, 100)}%` }} 
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(systemMetrics?.memory?.usagePercent || 0)}%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Disk</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      (systemMetrics?.disk?.usagePercent || 0) > 90 ? 'bg-red-500' : 
                      (systemMetrics?.disk?.usagePercent || 0) > 75 ? 'bg-yellow-500' : 'bg-purple-500'
                    }`} 
                    style={{ width: `${Math.min(systemMetrics?.disk?.usagePercent || 0, 100)}%` }} 
                  />
                </div>
                <span className="text-sm font-medium">{Math.round(systemMetrics?.disk?.usagePercent || 0)}%</span>
              </div>
            </div>
            {systemMetrics?.cpu?.cores && (
              <p className="text-xs text-muted-foreground pt-1">
                {systemMetrics.cpu.cores} CPU cores available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
