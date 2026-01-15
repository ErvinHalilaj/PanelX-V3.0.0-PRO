import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useBouquets, useCreateBouquet } from "@/hooks/use-bouquets";
import { Plus, Layers } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertBouquetSchema, type InsertBouquet } from "@shared/schema";

export default function Bouquets() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: bouquets, isLoading } = useBouquets();
  const createBouquet = useCreateBouquet();

  const form = useForm<InsertBouquet>({
    resolver: zodResolver(insertBouquetSchema),
    defaultValues: { bouquetChannels: [], bouquetSeries: [] }
  });

  const handleCreate = async (data: InsertBouquet) => {
    try {
      await createBouquet.mutateAsync(data);
      toast({ title: "Success", description: "Bouquet created" });
      setIsCreateOpen(false);
      form.reset();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <Layout 
      title="Bouquets"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2"><Plus className="w-4 h-4" /> Add Bouquet</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white">
            <DialogHeader><DialogTitle>New Bouquet</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Bouquet Name</Label>
                <Input {...form.register("bouquetName")} placeholder="e.g. Premium Sports Pack" />
              </div>
              <Button type="submit" className="w-full btn-primary" disabled={createBouquet.isPending}>
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Loading...</p>}
        {bouquets?.map((b) => (
          <div key={b.id} className="bg-card/40 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-emerald-500">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-white">{b.bouquetName}</h3>
                <p className="text-xs text-muted-foreground">ID: {b.id}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
