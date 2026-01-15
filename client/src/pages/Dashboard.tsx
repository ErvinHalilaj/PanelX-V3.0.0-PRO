import { Layout } from "@/components/Layout";
import { useStats } from "@/hooks/use-stats";
import { Activity, Tv, Users, Wifi } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

// Mock data for the chart since we don't have historical data API yet
const chartData = [
  { time: "00:00", bandwidth: 450 },
  { time: "04:00", bandwidth: 230 },
  { time: "08:00", bandwidth: 890 },
  { time: "12:00", bandwidth: 1200 },
  { time: "16:00", bandwidth: 1500 },
  { time: "20:00", bandwidth: 1800 },
  { time: "23:59", bandwidth: 1100 },
];

function StatsCard({ title, value, icon: Icon, color, subtext }: any) {
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
        <p className="text-3xl font-display font-bold text-white mt-1">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">{subtext}</p>}
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Active Connections" 
          value={stats?.activeConnections || 0}
          icon={Activity}
          color="text-emerald-500 bg-emerald-500"
          subtext={<span className="text-emerald-400">● Live Now</span>}
        />
        <StatsCard 
          title="Total Lines" 
          value={stats?.totalLines || 0}
          icon={Users}
          color="text-blue-500 bg-blue-500"
          subtext="+12 new today"
        />
        <StatsCard 
          title="Online Streams" 
          value={stats?.onlineStreams || 0}
          icon={Tv}
          color="text-primary bg-primary"
          subtext={`${stats?.totalStreams || 0} Total Streams`}
        />
        <StatsCard 
          title="Total Bandwidth" 
          value="1.2 Gbps"
          icon={Wifi}
          color="text-orange-500 bg-orange-500"
          subtext="Peak: 2.4 Gbps"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-card/40 border border-white/5 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Bandwidth Usage</h3>
            <select className="bg-background border border-white/10 rounded-lg text-sm px-3 py-1 text-muted-foreground">
              <option>Last 24 Hours</option>
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorBw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#4b5563" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}M`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#374151', borderRadius: '8px' }}
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
          <h3 className="text-lg font-semibold text-white mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-4">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white">User <span className="text-primary font-medium">john_doe</span> connected to Sky Sports</p>
                  <p className="text-xs text-muted-foreground mt-1">2 minutes ago</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
