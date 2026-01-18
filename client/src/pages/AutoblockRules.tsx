import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ShieldAlert, Plus, Trash2, Edit2, Loader2, AlertTriangle, Shield, Clock, Ban, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { AutoblockRule } from "@shared/schema";

export default function AutoblockRules() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoblockRule | null>(null);

  const { data: rules = [], isLoading, isError } = useQuery<AutoblockRule[]>({
    queryKey: ["/api/autoblock-rules"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<AutoblockRule>) => apiRequest("POST", "/api/autoblock-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autoblock-rules"] });
      closeDialog();
      toast({ title: "Autoblock rule created successfully" });
    },
    onError: () => toast({ title: "Failed to create rule", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AutoblockRule> }) =>
      apiRequest("PUT", `/api/autoblock-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autoblock-rules"] });
      closeDialog();
      toast({ title: "Rule updated successfully" });
    },
    onError: () => toast({ title: "Failed to update rule", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/autoblock-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/autoblock-rules"] });
      toast({ title: "Rule deleted" });
    },
    onError: () => toast({ title: "Failed to delete rule", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      ruleName: formData.get("name") as string,
      ruleType: formData.get("ruleType") as string,
      threshold: parseInt(formData.get("threshold") as string) || 5,
      timeWindowMinutes: parseInt(formData.get("timeWindowMinutes") as string) || 5,
      blockDurationMinutes: parseInt(formData.get("blockDurationMinutes") as string) || 60,
      enabled: formData.get("enabled") === "on",
      blockType: formData.get("action") as string,
    };

    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (rule: AutoblockRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case "failed_auth":
        return Shield;
      case "connection_limit":
        return AlertTriangle;
      case "vpn_detected":
        return ShieldAlert;
      case "expired_line":
        return Clock;
      default:
        return Ban;
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "failed_auth":
        return "Failed Authentication";
      case "connection_limit":
        return "Connection Limit Exceeded";
      case "vpn_detected":
        return "VPN/Proxy Detected";
      case "expired_line":
        return "Expired Line Access";
      case "suspicious_activity":
        return "Suspicious Activity";
      default:
        return type;
    }
  };

  if (isError) {
    return (
      <Layout title="Autoblock Rules" subtitle="Configure automatic IP blocking rules">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load autoblock rules. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Autoblock Rules" subtitle="Configure automatic IP blocking rules">
      <Alert className="mb-6">
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          Autoblock rules automatically block IPs based on suspicious behavior patterns. Configure
          thresholds carefully to avoid blocking legitimate users.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 mb-6">
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-create-rule">
              <Plus className="w-4 h-4 mr-2" /> Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit" : "Create"} Autoblock Rule</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingRule?.ruleName || ""}
                  placeholder="Block after 5 failed logins"
                  required
                  data-testid="input-rule-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ruleType">Rule Type</Label>
                <Select name="ruleType" defaultValue={editingRule?.ruleType || "failed_auth"}>
                  <SelectTrigger id="ruleType" data-testid="select-rule-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="failed_auth">Failed Authentication</SelectItem>
                    <SelectItem value="connection_limit">Connection Limit Exceeded</SelectItem>
                    <SelectItem value="vpn_detected">VPN/Proxy Detected</SelectItem>
                    <SelectItem value="expired_line">Expired Line Access</SelectItem>
                    <SelectItem value="suspicious_activity">Suspicious Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="threshold">Threshold (attempts)</Label>
                  <Input
                    id="threshold"
                    name="threshold"
                    type="number"
                    defaultValue={editingRule?.threshold || 5}
                    min={1}
                    data-testid="input-threshold"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeWindowMinutes">Time Window (minutes)</Label>
                  <Input
                    id="timeWindowMinutes"
                    name="timeWindowMinutes"
                    type="number"
                    defaultValue={editingRule?.timeWindowMinutes || 5}
                    min={1}
                    data-testid="input-time-window"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="blockDurationMinutes">Block Duration (minutes)</Label>
                  <Input
                    id="blockDurationMinutes"
                    name="blockDurationMinutes"
                    type="number"
                    defaultValue={editingRule?.blockDurationMinutes || 60}
                    min={1}
                    data-testid="input-block-duration"
                  />
                  <p className="text-xs text-muted-foreground">0 = permanent block</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action">Action</Label>
                  <Select name="action" defaultValue={editingRule?.blockType || "block_ip"}>
                    <SelectTrigger id="action" data-testid="select-action">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block_ip">Block IP</SelectItem>
                      <SelectItem value="disable_line">Disable Line</SelectItem>
                      <SelectItem value="notify_admin">Notify Admin Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="enabled"
                  name="enabled"
                  defaultChecked={editingRule?.enabled ?? true}
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-rule"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingRule ? "Update" : "Create"} Rule
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No autoblock rules configured. Create one to automatically block suspicious activity.
            </div>
          ) : (
            rules.map((rule) => {
              const Icon = getRuleTypeIcon(rule.ruleType);
              return (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-white/5"
                  data-testid={`rule-item-${rule.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-destructive/20 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-destructive" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{rule.ruleName}</span>
                        <Badge variant={rule.enabled ? "default" : "secondary"}>
                          {rule.enabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {getRuleTypeLabel(rule.ruleType)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span>{rule.threshold} attempts in {rule.timeWindowMinutes}m</span>
                        <span>Block: {rule.blockDurationMinutes === 0 ? "Permanent" : `${rule.blockDurationMinutes}m`}</span>
                        <Badge variant="outline" className="text-xs">
                          {rule.blockType}
                        </Badge>
                        {rule.triggeredCount && rule.triggeredCount > 0 && (
                          <span className="text-yellow-500">Triggered: {rule.triggeredCount}x</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(rule)}
                      data-testid={`button-edit-${rule.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(rule.id)}
                      data-testid={`button-delete-${rule.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </Layout>
  );
}
