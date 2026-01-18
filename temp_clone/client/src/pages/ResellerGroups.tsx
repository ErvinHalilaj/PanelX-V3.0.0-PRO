import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useResellerGroups, useCreateResellerGroup, useUpdateResellerGroup, useDeleteResellerGroup } from "@/hooks/use-reseller-groups";
import { Plus, Users, Trash2, Edit, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertResellerGroupSchema, type InsertResellerGroup } from "@shared/schema";

export default function ResellerGroups() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data: groups, isLoading } = useResellerGroups();
  const createGroup = useCreateResellerGroup();
  const updateGroup = useUpdateResellerGroup();
  const deleteGroup = useDeleteResellerGroup();

  const form = useForm<InsertResellerGroup>({
    resolver: zodResolver(insertResellerGroupSchema),
    defaultValues: {
      groupName: "",
      canDeleteLines: true,
      canEditLines: true,
      canAddLines: true,
      canViewCredentials: true,
      allowedBouquets: [],
      maxLines: 0,
      colorCode: "#6366f1",
    },
  });

  const handleCreate = async (data: InsertResellerGroup) => {
    try {
      if (editingId) {
        await updateGroup.mutateAsync({ id: editingId, ...data });
        toast({ title: "Success", description: "Group updated" });
      } else {
        await createGroup.mutateAsync(data);
        toast({ title: "Success", description: "Group created" });
      }
      setIsCreateOpen(false);
      setEditingId(null);
      form.reset();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleEdit = (group: any) => {
    setEditingId(group.id);
    form.reset({
      groupName: group.groupName,
      canDeleteLines: group.canDeleteLines !== false,
      canEditLines: group.canEditLines !== false,
      canAddLines: group.canAddLines !== false,
      canViewCredentials: group.canViewCredentials !== false,
      allowedBouquets: group.allowedBouquets || [],
      maxLines: group.maxLines || 0,
      colorCode: group.colorCode || "#6366f1",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this reseller group?")) return;
    try {
      await deleteGroup.mutateAsync(id);
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const PermBadge = ({ allowed, label }: { allowed: boolean; label: string }) => (
    <span className="flex items-center gap-1 text-xs">
      {allowed ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-red-500" />}
      {label}
    </span>
  );

  return (
    <Layout
      title="Reseller Groups"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) { setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-group" className="btn-primary gap-2"><Plus className="w-4 h-4" /> Add Group</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit Group" : "New Reseller Group"}</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Group Name</Label>
                <Input data-testid="input-group-name" {...form.register("groupName")} placeholder="e.g. Premium Resellers" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Lines (0 = unlimited)</Label>
                  <Input data-testid="input-max-lines" type="number" {...form.register("maxLines", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Color Code</Label>
                  <div className="flex gap-2">
                    <Input data-testid="input-color" type="color" {...form.register("colorCode")} className="w-12 h-10 p-1" />
                    <Input {...form.register("colorCode")} className="flex-1" />
                  </div>
                </div>
              </div>
              <div className="space-y-3 border border-white/10 rounded-lg p-4">
                <h4 className="font-medium text-sm">Permissions</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid="switch-add-lines"
                      checked={form.watch("canAddLines") !== false}
                      onCheckedChange={(v) => form.setValue("canAddLines", v)}
                    />
                    <Label className="text-sm">Can Add Lines</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid="switch-edit-lines"
                      checked={form.watch("canEditLines") !== false}
                      onCheckedChange={(v) => form.setValue("canEditLines", v)}
                    />
                    <Label className="text-sm">Can Edit Lines</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid="switch-delete-lines"
                      checked={form.watch("canDeleteLines") !== false}
                      onCheckedChange={(v) => form.setValue("canDeleteLines", v)}
                    />
                    <Label className="text-sm">Can Delete Lines</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      data-testid="switch-view-creds"
                      checked={form.watch("canViewCredentials") !== false}
                      onCheckedChange={(v) => form.setValue("canViewCredentials", v)}
                    />
                    <Label className="text-sm">View Credentials</Label>
                  </div>
                </div>
              </div>
              <Button data-testid="button-submit" type="submit" className="w-full btn-primary" disabled={createGroup.isPending || updateGroup.isPending}>
                {editingId ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Loading...</p>}
        {groups?.map((group) => (
          <div
            key={group.id}
            data-testid={`card-group-${group.id}`}
            className="bg-card/40 border border-white/5 rounded-xl p-4 group hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: group.colorCode || "#6366f1" }}
                >
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{group.groupName}</h3>
                  <p className="text-xs text-muted-foreground">
                    Max Lines: {group.maxLines === 0 ? "Unlimited" : group.maxLines}
                  </p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button data-testid={`button-edit-${group.id}`} size="icon" variant="ghost" onClick={() => handleEdit(group)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button data-testid={`button-delete-${group.id}`} size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(group.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 text-muted-foreground">
              <PermBadge allowed={group.canAddLines !== false} label="Add" />
              <PermBadge allowed={group.canEditLines !== false} label="Edit" />
              <PermBadge allowed={group.canDeleteLines !== false} label="Delete" />
              <PermBadge allowed={group.canViewCredentials !== false} label="View" />
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
