import { useState } from 'react';
import {
  useStreamAnalytics,
  useViewerAnalytics,
  useRevenueAnalytics,
  useSystemAnalytics,
  useTimeSeriesData,
  usePopularContent,
} from '@/hooks/use-analytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  DollarSign,
  Tv,
  Clock,
  Eye,
  BarChart3,
  Play,
  Server,
  Zap,
} from 'lucide-react';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const [streamDays, setStreamDays] = useState(7);
  const [viewerDays, setViewerDays] = useState(7);
  const [revenueDays, setRevenueDays] = useState(30);
  const [timeSeriesHours, setTimeSeriesHours] = useState(24);
  const [popularDays, setPopularDays] = useState(7);

  // Fetch analytics data
  const systemAnalytics = useSystemAnalytics();
  const streamAnalytics = useStreamAnalytics(undefined, streamDays);
  const viewerAnalytics = useViewerAnalytics(viewerDays);
  const revenueAnalytics = useRevenueAnalytics(revenueDays);
  const viewersTimeSeries = useTimeSeriesData('viewers', timeSeriesHours);
  const bandwidthTimeSeries = useTimeSeriesData('bandwidth', timeSeriesHours);
  const revenueTimeSeries = useTimeSeriesData('revenue', timeSeriesHours);
  const popularContent = usePopularContent(10, popularDays);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatCurrency = (num: number) => {
    return `$${num.toFixed(2)}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics & Reporting</h1>
        <p className="text-muted-foreground">Real-time insights and performance metrics</p>
      </div>

      {/* System Overview */}
      {systemAnalytics.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Streams</CardTitle>
              <Tv className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {systemAnalytics.data.activeStreams} / {systemAnalytics.data.totalStreams}
              </div>
              <p className="text-xs text-muted-foreground">
                {((systemAnalytics.data.activeStreams / systemAnalytics.data.totalStreams) * 100).toFixed(1)}% active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemAnalytics.data.totalConnections}</div>
              <p className="text-xs text-muted-foreground">
                {systemAnalytics.data.activeLines} active lines
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemAnalytics.data.totalBandwidth.toFixed(1)} GB/h</div>
              <p className="text-xs text-muted-foreground">Current usage</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{systemAnalytics.data.avgStreamHealth.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">{systemAnalytics.data.uptime}% uptime</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="streams">Streams</TabsTrigger>
          <TabsTrigger value="viewers">Viewers</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="popular">Popular</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Time Series Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Viewers Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Viewers Over Time</CardTitle>
                  <Select value={timeSeriesHours.toString()} onValueChange={(v) => setTimeSeriesHours(Number(v))}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="6">Last 6h</SelectItem>
                      <SelectItem value="12">Last 12h</SelectItem>
                      <SelectItem value="24">Last 24h</SelectItem>
                      <SelectItem value="48">Last 48h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {viewersTimeSeries.data && viewersTimeSeries.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={viewersTimeSeries.data}>
                      <defs>
                        <linearGradient id="colorViewers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: number) => [value, 'Viewers']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorViewers)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bandwidth Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Bandwidth Usage</CardTitle>
              </CardHeader>
              <CardContent>
                {bandwidthTimeSeries.data && bandwidthTimeSeries.data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={bandwidthTimeSeries.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      <YAxis />
                      <Tooltip
                        labelFormatter={(value) => new Date(value).toLocaleString()}
                        formatter={(value: number) => [`${value.toFixed(2)} GB`, 'Bandwidth']}
                      />
                      <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Streams Tab */}
        <TabsContent value="streams" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stream Analytics</CardTitle>
                  <CardDescription>Performance metrics for your streams</CardDescription>
                </div>
                <Select value={streamDays.toString()} onValueChange={(v) => setStreamDays(Number(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {streamAnalytics.data && streamAnalytics.data.length > 0 ? (
                <div className="space-y-4">
                  {/* Top Streams Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={streamAnalytics.data.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="streamName" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalViews" fill="#3b82f6" name="Total Views" />
                      <Bar dataKey="uniqueViewers" fill="#10b981" name="Unique Viewers" />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Stream Details Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Stream</th>
                          <th className="text-right p-2">Views</th>
                          <th className="text-right p-2">Unique</th>
                          <th className="text-right p-2">Watch Time</th>
                          <th className="text-right p-2">Avg Time</th>
                          <th className="text-right p-2">Peak</th>
                          <th className="text-right p-2">Current</th>
                          <th className="text-right p-2">Bandwidth</th>
                          <th className="text-right p-2">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {streamAnalytics.data.map((stream) => (
                          <tr key={stream.streamId} className="border-b hover:bg-muted/50">
                            <td className="p-2 font-medium">{stream.streamName}</td>
                            <td className="text-right p-2">{formatNumber(stream.totalViews)}</td>
                            <td className="text-right p-2">{formatNumber(stream.uniqueViewers)}</td>
                            <td className="text-right p-2">{formatDuration(stream.totalWatchTime)}</td>
                            <td className="text-right p-2">{formatDuration(stream.avgWatchTime)}</td>
                            <td className="text-right p-2">{stream.peakViewers}</td>
                            <td className="text-right p-2">
                              <Badge variant={stream.currentViewers > 0 ? 'default' : 'secondary'}>
                                {stream.currentViewers}
                              </Badge>
                            </td>
                            <td className="text-right p-2">{stream.bandwidth.toFixed(2)} GB</td>
                            <td className="text-right p-2">{formatCurrency(stream.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No stream analytics data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Viewers Tab */}
        <TabsContent value="viewers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Viewer Analytics</CardTitle>
                  <CardDescription>User engagement and behavior metrics</CardDescription>
                </div>
                <Select value={viewerDays.toString()} onValueChange={(v) => setViewerDays(Number(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {viewerAnalytics.data && viewerAnalytics.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">User</th>
                        <th className="text-right p-2">Total Watch Time</th>
                        <th className="text-right p-2">Streams Watched</th>
                        <th className="text-right p-2">Avg Session</th>
                        <th className="text-left p-2">Favorite Stream</th>
                        <th className="text-right p-2">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewerAnalytics.data.slice(0, 50).map((viewer) => (
                        <tr key={viewer.lineId} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{viewer.username || `Line ${viewer.lineId}`}</td>
                          <td className="text-right p-2">{formatDuration(viewer.totalWatchTime)}</td>
                          <td className="text-right p-2">{viewer.streamsWatched}</td>
                          <td className="text-right p-2">{formatDuration(viewer.averageSessionDuration)}</td>
                          <td className="p-2 text-sm text-muted-foreground">{viewer.favoriteStream || '-'}</td>
                          <td className="text-right p-2 text-sm">
                            {new Date(viewer.lastActive).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No viewer analytics data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Revenue Analytics</CardTitle>
                  <CardDescription>Financial performance and trends</CardDescription>
                </div>
                <Select value={revenueDays.toString()} onValueChange={(v) => setRevenueDays(Number(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {revenueAnalytics.data ? (
                <div className="space-y-6">
                  {/* Revenue Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(revenueAnalytics.data.totalRevenue)}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Subscription Revenue</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(revenueAnalytics.data.subscriptionRevenue)}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Reseller Revenue</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(revenueAnalytics.data.resellerRevenue)}</div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Daily Revenue Chart */}
                  {revenueAnalytics.data.dailyRevenue.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Daily Revenue Trend</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={revenueAnalytics.data.dailyRevenue}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue']} />
                          <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Top Resellers */}
                  {revenueAnalytics.data.topResellersByRevenue.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Top Resellers by Revenue</h3>
                      <div className="space-y-2">
                        {revenueAnalytics.data.topResellersByRevenue.map((reseller, index) => (
                          <div key={reseller.resellerId} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{reseller.username}</p>
                                <p className="text-sm text-muted-foreground">Reseller ID: {reseller.resellerId}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold">{formatCurrency(reseller.revenue)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No revenue analytics data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Popular Tab */}
        <TabsContent value="popular" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Popular Content</CardTitle>
                  <CardDescription>Most watched streams and trending content</CardDescription>
                </div>
                <Select value={popularDays.toString()} onValueChange={(v) => setPopularDays(Number(v))}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {popularContent.data && popularContent.data.length > 0 ? (
                <div className="space-y-3">
                  {popularContent.data.map((content, index) => (
                    <div key={content.streamId} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50">
                      <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                        <span className="text-2xl font-bold text-primary">#{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{content.streamName}</h3>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {formatNumber(content.views)} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {formatNumber(content.uniqueViewers)} unique
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(content.watchTime)}
                          </span>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        <TrendingUp className="w-4 h-4 mr-1" />
                        Popular
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No popular content data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
