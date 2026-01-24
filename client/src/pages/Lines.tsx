import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLines, useCreateLine, useDeleteLine, useUpdateLine, useBulkDeleteLines, useBulkToggleLines } from "@/hooks/use-lines";
import { useBouquets } from "@/hooks/use-bouquets";
import { useServers } from "@/hooks/use-servers";
import { usePackages } from "@/hooks/use-packages";
import { useUsers } from "@/hooks/use-users";
import { Plus, Trash2, Edit2, User, Calendar, Search, Globe, Smartphone, Shield, Server, Package, Loader2, Power, PowerOff, Eye, EyeOff, Clock, Download, FileText, FileSpreadsheet, Music } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertLineSchema, type InsertLine, type Line } from "@shared/schema";
import { format, addMonths, addDays } from "date-fns";

function LineForm({ onSubmit, bouquets, servers, packages, users, isLoading, initialData }: { 
  onSubmit: (data: InsertLine) => void, 
  bouquets: any[], 
  servers: any[],
  packages: any[],
  users: any[],
  isLoading: boolean,
  initialData?: Partial<InsertLine>
}) {
  const form = useForm<InsertLine>({
    resolver: zodResolver(insertLineSchema),
    defaultValues: {
      maxConnections: initialData?.maxConnections || 1,
      enabled: initialData?.enabled ?? true,
      adminEnabled: initialData?.adminEnabled ?? true,
      isTrial: initialData?.isTrial ?? false,
      username: initialData?.username || "",
      password: initialData?.password || "",
      allowedIps: initialData?.allowedIps || [],
      allowedCountries: initialData?.allowedCountries || [],
      allowedUserAgents: initialData?.allowedUserAgents || [],
      allowedDomains: initialData?.allowedDomains || [],
      allowedOutputs: initialData?.allowedOutputs || ["m3u8", "ts"],
      bouquets: initialData?.bouquets || [],
    }
  });

  const [selectedBouquets, setSelectedBouquets] = useState<number[]>(initialData?.bouquets || []);
  const [bouquetType, setBouquetType] = useState<"all" | "selected">(
    initialData?.bouquets && initialData.bouquets.length > 0 ? "selected" : "all"
  );
  const [connectionLimitType, setConnectionLimitType] = useState<"package" | "custom">("custom");
  const [noExpiration, setNoExpiration] = useState(!initialData?.expDate);
  const [showPassword, setShowPassword] = useState(false);
  
  const [allowedIpsText, setAllowedIpsText] = useState((initialData?.allowedIps || []).join(", "));
  const [allowedCountriesText, setAllowedCountriesText] = useState((initialData?.allowedCountries || []).join(", "));
  const [allowedUserAgentsText, setAllowedUserAgentsText] = useState((initialData?.allowedUserAgents || []).join("\n"));
  const [allowedDomainsText, setAllowedDomainsText] = useState((initialData?.allowedDomains || []).join(", "));

  // Output formats state
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>(initialData?.allowedOutputs || ["m3u8", "ts"]);

  const handleQuickDuration = (months: number) => {
    const newDate = addMonths(new Date(), months);
    form.setValue("expDate", newDate.toISOString().slice(0, 16) as any);
    setNoExpiration(false);
  };

  const toggleOutput = (output: string) => {
    setSelectedOutputs(prev => 
      prev.includes(output) 
        ? prev.filter(o => o !== output)
        : [...prev, output]
    );
  };

  const handleFormSubmit = (data: InsertLine) => {
    console.log("[LineForm] Form submitted with data:", data);
    
    // Handle bouquet selection
    const finalBouquets = bouquetType === "all" ? [] : selectedBouquets;
    
    const formData = {
      ...data,
      expDate: noExpiration ? undefined : (data.expDate ? new Date(data.expDate) : undefined),
      bouquets: finalBouquets,
      allowedIps: allowedIpsText.split(',').map(s => s.trim()).filter(Boolean),
      allowedCountries: allowedCountriesText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      allowedUserAgents: allowedUserAgentsText.split('\n').map(s => s.trim()).filter(Boolean),
      allowedDomains: allowedDomainsText.split(',').map(s => s.trim()).filter(Boolean),
      allowedOutputs: selectedOutputs,
    };
    
    console.log("[LineForm] Formatted data:", formData);
    onSubmit(formData);
  };

  return (
    <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          {/* Username and Password */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input id="username" {...form.register("username")} placeholder="john_doe" data-testid="input-line-username" />
              {form.formState.errors.username && <p className="text-red-500 text-xs">{form.formState.errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")} 
                  placeholder="Secr3t!" 
                  data-testid="input-line-password" 
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {form.formState.errors.password && <p className="text-red-500 text-xs">{form.formState.errors.password.message}</p>}
            </div>
          </div>

          {/* Owner/Member Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Owner / Member
            </Label>
            <Select onValueChange={(val) => form.setValue("memberId", val === "none" ? undefined : parseInt(val))}>
              <SelectTrigger data-testid="select-owner">
                <SelectValue placeholder="No owner (admin-owned)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No owner (admin-owned)</SelectItem>
                {users.filter(u => u.role === 'reseller').map((user: any) => (
                  <SelectItem key={user.id} value={String(user.id)}>{user.username}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Package Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Package
            </Label>
            <Select onValueChange={(val) => form.setValue("packageId", val === "none" ? undefined : parseInt(val))}>
              <SelectTrigger data-testid="select-package">
                <SelectValue placeholder="No package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No package</SelectItem>
                {packages.map((pkg: any) => (
                  <SelectItem key={pkg.id} value={String(pkg.id)}>
                    {pkg.packageName} - {pkg.durationDays} days - {pkg.maxConnections} conn
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Connection Limit */}
          <div className="space-y-3">
            <Label>Connection Limit</Label>
            <RadioGroup value={connectionLimitType} onValueChange={(v: any) => setConnectionLimitType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="package" id="conn-package" />
                <Label htmlFor="conn-package" className="font-normal">Use package default</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="conn-custom" />
                <Label htmlFor="conn-custom" className="font-normal">Custom value</Label>
              </div>
            </RadioGroup>
            {connectionLimitType === "custom" && (
              <Input 
                type="number" 
                {...form.register("maxConnections", { valueAsNumber: true })} 
                data-testid="input-max-connections"
                min="1"
              />
            )}
          </div>

          {/* Expiration Date */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Expiration Date
            </Label>
            <div className="flex items-center gap-2 mb-2">
              <Checkbox 
                checked={noExpiration} 
                onCheckedChange={(checked) => setNoExpiration(checked as boolean)}
              />
              <Label className="font-normal">No expiration</Label>
            </div>
            {!noExpiration && (
              <>
                <Input 
                  type="datetime-local" 
                  {...form.register("expDate")}
                  data-testid="input-exp-date"
                />
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" size="sm" variant="outline" onClick={() => handleQuickDuration(1)}>
                    <Clock className="w-3 h-3 mr-1" /> 1 Month
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleQuickDuration(3)}>
                    <Clock className="w-3 h-3 mr-1" /> 3 Months
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleQuickDuration(6)}>
                    <Clock className="w-3 h-3 mr-1" /> 6 Months
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleQuickDuration(12)}>
                    <Clock className="w-3 h-3 mr-1" /> 1 Year
                  </Button>
                </div>
              </>
            )}
          </div>

          {/* Bouquets */}
          <div className="space-y-3">
            <Label>Bouquets</Label>
            <RadioGroup value={bouquetType} onValueChange={(v: any) => setBouquetType(v)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="bouquet-all" />
                <Label htmlFor="bouquet-all" className="font-normal">All bouquets (grant access to all)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selected" id="bouquet-selected" />
                <Label htmlFor="bouquet-selected" className="font-normal">Selected bouquets only</Label>
              </div>
            </RadioGroup>
            
            {bouquetType === "selected" && (
              <div className="p-3 border border-white/10 rounded-md bg-background/50 max-h-40 overflow-y-auto">
                {bouquets.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No bouquets available</p>
                ) : (
                  <div className="space-y-2">
                    {bouquets.map((bouquet: any) => (
                      <div key={bouquet.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`bouquet-${bouquet.id}`}
                          checked={selectedBouquets.includes(bouquet.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBouquets([...selectedBouquets, bouquet.id]);
                            } else {
                              setSelectedBouquets(selectedBouquets.filter(id => id !== bouquet.id));
                            }
                          }}
                        />
                        <Label htmlFor={`bouquet-${bouquet.id}`} className="text-sm font-normal">{bouquet.bouquetName}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Enabled and Trial Toggles */}
          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch 
                checked={form.watch("enabled") ?? true} 
                onCheckedChange={(checked) => form.setValue("enabled", checked)} 
                data-testid="switch-enabled"
              />
              <Label>Enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={form.watch("isTrial") ?? false} 
                onCheckedChange={(checked) => form.setValue("isTrial", checked)} 
                data-testid="switch-trial"
              />
              <Label>Trial Account</Label>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Allowed Countries (GeoIP)
            </Label>
            <Input 
              value={allowedCountriesText}
              onChange={(e) => setAllowedCountriesText(e.target.value)}
              placeholder="US, UK, CA (leave empty for all)"
              data-testid="input-allowed-countries"
            />
            <p className="text-xs text-muted-foreground">Comma-separated country codes (e.g., US, UK, CA). Leave empty to allow all countries.</p>
          </div>

          <div className="space-y-2">
            <Label>Forced Country (Override GeoIP)</Label>
            <Input 
              {...form.register("forcedCountry")}
              placeholder="US"
              maxLength={2}
              data-testid="input-forced-country"
            />
            <p className="text-xs text-muted-foreground">Force a specific country code for this line, ignoring actual GeoIP.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Allowed IPs
            </Label>
            <Input 
              value={allowedIpsText}
              onChange={(e) => setAllowedIpsText(e.target.value)}
              placeholder="192.168.1.1, 10.0.0.1 (leave empty for all)"
              data-testid="input-allowed-ips"
            />
            <p className="text-xs text-muted-foreground">Comma-separated IP addresses. Leave empty to allow all IPs.</p>
          </div>

          <div className="space-y-2">
            <Label>ISP Lock</Label>
            <Input 
              {...form.register("ispLock")}
              placeholder="Comcast, AT&T"
              data-testid="input-isp-lock"
            />
            <p className="text-xs text-muted-foreground">Lock this line to specific ISP(s). Leave empty to allow all ISPs.</p>
          </div>

          <div className="space-y-2">
            <Label>Allowed Domains (Web Players)</Label>
            <Input 
              value={allowedDomainsText}
              onChange={(e) => setAllowedDomainsText(e.target.value)}
              placeholder="example.com, mysite.com"
              data-testid="input-allowed-domains"
            />
            <p className="text-xs text-muted-foreground">Comma-separated domains allowed to play this line. Leave empty to allow all.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Locked Device ID
            </Label>
            <Input 
              {...form.register("lockedDeviceId")}
              placeholder="Device ID to lock account to"
              data-testid="input-locked-device"
            />
            <p className="text-xs text-muted-foreground">Lock this line to a specific device ID.</p>
          </div>

          <div className="space-y-2">
            <Label>Locked MAC Address</Label>
            <Input 
              {...form.register("lockedMac")}
              placeholder="00:1A:79:XX:XX:XX"
              data-testid="input-locked-mac"
            />
            <p className="text-xs text-muted-foreground">Lock this line to a specific MAC address.</p>
          </div>

          <div className="space-y-2">
            <Label>Allowed User-Agents</Label>
            <Textarea 
              value={allowedUserAgentsText}
              onChange={(e) => setAllowedUserAgentsText(e.target.value)}
              placeholder="VLC&#10;Kodi&#10;TiviMate"
              rows={3}
              data-testid="input-allowed-user-agents"
            />
            <p className="text-xs text-muted-foreground">One user-agent per line. Leave empty to allow all.</p>
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Force Server
            </Label>
            <Select onValueChange={(val) => form.setValue("forcedServerId", val === "auto" ? undefined : parseInt(val))}>
              <SelectTrigger data-testid="select-force-server">
                <SelectValue placeholder="Auto-select best server" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-select best server</SelectItem>
                {servers.map((server: any) => (
                  <SelectItem key={server.id} value={String(server.id)}>
                    {server.serverName} ({server.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Output Formats</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedOutputs.includes("m3u8")}
                  onCheckedChange={() => toggleOutput("m3u8")}
                />
                <Label className="font-normal">M3U8 (HLS - Recommended for browsers)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedOutputs.includes("ts")}
                  onCheckedChange={() => toggleOutput("ts")}
                />
                <Label className="font-normal">TS (MPEG-TS - For VLC, Kodi, etc.)</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedOutputs.includes("rtmp")}
                  onCheckedChange={() => toggleOutput("rtmp")}
                />
                <Label className="font-normal">RTMP (Real-Time Messaging Protocol)</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Select allowed output formats for this line.</p>
          </div>

          <div className="space-y-2">
            <Label>Play Token (Optional)</Label>
            <Input 
              {...form.register("playToken")}
              placeholder="Custom secure token"
              data-testid="input-play-token"
            />
            <p className="text-xs text-muted-foreground">Custom token required for playback (leave empty to disable).</p>
          </div>

          <div className="space-y-2">
            <Label>Admin Notes</Label>
            <Textarea 
              {...form.register("adminNotes")}
              placeholder="Internal notes about this line (visible to admins only)"
              data-testid="input-admin-notes"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Reseller Notes</Label>
            <Textarea 
              {...form.register("resellerNotes")}
              placeholder="Notes visible to reseller"
              data-testid="input-reseller-notes"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch 
              checked={form.watch("adminEnabled") ?? true} 
              onCheckedChange={(checked) => form.setValue("adminEnabled", checked)} 
            />
            <Label>Admin Enabled (Separate admin toggle)</Label>
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-submit-line">
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isLoading ? "Saving..." : (initialData ? "Save Changes" : "Create Line")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Lines() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editLine, setEditLine] = useState<Line | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const { data: lines, isLoading } = useLines();
  const { data: bouquets } = useBouquets();
  const { data: servers } = useServers();
  const { data: packages } = usePackages();
  const { data: users } = useUsers();
  const createLine = useCreateLine();
  const deleteLine = useDeleteLine();
  const updateLine = useUpdateLine();
  const bulkDelete = useBulkDeleteLines();
  const bulkToggle = useBulkToggleLines();

  const handleCreate = async (data: InsertLine) => {
    try {
      console.log("[Lines] Creating line with data:", data);
      const result = await createLine.mutateAsync(data);
      console.log("[Lines] Line created successfully:", result);
      toast({ title: "Success", description: "Line created successfully" });
      setIsCreateOpen(false);
    } catch (error) {
      console.error("[Lines] Failed to create line:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create line";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleUpdate = async (data: InsertLine) => {
    if (!editLine) return;
    try {
      await updateLine.mutateAsync({ id: editLine.id, ...data });
      toast({ title: "Success", description: "Line updated successfully" });
      setEditLine(null);
    } catch (error) {
      toast({ title: "Error", description: "Failed to update line", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this user line permanently?")) {
      await deleteLine.mutateAsync(id);
      toast({ title: "Deleted", description: "Line removed" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (confirm(`Delete ${selectedIds.length} selected lines?`)) {
      try {
        await bulkDelete.mutateAsync(selectedIds);
        toast({ title: "Success", description: `${selectedIds.length} lines deleted` });
        setSelectedIds([]);
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete lines", variant: "destructive" });
      }
    }
  };

  const handleBulkToggle = async (enabled: boolean) => {
    if (selectedIds.length === 0) return;
    try {
      await bulkToggle.mutateAsync({ ids: selectedIds, enabled });
      toast({ title: "Success", description: `${selectedIds.length} lines ${enabled ? 'enabled' : 'disabled'}` });
      setSelectedIds([]);
    } catch (error) {
      toast({ title: "Error", description: "Failed to toggle lines", variant: "destructive" });
    }
  };

  const handleExport = async (format: 'csv' | 'excel' | 'm3u') => {
    try {
      const response = await fetch(`/api/lines/export/${format}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let filename;
      if (format === 'excel') {
        filename = `lines_export_${Date.now()}.xlsx`;
      } else if (format === 'm3u') {
        filename = `lines_playlist_${Date.now()}.m3u`;
      } else {
        filename = `lines_export_${Date.now()}.csv`;
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Success", description: `Lines exported to ${format.toUpperCase()}` });
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || `Failed to export lines`,
        variant: "destructive" 
      });
    }
  };

  const toggleSelectAll = () => {
    if (!filteredLines) return;
    if (selectedIds.length === filteredLines.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLines.map(l => l.id));
    }
  };

  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const filteredLines = lines?.filter(line => 
    line.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.password.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout 
      title="Manage Lines"
      actions={
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <>
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => handleBulkToggle(true)}
                disabled={bulkToggle.isPending}
                data-testid="button-bulk-enable"
              >
                <Power className="w-4 h-4" /> Enable ({selectedIds.length})
              </Button>
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => handleBulkToggle(false)}
                disabled={bulkToggle.isPending}
                data-testid="button-bulk-disable"
              >
                <PowerOff className="w-4 h-4" /> Disable
              </Button>
              <Button 
                variant="destructive" 
                className="gap-2" 
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
                data-testid="button-bulk-delete"
              >
                {bulkDelete.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </Button>
            </>
          )}
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => handleExport('csv')}
            data-testid="button-export-csv"
          >
            <FileText className="w-4 h-4" /> CSV
          </Button>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => handleExport('excel')}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => handleExport('m3u')}
            data-testid="button-export-m3u"
          >
            <Music className="w-4 h-4" /> M3U
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary gap-2" data-testid="button-add-line">
                <Plus className="w-4 h-4" /> Create Line
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-card border-white/10 text-white max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Create New Line</DialogTitle>
              </DialogHeader>
              <LineForm 
                onSubmit={handleCreate} 
                bouquets={bouquets || []} 
                servers={servers || []} 
                packages={packages || []} 
                users={users || []}
                isLoading={createLine.isPending} 
              />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <Dialog open={!!editLine} onOpenChange={(open) => !open && setEditLine(null)}>
        <DialogContent className="sm:max-w-[700px] bg-card border-white/10 text-white max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Line: {editLine?.username}</DialogTitle>
          </DialogHeader>
          {editLine && (
            <LineForm 
              onSubmit={handleUpdate} 
              bouquets={bouquets || []} 
              servers={servers || []} 
              packages={packages || []} 
              users={users || []}
              isLoading={updateLine.isPending}
              initialData={{
                username: editLine.username,
                password: editLine.password,
                maxConnections: editLine.maxConnections,
                enabled: editLine.enabled ?? true,
                adminEnabled: editLine.adminEnabled ?? true,
                isTrial: editLine.isTrial ?? false,
                bouquets: editLine.bouquets || [],
                allowedIps: editLine.allowedIps || [],
                allowedCountries: editLine.allowedCountries || [],
                allowedUserAgents: editLine.allowedUserAgents || [],
                allowedDomains: editLine.allowedDomains || [],
                allowedOutputs: editLine.allowedOutputs || ["m3u8", "ts"],
                lockedDeviceId: editLine.lockedDeviceId || undefined,
                lockedMac: editLine.lockedMac || undefined,
                forcedCountry: editLine.forcedCountry || undefined,
                ispLock: editLine.ispLock || undefined,
                memberId: editLine.memberId || undefined,
                packageId: editLine.packageId || undefined,
                forcedServerId: editLine.forcedServerId || undefined,
                playToken: editLine.playToken || undefined,
                adminNotes: editLine.adminNotes || undefined,
                resellerNotes: editLine.resellerNotes || undefined,
                expDate: editLine.expDate || undefined,
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-10 bg-background/50 border-white/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-lines"
            />
          </div>
          {filteredLines && filteredLines.length > 0 && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {selectedIds.length > 0 && <span>{selectedIds.length} selected</span>}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading lines...</div>
        ) : filteredLines?.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white">No lines found</h3>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-4 py-4">
                  <Checkbox 
                    checked={filteredLines && selectedIds.length === filteredLines.length && filteredLines.length > 0}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                </th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Username</th>
                <th className="px-4 py-4">Password</th>
                <th className="px-4 py-4">Created</th>
                <th className="px-4 py-4">Expires</th>
                <th className="px-4 py-4">Conn</th>
                <th className="px-4 py-4">Restrictions</th>
                <th className="px-4 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLines?.map((line) => (
                <tr key={line.id} className="hover:bg-white/5 transition-colors group" data-testid={`row-line-${line.id}`}>
                  <td className="px-4 py-4">
                    <Checkbox 
                      checked={selectedIds.includes(line.id)}
                      onCheckedChange={() => toggleSelect(line.id)}
                      data-testid={`checkbox-line-${line.id}`}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      {line.enabled ? (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-0">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                      {line.isTrial && <Badge variant="secondary">Trial</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-medium text-white">{line.username}</td>
                  <td className="px-4 py-4 text-muted-foreground font-mono">{line.password}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {line.createdAt ? format(new Date(line.createdAt), 'MMM d, yyyy') : '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {line.expDate ? format(new Date(line.expDate), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="px-4 py-4 text-white font-medium">{line.maxConnections}</td>
                  <td className="px-4 py-4">
                    <div className="flex gap-1">
                      {(line.allowedCountries && line.allowedCountries.length > 0) && (
                        <Badge variant="outline" className="text-xs"><Globe className="w-3 h-3 mr-1" />GeoIP</Badge>
                      )}
                      {line.lockedDeviceId && (
                        <Badge variant="outline" className="text-xs"><Smartphone className="w-3 h-3 mr-1" />Locked</Badge>
                      )}
                      {(line.allowedIps && line.allowedIps.length > 0) && (
                        <Badge variant="outline" className="text-xs"><Shield className="w-3 h-3 mr-1" />IP</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-white/10 hover:text-white"
                        onClick={() => setEditLine(line)}
                        data-testid={`button-edit-line-${line.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                        onClick={() => handleDelete(line.id)}
                        data-testid={`button-delete-line-${line.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
