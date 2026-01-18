import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/hooks/use-categories";
import { Plus, Trash2, Folder, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertCategorySchema, type InsertCategory, type Category } from "@shared/schema";

export default function Categories() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const { data: categories, isLoading } = useCategories();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const updateCategory = useUpdateCategory();

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

  const handleEdit = async () => {
    if (!editCategory) return;
    try {
      await updateCategory.mutateAsync({
        id: editCategory.id,
        data: {
          categoryName: editCategory.categoryName,
          categoryType: editCategory.categoryType,
        }
      });
      toast({ title: "Success", description: "Category updated" });
      setEditCategory(null);
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
            <Button className="btn-primary gap-2" data-testid="button-add-category"><Plus className="w-4 h-4" /> Add Category</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white">
            <DialogHeader><DialogTitle>New Category</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input {...form.register("categoryName")} placeholder="e.g. Sports" data-testid="input-category-name" />
              </div>
              <div className="space-y-2">
                <Label>Category Type</Label>
                <Select defaultValue="live" onValueChange={(val) => form.setValue("categoryType", val)}>
                  <SelectTrigger data-testid="select-category-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="movie">Movie</SelectItem>
                    <SelectItem value="series">Series</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full btn-primary" disabled={createCategory.isPending} data-testid="button-submit-category">
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Dialog open={!!editCategory} onOpenChange={(open) => !open && setEditCategory(null)}>
        <DialogContent className="bg-card border-white/10 text-white">
          <DialogHeader><DialogTitle>Edit Category</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category Name</Label>
              <Input 
                value={editCategory?.categoryName || ""} 
                onChange={(e) => setEditCategory(prev => prev ? {...prev, categoryName: e.target.value} : null)}
                data-testid="input-edit-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label>Category Type</Label>
              <Select 
                value={editCategory?.categoryType || "live"} 
                onValueChange={(val) => setEditCategory(prev => prev ? {...prev, categoryType: val} : null)}
              >
                <SelectTrigger data-testid="select-edit-category-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="movie">Movie</SelectItem>
                  <SelectItem value="series">Series</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleEdit} disabled={updateCategory.isPending} className="w-full" data-testid="button-save-category">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Loading...</p>}
        {categories?.map((cat) => (
          <div key={cat.id} className="bg-card/40 border border-white/5 rounded-xl p-4 flex items-center justify-between group hover:border-primary/50 transition-colors" data-testid={`card-category-${cat.id}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-primary">
                <Folder className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-white">{cat.categoryName}</h3>
                <p className="text-xs text-muted-foreground uppercase">{cat.categoryType}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-white"
                onClick={() => setEditCategory(cat)}
                data-testid={`button-edit-category-${cat.id}`}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if(confirm("Delete category?")) await deleteCategory.mutateAsync(cat.id);
                }}
                data-testid={`button-delete-category-${cat.id}`}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
