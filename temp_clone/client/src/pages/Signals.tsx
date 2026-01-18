import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Zap, Bell, Mail, Globe, AlertTriangle } from "lucide-react";
import { insertSignalSchema, type Signal, type InsertSignal } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

const SIGNAL_TYPES = [
  { value: "stream_down", label: "Stream Down", icon: AlertTriangle },
  { value: "user_expired", label: "User Expired", icon: Bell },
  { value: "connection_limit", label: "Connection Limit", icon: AlertTriangle },
  { value: "new_user", label: "New User", icon: Bell },
  { value: "login_failed", label: "Login Failed", icon: AlertTriangle },
  { value: "server_offline", label: "Server Offline", icon: AlertTriangle }
];

const ACTION_TYPES = [
  { value: "email", label: "Send Email", icon: Mail },
  { value: "webhook", label: "Call Webhook", icon: Globe },
  { value: "restart_stream", label: "Restart Stream", icon: Zap },
  { value: "block_ip", label: "Block IP", icon: AlertTriangle }
];

const signalFormSchema = insertSignalSchema.extend({
  signalName: insertSignalSchema.shape.signalName.min(1, "Signal name is required"),
  signalType: insertSignalSchema.shape.signalType.min(1, "Signal type is required"),
  actionType: insertSignalSchema.shape.actionType.min(1, "Action type is required")
});

type SignalFormValues = InsertSignal;

export default function Signals() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSignal, setEditingSignal] = useState<Signal | null>(null);

  const form = useForm<SignalFormValues>({
    resolver: zodResolver(signalFormSchema),
    defaultValues: {
      signalName: "",
      signalType: "stream_down",
      triggerCondition: "",
      actionType: "email",
      enabled: true
    }
  });

  const { data: signals = [], isLoading } = useQuery<Signal[]>({
    queryKey: ["/api/signals"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: SignalFormValues) => {
      return apiRequest("/api/signals", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: "Signal created successfully" });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SignalFormValues> }) => {
      return apiRequest(`/api/signals/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: "Signal updated successfully" });
      form.reset();
      setIsDialogOpen(false);
      setEditingSignal(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/signals/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
      toast({ title: "Signal deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      return apiRequest(`/api/signals/${id}`, "PATCH", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/signals"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const openEditDialog = (signal: Signal) => {
    setEditingSignal(signal);
    form.reset({
      signalName: signal.signalName,
      signalType: signal.signalType,
      triggerCondition: signal.triggerCondition || "",
      actionType: signal.actionType,
      enabled: signal.enabled ?? true
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: SignalFormValues) => {
    if (editingSignal) {
      updateMutation.mutate({ id: editingSignal.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getSignalTypeInfo = (type: string) => {
    return SIGNAL_TYPES.find((t) => t.value === type) || SIGNAL_TYPES[0];
  };

  const getActionTypeInfo = (type: string) => {
    return ACTION_TYPES.find((t) => t.value === type) || ACTION_TYPES[0];
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Signals</h1>
          <p className="text-muted-foreground">Configure triggers and automated actions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { form.reset(); setEditingSignal(null); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-signal">
              <Plus className="w-4 h-4 mr-2" />
              Add Signal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingSignal ? "Edit Signal" : "Create Signal"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="signalName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Signal Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Stream Down Alert" data-testid="input-signal-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="signalType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trigger Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-signal-type">
                            <SelectValue placeholder="Select trigger type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SIGNAL_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actionType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Action Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-action-type">
                            <SelectValue placeholder="Select action type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ACTION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="triggerCondition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Trigger Condition (JSON)</FormLabel>
                      <FormControl>
                        <Input placeholder='{"threshold": 3, "window": "5m"}' data-testid="input-trigger-condition" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex items-center space-x-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-enabled" />
                      </FormControl>
                      <FormLabel className="!mt-0">Enabled</FormLabel>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); form.reset(); setEditingSignal(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-signal" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingSignal ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {signals.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Zap className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No signals configured</p>
              <p className="text-sm text-muted-foreground">Create signals to automate actions based on events</p>
            </CardContent>
          </Card>
        ) : (
          signals.map((signal) => {
            const signalTypeInfo = getSignalTypeInfo(signal.signalType);
            const actionTypeInfo = getActionTypeInfo(signal.actionType);
            const SignalIcon = signalTypeInfo.icon;
            const ActionIcon = actionTypeInfo.icon;

            return (
              <Card key={signal.id} data-testid={`card-signal-${signal.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <SignalIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{signal.signalName}</CardTitle>
                      <CardDescription>{signalTypeInfo.label}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={signal.enabled ?? true}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: signal.id, enabled: checked })}
                      data-testid={`switch-signal-${signal.id}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(signal)} data-testid={`button-edit-signal-${signal.id}`}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(signal.id)}
                      data-testid={`button-delete-signal-${signal.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="gap-1">
                      <ActionIcon className="w-3 h-3" />
                      {actionTypeInfo.label}
                    </Badge>
                    <Badge variant={signal.enabled ? "default" : "outline"}>
                      {signal.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Triggers:</span>
                      <p className="font-medium">{signal.triggerCount || 0}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last Triggered:</span>
                      <p className="font-medium">
                        {signal.lastTriggered
                          ? formatDistanceToNow(new Date(signal.lastTriggered), { addSuffix: true })
                          : "Never"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
