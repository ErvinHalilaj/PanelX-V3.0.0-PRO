import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Monitor, Lock, Unlock, Zap } from "lucide-react";
import { 
  insertEnigma2DeviceSchema, 
  insertEnigma2ActionSchema,
  type Enigma2Device, 
  type Enigma2Action,
  type InsertEnigma2Device,
  type InsertEnigma2Action
} from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const deviceFormSchema = insertEnigma2DeviceSchema.extend({
  mac: insertEnigma2DeviceSchema.shape.mac.min(1, "MAC address is required")
});

const actionFormSchema = insertEnigma2ActionSchema.extend({
  actionType: insertEnigma2ActionSchema.shape.actionType.min(1, "Action type is required"),
  actionKey: insertEnigma2ActionSchema.shape.actionKey.min(1, "Action key is required")
});

type DeviceFormValues = InsertEnigma2Device;
type ActionFormValues = InsertEnigma2Action;

export default function Enigma2Devices() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Enigma2Device | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Enigma2Device | null>(null);

  const deviceForm = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      mac: "",
      modemMac: "",
      localIp: "",
      publicIp: "",
      keyAuth: "",
      enigmaVersion: "",
      cpu: "",
      deviceVersion: "",
      lockDevice: false,
      telnetEnabled: true,
      ftpEnabled: true,
      sshEnabled: true,
      watchdogTimeout: 0
    }
  });

  const actionForm = useForm<ActionFormValues>({
    resolver: zodResolver(actionFormSchema),
    defaultValues: {
      deviceId: 0,
      actionType: "reboot",
      actionKey: "",
      command: "",
      command2: ""
    }
  });

  const { data: devices = [], isLoading } = useQuery<Enigma2Device[]>({
    queryKey: ["/api/enigma2-devices"]
  });

  const { data: actions = [] } = useQuery<Enigma2Action[]>({
    queryKey: ["/api/enigma2-actions", selectedDevice?.id],
    enabled: !!selectedDevice
  });

  const createMutation = useMutation({
    mutationFn: async (data: DeviceFormValues) => {
      return apiRequest("/api/enigma2-devices", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enigma2-devices"] });
      toast({ title: "Device added successfully" });
      deviceForm.reset();
      setIsDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<DeviceFormValues> }) => {
      return apiRequest(`/api/enigma2-devices/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enigma2-devices"] });
      toast({ title: "Device updated successfully" });
      deviceForm.reset();
      setIsDialogOpen(false);
      setEditingDevice(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/enigma2-devices/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enigma2-devices"] });
      toast({ title: "Device deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const createActionMutation = useMutation({
    mutationFn: async (data: ActionFormValues) => {
      return apiRequest("/api/enigma2-actions", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enigma2-actions", selectedDevice?.id] });
      toast({ title: "Action sent successfully" });
      actionForm.reset();
      setIsActionDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const openEditDialog = (device: Enigma2Device) => {
    setEditingDevice(device);
    deviceForm.reset({
      mac: device.mac,
      userId: device.userId ?? undefined,
      modemMac: device.modemMac || "",
      localIp: device.localIp || "",
      publicIp: device.publicIp || "",
      keyAuth: device.keyAuth || "",
      enigmaVersion: device.enigmaVersion || "",
      cpu: device.cpu || "",
      deviceVersion: device.deviceVersion || "",
      lockDevice: device.lockDevice ?? false,
      telnetEnabled: device.telnetEnabled ?? true,
      ftpEnabled: device.ftpEnabled ?? true,
      sshEnabled: device.sshEnabled ?? true,
      watchdogTimeout: device.watchdogTimeout ?? 0
    });
    setIsDialogOpen(true);
  };

  const openActionDialog = (device: Enigma2Device) => {
    setSelectedDevice(device);
    actionForm.reset({
      deviceId: device.id,
      actionType: "reboot",
      actionKey: "reboot",
      command: "",
      command2: ""
    });
    setIsActionDialogOpen(true);
  };

  const handleDeviceSubmit = (data: DeviceFormValues) => {
    if (editingDevice) {
      updateMutation.mutate({ id: editingDevice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleActionSubmit = (data: ActionFormValues) => {
    createActionMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Enigma2 Devices</h1>
          <p className="text-muted-foreground">Manage STB and Enigma2 set-top box devices</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { deviceForm.reset(); setEditingDevice(null); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-device">
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDevice ? "Edit Device" : "Add Device"}</DialogTitle>
            </DialogHeader>
            <Form {...deviceForm}>
              <form onSubmit={deviceForm.handleSubmit(handleDeviceSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceForm.control}
                    name="mac"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MAC Address</FormLabel>
                        <FormControl>
                          <Input placeholder="00:1A:2B:3C:4D:5E" data-testid="input-mac" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceForm.control}
                    name="modemMac"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modem MAC</FormLabel>
                        <FormControl>
                          <Input data-testid="input-modem-mac" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceForm.control}
                    name="localIp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Local IP</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.1.100" data-testid="input-local-ip" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceForm.control}
                    name="publicIp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Public IP</FormLabel>
                        <FormControl>
                          <Input data-testid="input-public-ip" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceForm.control}
                    name="enigmaVersion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Enigma Version</FormLabel>
                        <FormControl>
                          <Input placeholder="OE 2.0" data-testid="input-enigma-version" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceForm.control}
                    name="deviceVersion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device Version</FormLabel>
                        <FormControl>
                          <Input data-testid="input-device-version" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceForm.control}
                    name="cpu"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPU</FormLabel>
                        <FormControl>
                          <Input data-testid="input-cpu" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceForm.control}
                    name="keyAuth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Key Auth</FormLabel>
                        <FormControl>
                          <Input data-testid="input-key-auth" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={deviceForm.control}
                  name="watchdogTimeout"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Watchdog Timeout (seconds)</FormLabel>
                      <FormControl>
                        <Input type="number" data-testid="input-watchdog-timeout" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceForm.control}
                    name="lockDevice"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-lock-device" />
                        </FormControl>
                        <FormLabel className="!mt-0">Lock Device</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceForm.control}
                    name="telnetEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-telnet" />
                        </FormControl>
                        <FormLabel className="!mt-0">Telnet Enabled</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceForm.control}
                    name="ftpEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ftp" />
                        </FormControl>
                        <FormLabel className="!mt-0">FTP Enabled</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceForm.control}
                    name="sshEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-ssh" />
                        </FormControl>
                        <FormLabel className="!mt-0">SSH Enabled</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); deviceForm.reset(); setEditingDevice(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-device" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingDevice ? "Update" : "Add Device"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Action to Device</DialogTitle>
          </DialogHeader>
          <Form {...actionForm}>
            <form onSubmit={actionForm.handleSubmit(handleActionSubmit)} className="space-y-4">
              <FormField
                control={actionForm.control}
                name="actionType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-action-type">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="reboot">Reboot</SelectItem>
                        <SelectItem value="message">Send Message</SelectItem>
                        <SelectItem value="channel">Change Channel</SelectItem>
                        <SelectItem value="volume">Set Volume</SelectItem>
                        <SelectItem value="standby">Standby</SelectItem>
                        <SelectItem value="wakeup">Wake Up</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={actionForm.control}
                name="actionKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action Key</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., reboot, message_text" data-testid="input-action-key" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={actionForm.control}
                name="command"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Command (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Command to execute" data-testid="input-command" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsActionDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="button-send-action" disabled={createActionMutation.isPending}>
                  Send Action
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {devices.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Monitor className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No Enigma2 devices registered</p>
            <p className="text-sm text-muted-foreground">Add your first STB device to manage it remotely</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Registered Devices ({devices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MAC Address</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Enigma Version</TableHead>
                  <TableHead>CPU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id} data-testid={`row-device-${device.id}`}>
                    <TableCell className="font-mono">{device.mac}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>Local: {device.localIp || "N/A"}</div>
                        <div className="text-muted-foreground">Public: {device.publicIp || "N/A"}</div>
                      </div>
                    </TableCell>
                    <TableCell>{device.enigmaVersion || "Unknown"}</TableCell>
                    <TableCell>{device.cpu || "Unknown"}</TableCell>
                    <TableCell>
                      {device.lockDevice ? (
                        <Badge variant="destructive" className="gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Unlock className="w-3 h-3" /> Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {device.lastUpdated 
                        ? formatDistanceToNow(new Date(device.lastUpdated), { addSuffix: true })
                        : "Never"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openActionDialog(device)} data-testid={`button-action-device-${device.id}`}>
                          <Zap className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(device)} data-testid={`button-edit-device-${device.id}`}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(device.id)}
                          data-testid={`button-delete-device-${device.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
