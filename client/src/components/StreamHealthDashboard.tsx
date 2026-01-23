import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Activity, AlertTriangle, CheckCircle, Clock, PlayCircle, TrendingUp, XCircle, Zap } from "lucide-react";
import { useState, useEffect } from "react";

interface Stream {
  id: number;
  name: string;
  monitorStatus: string;
  lastChecked?: Date;
}

interface StreamHealthProps {
  streams: Stream[];
  connected: boolean;
}

interface HealthMetrics {
  uptime: number;
  errorRate: number;
  avgResponseTime: number;
  healthScore: number;
}

export function StreamHealthDashboard({ streams, connected }: StreamHealthProps) {
  const [metrics, setMetrics] = useState<Record<number, HealthMetrics>>({});

  // Calculate health metrics for each stream
  useEffect(() => {
    const newMetrics: Record<number, HealthMetrics> = {};
    
    streams.forEach(stream => {
      // Simulate metrics (in production, these would come from actual monitoring)
      const isOnline = stream.monitorStatus === 'online';
      const uptime = isOnline ? 95 + Math.random() * 5 : Math.random() * 50;
      const errorRate = isOnline ? Math.random() * 2 : 5 + Math.random() * 10;
      const avgResponseTime = isOnline ? 100 + Math.random() * 200 : 500 + Math.random() * 500;
      
      // Calculate health score (0-100)
      let healthScore = 100;
      healthScore -= errorRate * 5; // Deduct for errors
      healthScore -= (avgResponseTime / 1000) * 10; // Deduct for slow response
      healthScore = Math.max(0, Math.min(100, healthScore));
      
      newMetrics[stream.id] = {
        uptime,
        errorRate,
        avgResponseTime,
        healthScore
      };
    });
    
    setMetrics(newMetrics);
  }, [streams]);

  // Calculate overall metrics
  const onlineStreams = streams.filter(s => s.monitorStatus === 'online').length;
  const offlineStreams = streams.filter(s => s.monitorStatus === 'offline').length;
  const unknownStreams = streams.filter(s => s.monitorStatus === 'unknown').length;
  
  const avgHealthScore = Object.values(metrics).length > 0
    ? Object.values(metrics).reduce((sum, m) => sum + m.healthScore, 0) / Object.values(metrics).length
    : 0;
  
  const avgUptime = Object.values(metrics).length > 0
    ? Object.values(metrics).reduce((sum, m) => sum + m.uptime, 0) / Object.values(metrics).length
    : 0;

  // Get health color based on score
  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 70) return "text-yellow-500";
    if (score >= 50) return "text-orange-500";
    return "text-red-500";
  };

  const getHealthBgColor = (score: number) => {
    if (score >= 90) return "bg-green-500/10";
    if (score >= 70) return "bg-yellow-500/10";
    if (score >= 50) return "bg-orange-500/10";
    return "bg-red-500/10";
  };

  const getHealthBadge = (score: number) => {
    if (score >= 90) return { text: "Excellent", color: "bg-green-500" };
    if (score >= 70) return { text: "Good", color: "bg-yellow-500" };
    if (score >= 50) return { text: "Fair", color: "bg-orange-500" };
    return { text: "Poor", color: "bg-red-500" };
  };

  return (
    <div className="space-y-6">
      {/* Overall Health Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-white">{onlineStreams}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-white">{offlineStreams}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${getHealthBgColor(avgHealthScore)} flex items-center justify-center`}>
                <Activity className={`w-5 h-5 ${getHealthColor(avgHealthScore)}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Health</p>
                <p className="text-2xl font-bold text-white">{avgHealthScore.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Uptime</p>
                <p className="text-2xl font-bold text-white">{avgUptime.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stream Health List */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Stream Health Monitoring
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
              {streams.length} Streams
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {streams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-2 opacity-20" />
              <p>No streams to monitor</p>
            </div>
          ) : (
            <div className="space-y-3">
              {streams.slice(0, 10).map(stream => {
                const streamMetrics = metrics[stream.id];
                if (!streamMetrics) return null;
                
                const healthBadge = getHealthBadge(streamMetrics.healthScore);
                
                return (
                  <div key={stream.id} className="p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg ${getHealthBgColor(streamMetrics.healthScore)} flex items-center justify-center`}>
                          {stream.monitorStatus === 'online' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                          ) : stream.monitorStatus === 'offline' ? (
                            <XCircle className="w-4 h-4 text-red-500" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{stream.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            Stream #{stream.id} • 
                            {stream.lastChecked 
                              ? ` Checked ${new Date(stream.lastChecked).toLocaleTimeString()}`
                              : ' Never checked'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${healthBadge.color} text-white border-0`}>
                          {healthBadge.text}
                        </Badge>
                        <span className={`text-lg font-bold ${getHealthColor(streamMetrics.healthScore)}`}>
                          {streamMetrics.healthScore.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Uptime</p>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{streamMetrics.uptime.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Error Rate</p>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{streamMetrics.errorRate.toFixed(2)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Response Time</p>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{streamMetrics.avgResponseTime.toFixed(0)}ms</span>
                        </div>
                      </div>
                    </div>
                    
                    <Progress value={streamMetrics.healthScore} className="h-2" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
