import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Search, Trash2, Loader2, Shield, Database, Plus, Settings, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface VpnSettings {
  id: number;
  enabled: boolean;
  provider: string;
  apiKey: string | null;
  blockVpn: boolean;
  blockProxy: boolean;
  blockDatacenter: boolean;
  blockTor: boolean;
  cacheHours: number;
  whitelistedIps: string[];
}

interface VpnLog {
  id: number;
  ip: string;
  isVpn: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  isTor: boolean;
  provider: string | null;
  isp: string | null;
  country: string | null;
  blocked: boolean;
  lineId: number | null;
  createdAt: string;
}

interface IpRange {
  id: number;
  startIp: string;
  endIp: string;
  rangeType: string;
  provider: string | null;
  description: string | null;
  createdAt: string;
}

interface LookupResult {
  ip: string;
  isVpn: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  isTor: boolean;
  provider?: string;
  isp?: string;
  country?: string;
  cached: boolean;
}

export default function VpnDetection() {
  const [lookupIp, setLookupIp] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);

  const { data: settings, isLoading: settingsLoading } = useQuery<VpnSettings>({
    queryKey: ["/api/vpn-detection/settings"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<VpnLog[]>({
    queryKey: ["/api/vpn-detection/logs"],
  });

  const { data: ranges = [], isLoading: rangesLoading } = useQuery<IpRange[]>({
    queryKey: ["/api/vpn-detection/ranges"],
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<VpnSettings>) => apiRequest("PUT", "/api/vpn-detection/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn-detection/settings"] });
      setSettingsDialogOpen(false);
      toast({ title: "VPN detection settings updated" });
    },
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const lookupMutation = useMutation({
    mutationFn: async (ip: string) => {
      const res = await apiRequest("GET", `/api/vpn-detection/lookup/${ip}`);
      return res.json() as Promise<LookupResult>;
    },
    onSuccess: (result: LookupResult) => {
      setLookupResult(result);
    },
    onError: () => toast({ title: "Failed to lookup IP", variant: "destructive" }),
  });

  const addRangeMutation = useMutation({
    mutationFn: (data: { startIp: string; endIp: string; rangeType: string; provider?: string; description?: string }) =>
      apiRequest("POST", "/api/vpn-detection/ranges", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn-detection/ranges"] });
      setRangeDialogOpen(false);
      toast({ title: "IP range added" });
    },
    onError: () => toast({ title: "Failed to add range", variant: "destructive" }),
  });

  const deleteRangeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vpn-detection/ranges/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn-detection/ranges"] });
      toast({ title: "IP range deleted" });
    },
    onError: () => toast({ title: "Failed to delete range", variant: "destructive" }),
  });

  const clearLogsMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/vpn-detection/logs"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vpn-detection/logs"] });
      toast({ title: "Detection logs cleared" });
    },
    onError: () => toast({ title: "Failed to clear logs", variant: "destructive" }),
  });

  const clearCacheMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/vpn-detection/clear-cache"),
    onSuccess: () => {
      toast({ title: "IP cache cleared" });
    },
    onError: () => toast({ title: "Failed to clear cache", variant: "destructive" }),
  });

  const handleLookup = () => {
    if (lookupIp) {
      lookupMutation.mutate(lookupIp);
    }
  };

  const handleSettingsSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateSettingsMutation.mutate({
      enabled: formData.get("enabled") === "on",
      provider: formData.get("provider") as string,
      apiKey: formData.get("apiKey") as string || null,
      blockVpn: formData.get("blockVpn") === "on",
      blockProxy: formData.get("blockProxy") === "on",
      blockDatacenter: formData.get("blockDatacenter") === "on",
      blockTor: formData.get("blockTor") === "on",
      cacheHours: parseInt(formData.get("cacheHours") as string) || 24,
      whitelistedIps: (formData.get("whitelistedIps") as string).split("\n").filter(Boolean),
    });
  };

  const handleRangeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    addRangeMutation.mutate({
      startIp: formData.get("startIp") as string,
      endIp: formData.get("endIp") as string,
      rangeType: formData.get("rangeType") as string,
      provider: formData.get("provider") as string || undefined,
      description: formData.get("description") as string || undefined,
    });
  };

  return (
    <Layout
      title="VPN/Proxy Detection"
      subtitle="Block VPN, proxy, and datacenter connections from accessing streams"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={settings?.enabled ? "default" : "secondary"}>
              {settings?.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Provider: {settings?.provider || "local"}
            </span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => clearCacheMutation.mutate()} disabled={clearCacheMutation.isPending}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear Cache
            </Button>
            <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" data-testid="button-vpn-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>VPN Detection Settings</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSettingsSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Enable VPN Detection</Label>
                    <Switch id="enabled" name="enabled" defaultChecked={settings?.enabled} />
                  </div>
                  <div className="space-y-2">
                    <Label>Detection Provider</Label>
                    <Select name="provider" defaultValue={settings?.provider || "local"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Database</SelectItem>
                        <SelectItem value="ip-api">ip-api.com (Free)</SelectItem>
                        <SelectItem value="proxycheck">proxycheck.io</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key (if required)</Label>
                    <Input id="apiKey" name="apiKey" type="password" defaultValue={settings?.apiKey || ""} placeholder="Enter API key" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="blockVpn">Block VPN</Label>
                      <Switch id="blockVpn" name="blockVpn" defaultChecked={settings?.blockVpn} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="blockProxy">Block Proxy</Label>
                      <Switch id="blockProxy" name="blockProxy" defaultChecked={settings?.blockProxy} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="blockDatacenter">Block Datacenter</Label>
                      <Switch id="blockDatacenter" name="blockDatacenter" defaultChecked={settings?.blockDatacenter} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="blockTor">Block Tor</Label>
                      <Switch id="blockTor" name="blockTor" defaultChecked={settings?.blockTor} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cacheHours">Cache Duration (hours)</Label>
                    <Input id="cacheHours" name="cacheHours" type="number" min="1" max="720" defaultValue={settings?.cacheHours || 24} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whitelistedIps">Whitelisted IPs (one per line)</Label>
                    <textarea
                      id="whitelistedIps"
                      name="whitelistedIps"
                      className="w-full h-24 px-3 py-2 text-sm rounded-md border border-input bg-background"
                      defaultValue={settings?.whitelistedIps?.join("\n") || ""}
                      placeholder="1.2.3.4&#10;5.6.7.8"
                    />
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
        </div>

        <Tabs defaultValue="lookup" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lookup" data-testid="tab-lookup">IP Lookup</TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">Detection Logs</TabsTrigger>
            <TabsTrigger value="ranges" data-testid="tab-ranges">IP Ranges</TabsTrigger>
          </TabsList>

          <TabsContent value="lookup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  IP Address Lookup
                </CardTitle>
                <CardDescription>Check if an IP address is a VPN, proxy, or datacenter</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter IP address (e.g., 8.8.8.8)"
                    value={lookupIp}
                    onChange={(e) => setLookupIp(e.target.value)}
                    data-testid="input-ip-lookup"
                    id="ip-lookup"
                  />
                  <Button onClick={handleLookup} disabled={lookupMutation.isPending || !lookupIp} data-testid="button-lookup">
                    {lookupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </Button>
                </div>
                {lookupResult && (
                  <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{lookupResult.ip}</span>
                      {lookupResult.cached && <Badge variant="outline">Cached</Badge>}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={lookupResult.isVpn ? "destructive" : "secondary"}>
                          VPN: {lookupResult.isVpn ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={lookupResult.isProxy ? "destructive" : "secondary"}>
                          Proxy: {lookupResult.isProxy ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={lookupResult.isDatacenter ? "destructive" : "secondary"}>
                          Datacenter: {lookupResult.isDatacenter ? "Yes" : "No"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={lookupResult.isTor ? "destructive" : "secondary"}>
                          Tor: {lookupResult.isTor ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                    {(lookupResult.isp || lookupResult.country || lookupResult.provider) && (
                      <div className="text-sm text-muted-foreground space-y-1">
                        {lookupResult.isp && <p>ISP: {lookupResult.isp}</p>}
                        {lookupResult.country && <p>Country: {lookupResult.country}</p>}
                        {lookupResult.provider && <p>VPN Provider: {lookupResult.provider}</p>}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => clearLogsMutation.mutate()} disabled={clearLogsMutation.isPending}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear Logs
              </Button>
            </div>
            {logsLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <Alert>
                <AlertDescription>No detection logs yet. Logs will appear when VPN/proxy connections are detected.</AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/30">
                    <tr>
                      <th className="px-4 py-3 text-left">IP Address</th>
                      <th className="px-4 py-3 text-left">Detection</th>
                      <th className="px-4 py-3 text-left">Details</th>
                      <th className="px-4 py-3 text-left">Blocked</th>
                      <th className="px-4 py-3 text-left">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t border-secondary/30">
                        <td className="px-4 py-3 font-mono">{log.ip}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {log.isVpn && <Badge variant="destructive" className="text-xs">VPN</Badge>}
                            {log.isProxy && <Badge variant="destructive" className="text-xs">Proxy</Badge>}
                            {log.isDatacenter && <Badge variant="destructive" className="text-xs">DC</Badge>}
                            {log.isTor && <Badge variant="destructive" className="text-xs">Tor</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {log.provider && <span>{log.provider}</span>}
                          {log.country && <span> ({log.country})</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={log.blocked ? "destructive" : "secondary"}>
                            {log.blocked ? "Blocked" : "Logged"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranges" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-range">
                    <Plus className="w-4 h-4 mr-2" />
                    Add IP Range
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add IP Range</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleRangeSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startIp">Start IP</Label>
                        <Input id="startIp" name="startIp" required placeholder="1.2.3.0" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endIp">End IP</Label>
                        <Input id="endIp" name="endIp" required placeholder="1.2.3.255" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Range Type</Label>
                      <Select name="rangeType" defaultValue="vpn">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vpn">VPN</SelectItem>
                          <SelectItem value="proxy">Proxy</SelectItem>
                          <SelectItem value="datacenter">Datacenter</SelectItem>
                          <SelectItem value="tor">Tor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="provider">Provider Name (optional)</Label>
                      <Input id="provider" name="provider" placeholder="e.g., NordVPN, AWS" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Input id="description" name="description" placeholder="e.g., Known VPN exit nodes" />
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={addRangeMutation.isPending}>
                        {addRangeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Add Range
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            {rangesLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : ranges.length === 0 ? (
              <Alert>
                <Database className="w-4 h-4" />
                <AlertDescription>No IP ranges defined. Add ranges for local VPN/proxy detection.</AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/30">
                    <tr>
                      <th className="px-4 py-3 text-left">IP Range</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Provider</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranges.map((range) => (
                      <tr key={range.id} className="border-t border-secondary/30">
                        <td className="px-4 py-3 font-mono">{range.startIp} - {range.endIp}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="capitalize">{range.rangeType}</Badge>
                        </td>
                        <td className="px-4 py-3">{range.provider || "-"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{range.description || "-"}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteRangeMutation.mutate(range.id)}
                            disabled={deleteRangeMutation.isPending}
                            data-testid={`button-delete-range-${range.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
