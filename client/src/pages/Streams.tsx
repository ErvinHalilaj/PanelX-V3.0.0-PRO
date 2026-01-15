import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useStreams, useCreateStream, useDeleteStream } from "@/hooks/use-streams";
import { useCategories } from "@/hooks/use-categories";
import { Plus, Trash2, Edit2, Play, AlertCircle, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertStreamSchema, type InsertStream } from "@shared/schema";
import { z } from "zod";

// --- Components ---

function StreamForm({ onSubmit, categories, isLoading }: { onSubmit: (data: InsertStream) => void, categories: any[], isLoading: boolean }) {
  const form = useForm<InsertStream>({
    resolver: zodResolver(insertStreamSchema),
    defaultValues: {
      streamType: "live",
      isDirect: false,
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Stream Name</Label>
        <Input id="name" {...form.register("name")} placeholder="e.g. Sky Sports 1 HD" />
        {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="sourceUrl">Source URL</Label>
        <Input id="sourceUrl" {...form.register("sourceUrl")} placeholder="http://source:8080/..." />
        {form.formState.errors.sourceUrl && <p className="text-red-500 text-xs">{form.formState.errors.sourceUrl.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select 
            onValueChange={(val) => form.setValue("categoryId", parseInt(val))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Stream Type</Label>
          <Select 
            defaultValue="live" 
            onValueChange={(val) => form.setValue("streamType", val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">Live Stream</SelectItem>
              <SelectItem value="movie">Movie</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary">
          {isLoading ? "Creating..." : "Add Stream"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Streams() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  
  const { data: streams, isLoading } = useStreams(selectedCategory);
  const { data: categories } = useCategories();
  const createStream = useCreateStream();
  const deleteStream = useDeleteStream();

  const handleCreate = async (data: InsertStream) => {
    try {
      await createStream.mutateAsync(data);
      toast({ title: "Success", description: "Stream created successfully" });
      setIsCreateOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create stream", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this stream?")) {
      await deleteStream.mutateAsync(id);
      toast({ title: "Deleted", description: "Stream removed" });
    }
  };

  return (
    <Layout 
      title="Manage Streams"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" /> Add Stream
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Add New Stream</DialogTitle>
            </DialogHeader>
            <StreamForm onSubmit={handleCreate} categories={categories || []} isLoading={createStream.isPending} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex gap-4 items-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Filter className="w-4 h-4" />
            <span>Filter by Category:</span>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px] bg-background/50 border-white/10">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.categoryName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading streams...</div>
        ) : streams?.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white">No streams found</h3>
            <p className="text-muted-foreground text-sm">Add your first stream to get started.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Stream Name</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {streams?.map((stream) => (
                <tr key={stream.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                      <Play className="w-4 h-4 text-muted-foreground" />
                    </div>
                    {stream.name}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {categories?.find(c => c.id === stream.categoryId)?.categoryName || "Uncategorized"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground font-mono text-xs truncate max-w-[200px]">
                    {stream.sourceUrl}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 hover:text-white">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                        onClick={() => handleDelete(stream.id)}
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
