import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLines, useCreateLine, useDeleteLine, useUpdateLine, useBulkDeleteLines, useBulkToggleLines } from "@/hooks/use-lines";
import { useBouquets } from "@/hooks/use-bouquets";
import { useServers } from "@/hooks/use-servers";
import { usePackages } from "@/hooks/use-packages";
import { Plus, Trash2, Edit2, User, Calendar, Search, Globe, Smartphone, Shield, Server, Package, ChevronDown, ChevronUp, Key, Users, CheckSquare, Square, Power, PowerOff, Loader2 } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertLineSchema, type InsertLine, type Line } from "@shared/schema";
import { format } from "date-fns";

function LineForm({ onSubmit, bouquets, servers, packages, isLoading, initialData }: { 
  onSubmit: (data: InsertLine) => void, 
  bouquets: any[], 
  servers: any[],
  packages: any[],
  isLoading: boolean,
  initialData?: Partial<InsertLine>
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const form = useForm<InsertLine>({
    resolver: zodResolver(insertLineSchema),
    defaultValues: {
      maxConnections: initialData?.maxConnections || 1,
      enabled: initialData?.enabled ?? true,
      isTrial: initialData?.isTrial ?? false,
      username: initialData?.username || "",
      password: initialData?.password || "",
      allowedIps: initialData?.allowedIps || [],
      allowedCountries: initialData?.allowedCountries || [],
      allowedUserAgents: initialData?.allowedUserAgents || [],
      bouquets: initialData?.bouquets || [],
    }
  });

  const [selectedBouquets, setSelectedBouquets] = useState<number[]>(initialData?.bouquets || []);
  const [allowedIpsText, setAllowedIpsText] = useState((initialData?.allowedIps || []).join(", "));
  const [allowedCountriesText, setAllowedCountriesText] = useState((initialData?.allowedCountries || []).join(", "));
  const [allowedUserAgentsText, setAllowedUserAgentsText] = useState((initialData?.allowedUserAgents || []).join("\n"));

  const handleFormSubmit = (data: InsertLine) => {
    console.log("[LineForm] Form submitted with data:", data);
    const formData = {
      ...data,
      // Convert datetime-local string to Date object for proper backend handling
      expDate: data.expDate ? new Date(data.expDate) : undefined,
      bouquets: selectedBouquets,
      allowedIps: allowedIpsText.split(',').map(s => s.trim()).filter(Boolean),
      allowedCountries: allowedCountriesText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
      allowedUserAgents: allowedUserAgentsText.split('\n').map(s => s.trim()).filter(Boolean),
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
                      <Label htmlFor={`bouquet-${bouquet.id}`} className="text-sm">{bouquet.bouquetName}</Label>
                    </div>
                  ))}
                </div>
              )}
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
          </div>

          <div className="space-y-2">
            <Label>Locked MAC Address</Label>
            <Input 
              {...form.register("lockedMac")}
              placeholder="00:1A:79:XX:XX:XX"
              data-testid="input-locked-mac"
            />
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Server className="w-4 h-4" />
              Force Server ID
            </Label>
            <Select onValueChange={(val) => form.setValue("forceServerId", parseInt(val) || undefined)}>
              <SelectTrigger data-testid="select-force-server">
                <SelectValue placeholder="Auto-select best server" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Auto-select</SelectItem>
                {servers.map((server: any) => (
                  <SelectItem key={server.id} value={String(server.id)}>{server.serverName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Package
            </Label>
            <Select onValueChange={(val) => form.setValue("packageId", parseInt(val) || undefined)}>
              <SelectTrigger data-testid="select-package">
                <SelectValue placeholder="No package" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No package</SelectItem>
                {packages.map((pkg: any) => (
                  <SelectItem key={pkg.id} value={String(pkg.id)}>{pkg.packageName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea 
              {...form.register("adminNotes")}
              placeholder="Internal notes about this line"
              data-testid="input-admin-notes"
            />
          </div>
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-submit-line">
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
        </div>
      }
    >
      <Dialog open={!!editLine} onOpenChange={(open) => !open && setEditLine(null)}>
        <DialogContent className="sm:max-w-[600px] bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Line: {editLine?.username}</DialogTitle>
          </DialogHeader>
          {editLine && (
            <LineForm 
              onSubmit={handleUpdate} 
              bouquets={bouquets || []} 
              servers={servers || []} 
              packages={packages || []} 
              isLoading={updateLine.isPending}
              initialData={{
                username: editLine.username,
                password: editLine.password,
                maxConnections: editLine.maxConnections,
                enabled: editLine.enabled ?? true,
                isTrial: editLine.isTrial ?? false,
                bouquets: editLine.bouquets || [],
                allowedIps: editLine.allowedIps || [],
                allowedCountries: editLine.allowedCountries || [],
                allowedUserAgents: editLine.allowedUserAgents || [],
                lockedDeviceId: editLine.lockedDeviceId || undefined,
                lockedMac: editLine.lockedMac || undefined,
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
