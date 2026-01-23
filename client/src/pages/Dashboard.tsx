import { Layout } from "@/components/Layout";
import { useStats } from "@/hooks/use-stats";
import { useWebSocket } from "@/hooks/use-websocket";
import { useQuery } from "@tanstack/react-query";
import { Activity, Tv, Users, Wifi, CreditCard, AlertCircle, CheckCircle, Clock, TrendingUp, Server, Shield, Radio } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line as RechartsLine, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import type { Line as LineType, ActiveConnection } from "@shared/schema";

// Sample data - Replace with real API data when analytics endpoints are implemented
const SAMPLE_bandwidthData = [
  { time: "00:00", bandwidth: 450 },
  { time: "04:00", bandwidth: 230 },
  { time: "08:00", bandwidth: 890 },
  { time: "12:00", bandwidth: 1200 },
  { time: "16:00", bandwidth: 1500 },
  { time: "20:00", bandwidth: 1800 },
  { time: "23:59", bandwidth: 1100 },
];

// Sample data - Replace with real API data when analytics endpoints are implemented  
const SAMPLE_connectionsData = [
  { hour: "12:00", connections: 45 },
  { hour: "13:00", connections: 52 },
  { hour: "14:00", connections: 48 },
  { hour: "15:00", connections: 78 },
  { hour: "16:00", connections: 92 },
  { hour: "17:00", connections: 85 },
  { hour: "Now", connections: 67 },
];

// Sample data - Will use real stream counts when implemented
const SAMPLE_contentDistribution = [
  { name: "Live TV", value: 65, color: "#8b5cf6" },
  { name: "Movies", value: 25, color: "#10b981" },
  { name: "Series", value: 10, color: "#f59e0b" },
];

function StatsCard({ title, value, icon: Icon, color, subtext, trend }: any) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-card/50 backdrop-blur-xl border border-white/5 p-6 rounded-2xl shadow-xl relative overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
        <Icon className="w-24 h-24" />
      </div>
      <div className="relative z-10">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color} bg-opacity-10`}>
          <Icon className={`w-6 h-6 ${color.replace('text-', 'text-')}`} />
        </div>
        <h3 className="text-muted-foreground font-medium text-sm uppercase tracking-wider">{title}</h3>
        <div className="flex items-end gap-2">
          <p className="text-3xl font-display font-bold text-white mt-1">{value}</p>
          {trend !== undefined && (
            <span className={`text-xs mb-1 ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
              {trend >= 0 ? "+" : ""}{trend}%
            </span>
          )}
        </div>
        {subtext && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">{subtext}</p>}
      </div>
    </motion.div>
  );
}

function MiniCard({ title, value, icon: Icon, color }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <Card className="bg-card/40 border-white/5">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color} bg-opacity-10`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  
  // Real-time WebSocket connection
  const { 
    connected, 
    dashboardStats, 
    activeConnections: liveConnections,
    bandwidthData 
  } = useWebSocket();
  
  const { data: recentConnections = [] } = useQuery<ActiveConnection[]>({
    queryKey: ["/api/connections"],
    refetchInterval: 10000,
  });

  const { data: lines = [] } = useQuery<LineType[]>({
    queryKey: ["/api/lines"]
  });

  // Use WebSocket data if available, otherwise fallback to API data
  const displayStats = dashboardStats || stats;
  const displayConnections = liveConnections.length > 0 ? liveConnections : recentConnections;

  const expiredLines = lines.filter(l => l.expDate && new Date(l.expDate) < new Date()).length;
  const trialLines = lines.filter(l => l.isTrial).length;
  const activeLines = lines.filter(l => l.enabled && (!l.expDate || new Date(l.expDate) > new Date())).length;

  if (isLoading) return (
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
          value={displayStats?.activeConnections || 0}
          icon={Activity}
          color="text-emerald-500 bg-emerald-500"
          subtext={<span className="text-emerald-400">{connected ? 'Live Now' : 'Last known'}</span>}
          trend={8}
        />
        <StatsCard 
          title="Total Lines" 
          value={displayStats?.totalLines || 0}
          icon={Users}
          color="text-blue-500 bg-blue-500"
          subtext={`${activeLines} active, ${expiredLines} expired`}
          trend={12}
        />
        <StatsCard 
          title="Online Streams" 
          value={displayStats?.onlineStreams || 0}
          icon={Tv}
          color="text-primary bg-primary"
          subtext={`${stats?.totalStreams || 0} Total Streams`}
        />
        <StatsCard 
          title="Total Credits" 
          value={stats?.totalCredits || 0}
          icon={CreditCard}
          color="text-orange-500 bg-orange-500"
          subtext={`${stats?.totalUsers || 0} Users`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <MiniCard title="Trial Lines" value={trialLines} icon={Clock} color="text-yellow-500" />
        <MiniCard title="Expired Lines" value={expiredLines} icon={AlertCircle} color="text-red-500" />
        <MiniCard title="Active Lines" value={activeLines} icon={CheckCircle} color="text-green-500" />
        <MiniCard title="Servers" value="3" icon={Server} color="text-purple-500" />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" /> Bandwidth Usage
            </h3>
            <select className="bg-background border border-white/10 rounded-lg text-sm px-3 py-1.5 text-muted-foreground" data-testid="select-bandwidth-range">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={SAMPLE_bandwidthData}>
                <defs>
                  <linearGradient id="colorBw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="bandwidth" 
                  stroke="hsl(262, 83%, 58%)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorBw)" 
                />
              </AreaChart>
            </ResponsiveContainer>
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
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SAMPLE_connectionsData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
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
          </div>
        </div>

        <div className="bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" /> Recent Activity
          </h3>
          <div className="space-y-4 max-h-[200px] overflow-y-auto">
            {recentConnections.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No active connections</p>
            ) : (
              recentConnections.slice(0, 5).map((conn) => (
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Server className="w-5 h-5 text-purple-500" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">CPU Usage</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: "35%" }} />
                </div>
                <span className="text-sm">35%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Memory</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: "52%" }} />
                </div>
                <span className="text-sm">52%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Disk</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: "28%" }} />
                </div>
                <span className="text-sm">28%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
