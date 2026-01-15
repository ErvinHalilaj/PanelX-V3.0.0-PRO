import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useCategories, useCreateCategory, useDeleteCategory } from "@/hooks/use-categories";
import { Plus, Trash2, Folder } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertCategorySchema, type InsertCategory } from "@shared/schema";

export default function Categories() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();

  const form = useForm<InsertCategory>({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: { categoryType: "live" }
  });

  const handleCreate = async (data: InsertCategory) => {
    try {
      await createCategory.mutateAsync(data);
      toast({ title: "Success", description: "Category created" });
      setIsCreateOpen(false);
      form.reset();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  return (
    <Layout 
      title="Categories"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2"><Plus className="w-4 h-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white">
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input {...form.register("categoryName")} placeholder="e.g. Sports" />
              </div>
              <Button type="submit" className="w-full btn-primary" disabled={createCategory.isPending}>
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Loading...</p>}
        {categories?.map((cat) => (
          <div key={cat.id} className="bg-card/40 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-primary/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-white">{cat.categoryName}</h3>
                <p className="text-xs text-muted-foreground uppercase">{cat.categoryType}</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
              onClick={async () => {
                if(confirm("Delete category?")) await deleteCategory.mutateAsync(cat.id);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
    </Layout>
  );
}
