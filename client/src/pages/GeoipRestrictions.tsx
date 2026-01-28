import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Globe, Search, Settings, Shield, MapPin, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "IN", name: "India" },
  { code: "RU", name: "Russia" },
  { code: "CN", name: "China" },
];

interface GeoipSettings {
  id: number;
  enabled: boolean;
  defaultAction: string;
  providerType: string;
  apiKey: string | null;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  logEnabled: boolean;
}

interface GeoipLog {
  id: number;
  lineId: number | null;
  ipAddress: string;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  action: string;
  reason: string | null;
  createdAt: string;
}

interface GeoipStats {
  last24h: { allowed: number; blocked: number; total: number };
  byCountry: Record<string, { allowed: number; blocked: number }>;
}

interface LookupResult {
  status: string;
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
}

export default function GeoipRestrictions() {
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [lookupIp, setLookupIp] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const { data: settings, isLoading: settingsLoading } = useQuery<GeoipSettings>({
    queryKey: ["/api/geoip/settings"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<GeoipLog[]>({
    queryKey: ["/api/geoip/logs"],
  });

  const { data: stats } = useQuery<GeoipStats>({
    queryKey: ["/api/geoip/stats"],
  });

  const { data: lines = [] } = useQuery<any[]>({
    queryKey: ["/api/lines"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<GeoipSettings>) => apiRequest("PUT", "/api/geoip/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/geoip/settings"] });
      setSettingsDialogOpen(false);
      toast({ title: "GeoIP settings updated" });
    },
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const lookupMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await apiRequest("GET", `/api/geoip/lookup/${ip}`);
      return res.json() as Promise<LookupResult>;
    },
    onSuccess: (result) => {
      setLookupResult(result);
    },
    onError: () => toast({ title: "Failed to lookup IP", variant: "destructive" }),
  });

  const updateLineGeoMutation = useMutation({
    mutationFn: (data: { lineId: number; allowedCountries: string[] }) =>
      apiRequest("PUT", `/api/geoip/lines/${data.lineId}`, { allowedCountries: data.allowedCountries }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({ title: "Line GeoIP restrictions updated" });
      setSelectedLineId(null);
    },
    onError: () => toast({ title: "Failed to update restrictions", variant: "destructive" }),
  });

  const handleSettingsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSettingsMutation.mutate({
      enabled: formData.get("enabled") === "on",
      defaultAction: formData.get("defaultAction") as string,
      providerType: formData.get("providerType") as string,
      apiKey: formData.get("apiKey") as string || null,
      cacheEnabled: formData.get("cacheEnabled") === "on",
      cacheTtlSeconds: Number(formData.get("cacheTtlSeconds")),
      logEnabled: formData.get("logEnabled") === "on",
    });
  };

  const handleLookup = () => {
    if (lookupIp) {
      lookupMutation.mutate(lookupIp);
    }
  };

  const toggleCountry = (code: string) => {
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  if (settingsLoading) {
    return (
      <Layout title="GeoIP Restrictions">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="GeoIP Restrictions">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">GeoIP Restrictions</h1>
            <p className="text-muted-foreground">Control access based on geographic location</p>
          </div>
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-geoip-settings">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>GeoIP Settings</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSettingsSubmit} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch name="enabled" defaultChecked={settings?.enabled} />
                  <Label>Enable GeoIP Restrictions</Label>
                </div>
                <div>
                  <Label>Default Action</Label>
                  <Select name="defaultAction" defaultValue={settings?.defaultAction || "allow"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow (whitelist mode)</SelectItem>
                      <SelectItem value="block">Block (blacklist mode)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Provider</Label>
                  <Select name="providerType" defaultValue={settings?.providerType || "maxmind"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maxmind">MaxMind GeoLite2</SelectItem>
                      <SelectItem value="ip-api">ip-api.com (Free)</SelectItem>
                      <SelectItem value="ipinfo">IPinfo.io</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>API Key (if required)</Label>
                  <Input name="apiKey" type="password" defaultValue={settings?.apiKey || ""} placeholder="Optional for paid providers" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch name="cacheEnabled" defaultChecked={settings?.cacheEnabled} />
                  <Label>Enable Caching</Label>
                </div>
                <div>
                  <Label>Cache TTL (seconds)</Label>
                  <Input name="cacheTtlSeconds" type="number" defaultValue={settings?.cacheTtlSeconds || 86400} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch name="logEnabled" defaultChecked={settings?.logEnabled} />
                  <Label>Enable Logging</Label>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Settings
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge className={settings?.enabled ? "bg-green-500" : "bg-gray-500"}>
                {settings?.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Allowed (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats?.last24h?.allowed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Blocked (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats?.last24h?.blocked || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Checks (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.last24h?.total || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="lookup">
          <TabsList>
            <TabsTrigger value="lookup" data-testid="tab-lookup">IP Lookup</TabsTrigger>
            <TabsTrigger value="lines" data-testid="tab-lines">Line Restrictions</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">Logs</TabsTrigger>
            <TabsTrigger value="stats" data-testid="tab-stats">Statistics</TabsTrigger>
          </TabsList>

          <TabsContent value="lookup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>IP Geolocation Lookup</CardTitle>
                <CardDescription>Look up geographic information for an IP address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={lookupIp}
                    onChange={(e) => setLookupIp(e.target.value)}
                    placeholder="Enter IP address (e.g., 8.8.8.8)"
                    data-testid="input-lookup-ip"
                  />
                  <Button onClick={handleLookup} disabled={lookupMutation.isPending} data-testid="button-lookup">
                    {lookupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                    Lookup
                  </Button>
                </div>
                {lookupResult && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Country</Label>
                        <p className="font-medium">{lookupResult.country} ({lookupResult.countryCode})</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Region</Label>
                        <p className="font-medium">{lookupResult.regionName}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">City</Label>
                        <p className="font-medium">{lookupResult.city}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">ZIP</Label>
                        <p className="font-medium">{lookupResult.zip}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">ISP</Label>
                        <p className="font-medium">{lookupResult.isp}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Organization</Label>
                        <p className="font-medium">{lookupResult.org}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Timezone</Label>
                        <p className="font-medium">{lookupResult.timezone}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Coordinates</Label>
                        <p className="font-medium">{lookupResult.lat}, {lookupResult.lon}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lines" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Line GeoIP Restrictions</CardTitle>
                <CardDescription>Configure country-based access restrictions per line</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Select Line</Label>
                    <Select
                      value={selectedLineId?.toString() || ""}
                      onValueChange={(v) => {
                        setSelectedLineId(Number(v));
                        const line = lines.find(l => l.id === Number(v));
                        setSelectedCountries(line?.allowedCountries || []);
                      }}
                    >
                      <SelectTrigger data-testid="select-line">
                        <SelectValue placeholder="Select a line" />
                      </SelectTrigger>
                      <SelectContent>
                        {lines.map((line) => (
                          <SelectItem key={line.id} value={line.id.toString()}>
                            {line.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedLineId && (
                    <>
                      <div>
                        <Label>Allowed Countries (leave empty to allow all)</Label>
                        <div className="grid grid-cols-4 gap-2 mt-2">
                          {COUNTRIES.map((country) => (
                            <Button
                              key={country.code}
                              variant={selectedCountries.includes(country.code) ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleCountry(country.code)}
                              data-testid={`button-country-${country.code}`}
                            >
                              {country.code} - {country.name}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => updateLineGeoMutation.mutate({ lineId: selectedLineId, allowedCountries: selectedCountries })}
                          disabled={updateLineGeoMutation.isPending}
                          data-testid="button-save-restrictions"
                        >
                          {updateLineGeoMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Save Restrictions
                        </Button>
                        <Button variant="outline" onClick={() => setSelectedCountries([])} data-testid="button-clear-countries">
                          Clear All
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Time</th>
                    <th className="p-3 text-left">IP Address</th>
                    <th className="p-3 text-left">Country</th>
                    <th className="p-3 text-left">Action</th>
                    <th className="p-3 text-left">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr><td colSpan={5} className="p-4 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No logs yet</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="border-b" data-testid={`row-log-${log.id}`}>
                      <td className="p-3">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-mono">{log.ipAddress}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <Globe className="w-4 h-4" />
                          {log.countryCode || "Unknown"}
                        </div>
                      </td>
                      <td className="p-3">
                        {log.action === "allowed" ? (
                          <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Allowed</Badge>
                        ) : (
                          <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Blocked</Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Traffic by Country (Last 24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {stats?.byCountry && Object.keys(stats.byCountry).length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(stats.byCountry).map(([country, data]) => (
                      <div key={country} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4" />
                          <span className="font-medium">{country}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-green-500">{data.allowed} allowed</span>
                          <span className="text-red-500">{data.blocked} blocked</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground">No statistics available</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}