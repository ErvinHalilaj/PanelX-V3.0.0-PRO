import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { BarChart3, TrendingUp, Globe, Smartphone, Play, Clock, Users, Loader2, RefreshCw, FileText, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

interface ViewingOverview {
  totalViews: number;
  totalWatchTime: number;
  uniqueViewers: number;
  avgWatchTime: number;
  liveViews: number;
  vodViews: number;
  seriesViews: number;
}

interface PopularContent {
  contentId: number;
  contentType: string;
  contentName: string;
  views: number;
  totalWatchTime: number;
  uniqueViewers: number;
}

interface GeoData {
  country: string;
  views: number;
  watchTime: number;
  uniqueViewers: number;
}

interface DeviceData {
  deviceType: string;
  player: string;
  views: number;
  uniqueViewers: number;
}

interface TimelineData {
  date: string;
  views: number;
  watchTime: number;
  uniqueViewers: number;
}

interface ContentReport {
  id: number;
  reportDate: string;
  periodType: string;
  contentType: string;
  contentName: string;
  totalViews: number;
  uniqueViewers: number;
  totalWatchTime: number;
}

export default function AdvancedAnalytics() {
  const [days, setDays] = useState("7");
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportPeriod, setReportPeriod] = useState("daily");

  const { data: overview, isLoading: overviewLoading } = useQuery<ViewingOverview>({
    queryKey: ["/api/viewing-analytics/overview", { days }],
  });

  const { data: popular = [], isLoading: popularLoading } = useQuery<PopularContent[]>({
    queryKey: ["/api/viewing-analytics/popular", { days }],
  });

  const { data: geoData = [] } = useQuery<GeoData[]>({
    queryKey: ["/api/viewing-analytics/geo", { days }],
  });

  const { data: deviceData = [] } = useQuery<DeviceData[]>({
    queryKey: ["/api/viewing-analytics/devices", { days }],
  });

  const { data: timeline = [] } = useQuery<TimelineData[]>({
    queryKey: ["/api/viewing-analytics/timeline", { days }],
  });

  const { data: reports = [] } = useQuery<ContentReport[]>({
    queryKey: ["/api/viewing-analytics/reports"],
  });

  const generateReportMutation = useMutation({
    mutationFn: (periodType: string) => apiRequest("POST", "/api/viewing-analytics/reports/generate", { periodType }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/viewing-analytics/reports"] });
      setReportDialogOpen(false);
      toast({ title: `Generated ${data.reports} reports` });
    },
    onError: () => toast({ title: "Failed to generate report", variant: "destructive" }),
  });

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  if (overviewLoading || popularLoading) {
    return (
      <Layout title="Advanced Analytics" subtitle="Comprehensive viewing analytics">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Advanced Analytics" subtitle="Comprehensive viewing analytics">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Advanced Analytics</h1>
            <p className="text-muted-foreground">Comprehensive viewing analytics and content performance</p>
          </div>
          <div className="flex gap-2">
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-32" data-testid="select-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Last 24h</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/viewing-analytics"] });
              }}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-total-views">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Views</CardTitle>
              <Play className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-views">{formatNumber(overview?.totalViews || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Live: {overview?.liveViews || 0} | VOD: {overview?.vodViews || 0} | Series: {overview?.seriesViews || 0}
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-watch-time">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Watch Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-watch-time">{formatTime(overview?.totalWatchTime || 0)}</div>
              <p className="text-xs text-muted-foreground">
                Avg: {formatTime(overview?.avgWatchTime || 0)} per view
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-unique-viewers">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Unique Viewers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-unique-viewers">{formatNumber(overview?.uniqueViewers || 0)}</div>
              <p className="text-xs text-muted-foreground">
                In selected period
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-content-types">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Content Split</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge className="bg-blue-600">Live {Math.round(((overview?.liveViews || 0) / (overview?.totalViews || 1)) * 100)}%</Badge>
                <Badge className="bg-green-600">VOD {Math.round(((overview?.vodViews || 0) / (overview?.totalViews || 1)) * 100)}%</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                By view count
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="popular" className="space-y-4">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="popular" data-testid="tab-popular">Popular Content</TabsTrigger>
            <TabsTrigger value="geo" data-testid="tab-geo">Geographic</TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-devices">Devices</TabsTrigger>
            <TabsTrigger value="timeline" data-testid="tab-timeline">Timeline</TabsTrigger>
            <TabsTrigger value="reports" data-testid="tab-reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="popular" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Most Popular Content</CardTitle>
                <CardDescription>Top performing content by view count</CardDescription>
              </CardHeader>
              <CardContent>
                {popular.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No viewing data available for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Rank</th>
                          <th className="text-left p-2">Content</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Views</th>
                          <th className="text-left p-2">Watch Time</th>
                          <th className="text-left p-2">Unique Viewers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {popular.map((content, index) => (
                          <tr key={content.contentId} className="border-b" data-testid={`row-popular-${content.contentId}`}>
                            <td className="p-2 font-bold">#{index + 1}</td>
                            <td className="p-2">{content.contentName || `Content ${content.contentId}`}</td>
                            <td className="p-2">
                              <Badge variant={content.contentType === "live" ? "default" : "secondary"}>
                                {content.contentType}
                              </Badge>
                            </td>
                            <td className="p-2">{formatNumber(content.views)}</td>
                            <td className="p-2">{formatTime(content.totalWatchTime)}</td>
                            <td className="p-2">{formatNumber(content.uniqueViewers)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="geo" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Geographic Distribution</CardTitle>
                  <CardDescription>Viewing by country</CardDescription>
                </div>
                <Globe className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {geoData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No geographic data available</p>
                ) : (
                  <div className="space-y-4">
                    {geoData.slice(0, 10).map((geo) => (
                      <div key={geo.country} className="flex items-center justify-between" data-testid={`geo-${geo.country}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{getCountryFlag(geo.country)}</span>
                          <span className="font-medium">{geo.country}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{formatNumber(geo.views)} views</span>
                          <span className="text-muted-foreground">{formatTime(geo.watchTime)}</span>
                          <span className="text-muted-foreground">{geo.uniqueViewers} viewers</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="devices" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Device & Player Distribution</CardTitle>
                  <CardDescription>Viewing by device type and player application</CardDescription>
                </div>
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {deviceData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No device data available</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-4">By Device Type</h4>
                      <div className="space-y-3">
                        {Object.entries(
                          deviceData.reduce((acc, d) => {
                            acc[d.deviceType || "Unknown"] = (acc[d.deviceType || "Unknown"] || 0) + d.views;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([device, views]) => (
                          <div key={device} className="flex items-center justify-between" data-testid={`device-${device}`}>
                            <span>{device}</span>
                            <Badge variant="secondary">{formatNumber(views as number)} views</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-4">By Player</h4>
                      <div className="space-y-3">
                        {Object.entries(
                          deviceData.reduce((acc, d) => {
                            acc[d.player || "Unknown"] = (acc[d.player || "Unknown"] || 0) + d.views;
                            return acc;
                          }, {} as Record<string, number>)
                        ).map(([player, views]) => (
                          <div key={player} className="flex items-center justify-between" data-testid={`player-${player}`}>
                            <span>{player}</span>
                            <Badge variant="secondary">{formatNumber(views as number)} views</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Viewing Timeline</CardTitle>
                  <CardDescription>Daily viewing trends</CardDescription>
                </div>
                <TrendingUp className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {timeline.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No timeline data available</p>
                ) : (
                  <div className="space-y-3">
                    {timeline.map((day) => (
                      <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`timeline-${day.date}`}>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{new Date(day.date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span>{formatNumber(day.views)} views</span>
                          <span className="text-muted-foreground">{formatTime(day.watchTime)}</span>
                          <span className="text-muted-foreground">{day.uniqueViewers} unique</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Content Reports</CardTitle>
                  <CardDescription>Generated performance reports</CardDescription>
                </div>
                <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-generate-report">
                      <FileText className="w-4 h-4 mr-2" /> Generate Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate Performance Report</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Report Period</Label>
                        <Select value={reportPeriod} onValueChange={setReportPeriod}>
                          <SelectTrigger data-testid="select-report-period">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="hourly">Last Hour</SelectItem>
                            <SelectItem value="daily">Last 24 Hours</SelectItem>
                            <SelectItem value="weekly">Last 7 Days</SelectItem>
                            <SelectItem value="monthly">Last 30 Days</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setReportDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => generateReportMutation.mutate(reportPeriod)}
                        disabled={generateReportMutation.isPending}
                        data-testid="button-generate"
                      >
                        {generateReportMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Generate
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No reports generated yet. Click "Generate Report" to create one.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-left p-2">Period</th>
                          <th className="text-left p-2">Content</th>
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Views</th>
                          <th className="text-left p-2">Viewers</th>
                          <th className="text-left p-2">Watch Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reports.slice(0, 20).map((report) => (
                          <tr key={report.id} className="border-b" data-testid={`report-${report.id}`}>
                            <td className="p-2">{new Date(report.reportDate).toLocaleDateString()}</td>
                            <td className="p-2"><Badge variant="outline">{report.periodType}</Badge></td>
                            <td className="p-2">{report.contentName}</td>
                            <td className="p-2"><Badge variant="secondary">{report.contentType}</Badge></td>
                            <td className="p-2">{formatNumber(report.totalViews)}</td>
                            <td className="p-2">{formatNumber(report.uniqueViewers)}</td>
                            <td className="p-2">{formatTime(report.totalWatchTime)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function getCountryFlag(countryCode: string) {
  const flags: Record<string, string> = {
    "US": "🇺🇸", "UK": "🇬🇧", "GB": "🇬🇧", "CA": "🇨🇦", "AU": "🇦🇺",
    "DE": "🇩🇪", "FR": "🇫🇷", "ES": "🇪🇸", "IT": "🇮🇹", "NL": "🇳🇱",
    "BR": "🇧🇷", "MX": "🇲🇽", "JP": "🇯🇵", "KR": "🇰🇷", "CN": "🇨🇳",
    "IN": "🇮🇳", "RU": "🇷🇺", "SA": "🇸🇦", "AE": "🇦🇪", "TR": "🇹🇷",
  };
  return flags[countryCode?.toUpperCase()] || "🌍";
}
