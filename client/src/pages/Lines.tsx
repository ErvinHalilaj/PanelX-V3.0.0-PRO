import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useLines, useCreateLine, useDeleteLine } from "@/hooks/use-lines";
import { useBouquets } from "@/hooks/use-bouquets";
import { Plus, Trash2, Edit2, User, MoreVertical, Calendar, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertLineSchema, type InsertLine } from "@shared/schema";
import { format } from "date-fns";

function LineForm({ onSubmit, bouquets, isLoading }: { onSubmit: (data: InsertLine) => void, bouquets: any[], isLoading: boolean }) {
  const form = useForm<InsertLine>({
    resolver: zodResolver(insertLineSchema),
    defaultValues: {
      maxConnections: 1,
      enabled: true,
      isTrial: false,
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" {...form.register("username")} placeholder="john_doe" />
          {form.formState.errors.username && <p className="text-red-500 text-xs">{form.formState.errors.username.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" {...form.register("password")} placeholder="Secr3t!" />
          {form.formState.errors.password && <p className="text-red-500 text-xs">{form.formState.errors.password.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="maxConnections">Max Connections</Label>
        <Input 
          id="maxConnections" 
          type="number" 
          {...form.register("maxConnections", { valueAsNumber: true })} 
        />
      </div>

      {/* Simplified Bouquet Selection for now */}
      <div className="space-y-2">
        <Label>Assigned Bouquets</Label>
        <div className="p-3 border border-white/10 rounded-md bg-background/50 max-h-32 overflow-y-auto">
          {bouquets?.length === 0 && <p className="text-xs text-muted-foreground">No bouquets available</p>}
          {bouquets?.map(b => (
            <div key={b.id} className="flex items-center gap-2 mb-2 last:mb-0">
               <input type="checkbox" className="rounded border-white/20 bg-background" />
               <span className="text-sm">{b.bouquetName}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Input {...form.register("adminNotes")} placeholder="Optional notes..." />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary">
          {isLoading ? "Creating..." : "Create Line"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Lines() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: lines, isLoading } = useLines();
  const { data: bouquets } = useBouquets();
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

  return (
    <Layout 
      title="Manage Lines"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" /> Create Line
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create New Line</DialogTitle>
            </DialogHeader>
            <LineForm onSubmit={handleCreate} bouquets={bouquets || []} isLoading={createLine.isPending} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex gap-4">
           <div className="relative flex-1 max-w-sm">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
             <Input placeholder="Search users..." className="pl-10 bg-background/50 border-white/10" />
           </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading lines...</div>
        ) : lines?.length === 0 ? (
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
                <th className="px-6 py-4">Max Conn</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {lines?.map((line) => (
                <tr key={line.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    {line.enabled ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-500">Banned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{line.username}</td>
                  <td className="px-6 py-4 text-muted-foreground font-mono">{line.password}</td>
                  <td className="px-6 py-4 text-muted-foreground flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    {line.createdAt ? format(new Date(line.createdAt), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-6 py-4 text-white font-medium">{line.maxConnections}</td>
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
