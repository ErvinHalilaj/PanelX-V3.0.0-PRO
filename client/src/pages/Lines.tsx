import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLines, useCreateLine, useDeleteLine } from "@/hooks/use-lines";
import { useBouquets } from "@/hooks/use-bouquets";
import { useServers } from "@/hooks/use-servers";
import { usePackages } from "@/hooks/use-packages";
import { Plus, Trash2, Edit2, User, Calendar, Search, Globe, Smartphone, Shield, Server, Package, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertLineSchema, type InsertLine } from "@shared/schema";
import { format } from "date-fns";

function LineForm({ onSubmit, bouquets, servers, packages, isLoading }: { 
  onSubmit: (data: InsertLine) => void, 
  bouquets: any[], 
  servers: any[],
  packages: any[],
  isLoading: boolean 
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const form = useForm<InsertLine>({
    resolver: zodResolver(insertLineSchema),
    defaultValues: {
      maxConnections: 1,
      enabled: true,
      isTrial: false,
      allowedIps: [],
      allowedCountries: [],
      allowedUserAgents: [],
      bouquets: [],
    }
  });

  const [selectedBouquets, setSelectedBouquets] = useState<number[]>([]);
  const [allowedIpsText, setAllowedIpsText] = useState("");
  const [allowedCountriesText, setAllowedCountriesText] = useState("");
  const [allowedUserAgentsText, setAllowedUserAgentsText] = useState("");

  const handleFormSubmit = (data: InsertLine) => {
    const formData = {
      ...data,
      bouquets: selectedBouquets,
      allowedIps: allowedIpsText.split(',').map(s => s.trim()).filter(Boolean),
      allowedCountries: allowedCountriesText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      allowedUserAgents: allowedUserAgentsText.split('\n').map(s => s.trim()).filter(Boolean),
    };
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" {...form.register("username")} placeholder="john_doe" data-testid="input-line-username" />
              {form.formState.errors.username && <p className="text-red-500 text-xs">{form.formState.errors.username.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" {...form.register("password")} placeholder="Secr3t!" data-testid="input-line-password" />
              {form.formState.errors.password && <p className="text-red-500 text-xs">{form.formState.errors.password.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxConnections">Max Connections</Label>
              <Input 
                id="maxConnections" 
                type="number" 
                {...form.register("maxConnections", { valueAsNumber: true })} 
                data-testid="input-max-connections"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expDate">Expiration Date</Label>
              <Input 
                id="expDate" 
                type="datetime-local" 
                {...form.register("expDate")}
                data-testid="input-exp-date"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
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

          <div className="space-y-2">
            <Label>Assigned Bouquets</Label>
            <div className="p-3 border border-white/10 rounded-md bg-background/50 max-h-32 overflow-y-auto">
              {bouquets?.length === 0 && <p className="text-xs text-muted-foreground">No bouquets available</p>}
              {bouquets?.map(b => (
                <div key={b.id} className="flex items-center gap-2 mb-2 last:mb-0">
                  <input 
                    type="checkbox" 
                    className="rounded border-white/20 bg-background"
                    checked={selectedBouquets.includes(b.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedBouquets([...selectedBouquets, b.id]);
                      } else {
                        setSelectedBouquets(selectedBouquets.filter(id => id !== b.id));
                      }
                    }}
                    data-testid={`checkbox-bouquet-${b.id}`}
                  />
                  <span className="text-sm">{b.bouquetName}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Admin Notes</Label>
            <Textarea {...form.register("adminNotes")} placeholder="Internal notes..." rows={2} data-testid="input-admin-notes" />
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-orange-500" />
              <h4 className="font-medium text-orange-500">Security Restrictions</h4>
            </div>
            <p className="text-sm text-muted-foreground">Configure access restrictions for this line</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Allowed Countries (GeoIP)
            </Label>
            <Input 
              value={allowedCountriesText}
              onChange={(e) => setAllowedCountriesText(e.target.value)}
              placeholder="US, UK, CA (comma-separated country codes)"
              data-testid="input-allowed-countries"
            />
            <p className="text-xs text-muted-foreground">Leave empty to allow all countries. Use 2-letter ISO codes.</p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Allowed IPs (Whitelist)
            </Label>
            <Textarea 
              value={allowedIpsText}
              onChange={(e) => setAllowedIpsText(e.target.value)}
              placeholder="192.168.1.100, 10.0.0.50 (comma-separated)"
              rows={2}
              data-testid="input-allowed-ips"
            />
            <p className="text-xs text-muted-foreground">Leave empty to allow all IPs. Only these IPs will be able to connect.</p>
          </div>

          <div className="space-y-2">
            <Label>Forced Country</Label>
            <Input 
              {...form.register("forcedCountry")}
              placeholder="US (force stream from specific country)"
              data-testid="input-forced-country"
            />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-blue-500" />
              <h4 className="font-medium text-blue-500">Package & Routing</h4>
            </div>
            <p className="text-sm text-muted-foreground">Assign package and server routing</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Assigned Package
              </Label>
              <Select onValueChange={(val) => form.setValue("packageId", val === "none" ? undefined : parseInt(val))}>
                <SelectTrigger data-testid="select-package">
                  <SelectValue placeholder="No package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No package</SelectItem>
                  {packages?.map((pkg: any) => (
                    <SelectItem key={pkg.id} value={pkg.id.toString()}>
                      {pkg.packageName} ({pkg.duration} days, {pkg.credits} credits)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Package determines bouquets and pricing</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Server className="w-4 h-4" />
                Forced Server
              </Label>
              <Select onValueChange={(val) => form.setValue("forcedServerId", val === "none" ? undefined : parseInt(val))}>
                <SelectTrigger data-testid="select-forced-server">
                  <SelectValue placeholder="Auto (load balanced)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Auto (load balanced)</SelectItem>
                  {servers?.map((srv: any) => (
                    <SelectItem key={srv.id} value={srv.id.toString()}>
                      {srv.serverName} ({srv.serverUrl})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Route all streams through specific server</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>ISP Lock</Label>
            <Input 
              {...form.register("ispLock")}
              placeholder="Comcast, AT&T (ISP name to restrict access)"
              data-testid="input-isp-lock"
            />
            <p className="text-xs text-muted-foreground">Only allow connections from this ISP</p>
          </div>

          <div className="space-y-2">
            <Label>Allowed User Agents (Whitelist)</Label>
            <Textarea 
              value={allowedUserAgentsText}
              onChange={(e) => setAllowedUserAgentsText(e.target.value)}
              placeholder="VLC/3.0.16&#10;TiviMate/4.0&#10;Smarters&#10;(one per line)"
              rows={3}
              data-testid="input-allowed-user-agents"
            />
            <p className="text-xs text-muted-foreground">Leave empty to allow all. Only listed user agents can connect.</p>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-blue-500" />
              <h4 className="font-medium text-blue-500">Device Locking</h4>
            </div>
            <p className="text-sm text-muted-foreground">Lock this line to specific devices</p>
          </div>

          <div className="space-y-2">
            <Label>Locked Device ID</Label>
            <Input 
              {...form.register("lockedDeviceId")}
              placeholder="Device ID (auto-captured on first connection)"
              data-testid="input-locked-device-id"
            />
            <p className="text-xs text-muted-foreground">Once set, only this device can use the line</p>
          </div>

          <div className="space-y-2">
            <Label>Locked MAC Address</Label>
            <Input 
              {...form.register("lockedMac")}
              placeholder="00:1A:2B:3C:4D:5E"
              data-testid="input-locked-mac"
            />
            <p className="text-xs text-muted-foreground">Lock to a specific MAC address (for MAG devices)</p>
          </div>

          <div className="space-y-2">
            <Label>Reseller Notes</Label>
            <Textarea {...form.register("resellerNotes")} placeholder="Notes visible to reseller..." rows={2} data-testid="input-reseller-notes" />
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-create-line">
          {isLoading ? "Creating..." : "Create Line"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Lines() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { data: lines, isLoading } = useLines();
  const { data: bouquets } = useBouquets();
  const { data: servers } = useServers();
  const { data: packages } = usePackages();
  const createLine = useCreateLine();
  const deleteLine = useDeleteLine();

  const handleCreate = async (data: InsertLine) => {
    try {
      await createLine.mutateAsync(data);
      toast({ title: "Success", description: "Line created successfully" });
      setIsCreateOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create line", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this user line permanently?")) {
      await deleteLine.mutateAsync(id);
      toast({ title: "Deleted", description: "Line removed" });
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
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="button-add-line">
              <Plus className="w-4 h-4" /> Create Line
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-card border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create New Line</DialogTitle>
            </DialogHeader>
            <LineForm onSubmit={handleCreate} bouquets={bouquets || []} servers={servers || []} packages={packages || []} isLoading={createLine.isPending} />
          </DialogContent>
        </Dialog>
      }
    >
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
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Username</th>
                <th className="px-6 py-4">Password</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Expires</th>
                <th className="px-6 py-4">Conn</th>
                <th className="px-6 py-4">Restrictions</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLines?.map((line) => (
                <tr key={line.id} className="hover:bg-white/5 transition-colors group" data-testid={`row-line-${line.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {line.enabled ? (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-0">Active</Badge>
                      ) : (
                        <Badge variant="destructive">Disabled</Badge>
                      )}
                      {line.isTrial && <Badge variant="secondary">Trial</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{line.username}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{line.password}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {line.createdAt ? format(new Date(line.createdAt), 'MMM d, yyyy') : '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {line.expDate ? format(new Date(line.expDate), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-white font-medium">{line.maxConnections}</td>
                  <td className="px-6 py-4">
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
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 hover:text-white">
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
