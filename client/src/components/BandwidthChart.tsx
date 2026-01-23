import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Radio, TrendingUp, Activity, BarChart3 } from "lucide-react";
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useState, useEffect } from "react";

interface BandwidthChartProps {
  bandwidthData?: {
    total: string;
    perStream: Array<{
      streamId: number;
      bandwidth: string;
    }>;
    timestamp: string;
  };
  connected: boolean;
}

interface HistoricalDataPoint {
  time: string;
  bandwidth: number;
  connections: number;
}

export function BandwidthChart({ bandwidthData, connected }: BandwidthChartProps) {
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [currentBandwidth, setCurrentBandwidth] = useState(0);

  // Update historical data when new bandwidth data arrives
  useEffect(() => {
    if (bandwidthData) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      
      // Parse bandwidth string to number (convert MB/s to number)
      const bandwidthValue = parseBandwidth(bandwidthData.total);
      setCurrentBandwidth(bandwidthValue);
      
      setHistoricalData(prev => {
        const newData = [...prev, {
          time: timeStr,
          bandwidth: bandwidthValue,
          connections: 0 // Will be updated from connections data
        }];
        
        // Keep only last 20 data points (approx 100 seconds at 5s intervals)
        return newData.slice(-20);
      });
    }
  }, [bandwidthData]);

  // Parse bandwidth string to number
  const parseBandwidth = (bw: string): number => {
    if (!bw) return 0;
    const match = bw.match(/([\d.]+)\s*([KMGT]?B\/s)/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 'KB/s': return value / 1024;
      case 'MB/s': return value;
      case 'GB/s': return value * 1024;
      case 'TB/s': return value * 1024 * 1024;
      default: return value / (1024 * 1024); // Bytes to MB
    }
  };

  // Format bandwidth for display
  const formatBandwidth = (value: number): string => {
    if (value < 1) return `${(value * 1024).toFixed(2)} KB/s`;
    if (value < 1024) return `${value.toFixed(2)} MB/s`;
    return `${(value / 1024).toFixed(2)} GB/s`;
  };

  // Calculate stats
  const avgBandwidth = historicalData.length > 0
    ? historicalData.reduce((sum, d) => sum + d.bandwidth, 0) / historicalData.length
    : 0;
  
  const peakBandwidth = historicalData.length > 0
    ? Math.max(...historicalData.map(d => d.bandwidth))
    : 0;

  const trend = historicalData.length >= 2
    ? ((historicalData[historicalData.length - 1].bandwidth - historicalData[historicalData.length - 2].bandwidth) / historicalData[historicalData.length - 2].bandwidth) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Radio className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Bandwidth</p>
                <p className="text-xl font-bold text-white">
                  {formatBandwidth(currentBandwidth)}
                  {connected && <span className="text-xs ml-2 text-green-500 font-normal">LIVE</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Average (Last 100s)</p>
                <p className="text-xl font-bold text-white">{formatBandwidth(avgBandwidth)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Peak Usage</p>
                <p className="text-xl font-bold text-white">
                  {formatBandwidth(peakBandwidth)}
                  {trend !== 0 && (
                    <span className={`text-xs ml-2 ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trend > 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-Time Bandwidth Chart */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Real-Time Bandwidth (Last 100s)
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
              {connected ? '5s updates' : 'Cached'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {historicalData.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Waiting for bandwidth data...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="bandwidthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="time" 
                  stroke="#888" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#888" 
                  fontSize={11}
                  tickLine={false}
                  tickFormatter={(value) => `${value.toFixed(1)} MB/s`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [formatBandwidth(value), 'Bandwidth']}
                />
                <Area 
                  type="monotone" 
                  dataKey="bandwidth" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fill="url(#bandwidthGradient)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Per-Stream Bandwidth */}
      {bandwidthData && bandwidthData.perStream && bandwidthData.perStream.length > 0 && (
        <Card className="bg-card/40 border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Top Streams by Bandwidth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={bandwidthData.perStream}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="streamId" 
                  stroke="#888" 
                  fontSize={11}
                  tickLine={false}
                  label={{ value: 'Stream ID', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  stroke="#888" 
                  fontSize={11}
                  tickLine={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                />
                <Bar 
                  dataKey="bandwidth" 
                  fill="#10b981" 
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
