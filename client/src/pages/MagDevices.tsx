import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Monitor, Plus, Search, Trash2, Loader2, Wifi, WifiOff, Edit2 } from "lucide-react";
import { format } from "date-fns";
import type { Line } from "@shared/schema";

export default function MagDevices() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({
    macAddress: "",
    username: "",
    password: "",
    maxConnections: 1,
    enabled: true
  });

  const { data: lines = [], isLoading } = useQuery<Line[]>({
    queryKey: ["/api/lines"],
  });

  const magDevices = lines.filter(l => l.lockedMac && l.lockedMac.length > 0);

  const filteredDevices = magDevices.filter(device => 
    device.lockedMac?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createLineMutation = useMutation({
    mutationFn: async (data: typeof newDevice) => {
      return apiRequest("POST", "/api/lines", {
        username: data.username,
        password: data.password,
        maxConnections: data.maxConnections,
        enabled: data.enabled,
        lockedMac: data.macAddress.toUpperCase(),
        isTrial: false,
        bouquets: []
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      setIsCreateOpen(false);
      setNewDevice({ macAddress: "", username: "", password: "", maxConnections: 1, enabled: true });
      toast({ title: "MAG device created successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/lines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({ title: "Device deleted" });
    }
  });

  const toggleDeviceMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return apiRequest("PUT", `/api/lines/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
    }
  });

  const formatMac = (mac: string) => {
    const cleanMac = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    return cleanMac.match(/.{1,2}/g)?.join(':') || mac;
  };

  const activeDevices = magDevices.filter(d => d.enabled && (!d.expDate || new Date(d.expDate) > new Date()));
  const expiredDevices = magDevices.filter(d => d.expDate && new Date(d.expDate) < new Date());

  return (
    <Layout 
      title="MAG Devices"
      actions={
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by MAC..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px]"
              data-testid="input-search-mac"
            />
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-device">
                <Plus className="w-4 h-4" /> Add Device
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Add MAG Device</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>MAC Address</Label>
                  <Input
                    data-testid="input-mac-address"
                    value={newDevice.macAddress}
                    onChange={(e) => setNewDevice({ ...newDevice, macAddress: e.target.value })}
                    placeholder="00:1A:79:XX:XX:XX"
                  />
                  <p className="text-xs text-muted-foreground">Enter the STB MAC address</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      data-testid="input-device-username"
                      value={newDevice.username}
                      onChange={(e) => setNewDevice({ ...newDevice, username: e.target.value })}
                      placeholder="device_user"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      data-testid="input-device-password"
                      value={newDevice.password}
                      onChange={(e) => setNewDevice({ ...newDevice, password: e.target.value })}
                      placeholder="device_pass"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input
                    data-testid="input-device-connections"
                    type="number"
                    value={newDevice.maxConnections}
                    onChange={(e) => setNewDevice({ ...newDevice, maxConnections: parseInt(e.target.value) })}
                    min={1}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    data-testid="switch-device-enabled"
                    checked={newDevice.enabled}
                    onCheckedChange={(checked) => setNewDevice({ ...newDevice, enabled: checked })}
                  />
                  <Label>Enabled</Label>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={() => createLineMutation.mutate(newDevice)}
                  disabled={createLineMutation.isPending || !newDevice.macAddress || !newDevice.username || !newDevice.password}
                  className="w-full"
                  data-testid="button-submit-device"
                >
                  {createLineMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Device
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Monitor className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Devices</p>
              <p className="text-lg font-bold">{magDevices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
              <Wifi className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="text-lg font-bold">{activeDevices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
              <WifiOff className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expired</p>
              <p className="text-lg font-bold">{expiredDevices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10">
              <Monitor className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disabled</p>
              <p className="text-lg font-bold">{magDevices.filter(d => !d.enabled).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            MAG STB Devices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {magDevices.length === 0 ? "No MAG devices registered" : "No matching devices found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Connections</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((device) => {
                  const isExpired = device.expDate && new Date(device.expDate) < new Date();
                  return (
                    <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                      <TableCell className="font-mono text-sm">{formatMac(device.lockedMac || "")}</TableCell>
                      <TableCell className="font-medium">{device.username}</TableCell>
                      <TableCell>
                        {isExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : device.enabled ? (
                          <Badge className="bg-green-600 text-white">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {device.expDate ? format(new Date(device.expDate), "MMM dd, yyyy") : "Never"}
                      </TableCell>
                      <TableCell>{device.maxConnections}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {device.lastActivity ? format(new Date(device.lastActivity), "MMM dd, HH:mm") : "Never"}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={device.enabled ?? false}
                          onCheckedChange={(checked) => toggleDeviceMutation.mutate({ id: device.id, enabled: checked })}
                          data-testid={`switch-device-${device.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm("Delete this device?")) {
                                deleteDeviceMutation.mutate(device.id);
                              }
                            }}
                            data-testid={`button-delete-device-${device.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
