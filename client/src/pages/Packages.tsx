import { useState } from "react";
import { Layout } from "@/components/Layout";
import { usePackages, useCreatePackage, useUpdatePackage, useDeletePackage } from "@/hooks/use-packages";
import { useBouquets } from "@/hooks/use-bouquets";
import { Plus, Package, Trash2, Edit, Clock, DollarSign, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertPackageSchema, type InsertPackage } from "@shared/schema";

export default function Packages() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { data: packages, isLoading } = usePackages();
  const { data: bouquets } = useBouquets();
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();
  const deletePackage = useDeletePackage();

  const form = useForm<InsertPackage>({
    resolver: zodResolver(insertPackageSchema),
    defaultValues: {
      packageName: "",
      durationDays: 30,
      credits: 1,
      maxConnections: 1,
      isTrial: false,
      bouquets: [],
      allowedOutputs: ["m3u8", "ts"],
      enabled: true,
      description: "",
    },
  });

  const handleCreate = async (data: InsertPackage) => {
    try {
      if (editingId) {
        await updatePackage.mutateAsync({ id: editingId, ...data });
        toast({ title: "Success", description: "Package updated" });
      } else {
        await createPackage.mutateAsync(data);
        toast({ title: "Success", description: "Package created" });
      }
      setIsCreateOpen(false);
      setEditingId(null);
      form.reset();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleEdit = (pkg: any) => {
    setEditingId(pkg.id);
    form.reset({
      packageName: pkg.packageName,
      durationDays: pkg.durationDays,
      credits: pkg.credits,
      maxConnections: pkg.maxConnections || 1,
      isTrial: pkg.isTrial || false,
      bouquets: pkg.bouquets || [],
      allowedOutputs: pkg.allowedOutputs || ["m3u8", "ts"],
      enabled: pkg.enabled !== false,
      description: pkg.description || "",
    });
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this package?")) return;
    try {
      await deletePackage.mutateAsync(id);
      toast({ title: "Deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <Layout
      title="Packages"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) { setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-package" className="btn-primary gap-2"><Plus className="w-4 h-4" /> Add Package</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit Package" : "New Package"}</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Package Name</Label>
                <Input data-testid="input-package-name" {...form.register("packageName")} placeholder="e.g. Monthly Premium" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (Days)</Label>
                  <Input data-testid="input-duration" type="number" {...form.register("durationDays", { valueAsNumber: true })} />
                </div>
                <div className="space-y-2">
                  <Label>Credits Cost</Label>
                  <Input data-testid="input-credits" type="number" {...form.register("credits", { valueAsNumber: true })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Connections</Label>
                  <Input data-testid="input-connections" type="number" {...form.register("maxConnections", { valueAsNumber: true })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    data-testid="switch-trial"
                    checked={form.watch("isTrial") || false}
                    onCheckedChange={(v) => form.setValue("isTrial", v)}
                  />
                  <Label>Trial Package</Label>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea data-testid="input-description" {...form.register("description")} placeholder="Package description..." />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  data-testid="switch-enabled"
                  checked={form.watch("enabled") !== false}
                  onCheckedChange={(v) => form.setValue("enabled", v)}
                />
                <Label>Enabled</Label>
              </div>
              <Button data-testid="button-submit" type="submit" className="w-full btn-primary" disabled={createPackage.isPending || updatePackage.isPending}>
                {editingId ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Loading...</p>}
        {packages?.map((pkg) => (
          <div
            key={pkg.id}
            data-testid={`card-package-${pkg.id}`}
            className="bg-card/40 border border-white/5 rounded-xl p-4 group hover:border-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{pkg.packageName}</h3>
                  <p className="text-xs text-muted-foreground">ID: {pkg.id}</p>
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button data-testid={`button-edit-${pkg.id}`} size="icon" variant="ghost" onClick={() => handleEdit(pkg)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button data-testid={`button-delete-${pkg.id}`} size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(pkg.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {pkg.durationDays}d</span>
              <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {pkg.credits} credits</span>
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {pkg.maxConnections || 1} conn</span>
            </div>
            <div className="flex gap-2 mt-2">
              {pkg.isTrial && <Badge variant="secondary">Trial</Badge>}
              <Badge variant={pkg.enabled !== false ? "default" : "outline"}>
                {pkg.enabled !== false ? "Active" : "Disabled"}
              </Badge>
            </div>
            {pkg.description && <p className="text-xs text-muted-foreground mt-2">{pkg.description}</p>}
          </div>
        ))}
      </div>
    </Layout>
  );
}
