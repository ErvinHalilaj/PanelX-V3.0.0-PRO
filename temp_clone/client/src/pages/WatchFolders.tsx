import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { FolderOpen, Plus, Trash2, Edit2, Play, Pause, RefreshCw, Loader2, Film, Tv, Check, X, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { WatchFolder, Category } from "@shared/schema";

export default function WatchFolders() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<WatchFolder | null>(null);

  const { data: folders = [], isLoading, isError } = useQuery<WatchFolder[]>({
    queryKey: ["/api/watch-folders"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const vodCategories = categories.filter((c) => c.categoryType === "movie" || c.categoryType === "series");

  const createMutation = useMutation({
    mutationFn: (data: Partial<WatchFolder>) => apiRequest("POST", "/api/watch-folders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch-folders"] });
      setDialogOpen(false);
      toast({ title: "Watch folder created successfully" });
    },
    onError: () => toast({ title: "Failed to create watch folder", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WatchFolder> }) =>
      apiRequest("PUT", `/api/watch-folders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch-folders"] });
      setDialogOpen(false);
      setEditingFolder(null);
      toast({ title: "Watch folder updated successfully" });
    },
    onError: () => toast({ title: "Failed to update watch folder", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/watch-folders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch-folders"] });
      toast({ title: "Watch folder deleted" });
    },
    onError: () => toast({ title: "Failed to delete watch folder", variant: "destructive" }),
  });

  const scanMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/watch-folders/${id}/scan`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watch-folders"] });
      toast({ title: "Scan initiated" });
    },
    onError: () => toast({ title: "Failed to initiate scan", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      folderName: formData.get("name") as string,
      folderPath: formData.get("folderPath") as string,
      scanInterval: parseInt(formData.get("scanIntervalMinutes") as string) || 60,
      categoryId: parseInt(formData.get("targetCategoryId") as string) || null,
      enabled: formData.get("enabled") === "on",
    };

    if (editingFolder) {
      updateMutation.mutate({ id: editingFolder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (folder: WatchFolder) => {
    setEditingFolder(folder);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFolder(null);
  };

  if (isError) {
    return (
      <Layout title="Watch Folders" subtitle="Automatically import content from folders">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load watch folders. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Watch Folders" subtitle="Automatically import content from folders">
      <div className="flex gap-2 mb-6">
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-add-folder">
              <Plus className="w-4 h-4 mr-2" /> Add Watch Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingFolder ? "Edit" : "Add"} Watch Folder</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Folder Name</Label>
                <Input
                  id="name"
                  name="name"
                  defaultValue={editingFolder?.folderName || ""}
                  placeholder="Movies Folder"
                  required
                  data-testid="input-folder-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="folderPath">Folder Path</Label>
                <Input
                  id="folderPath"
                  name="folderPath"
                  defaultValue={editingFolder?.folderPath || ""}
                  placeholder="/media/movies"
                  required
                  data-testid="input-folder-path"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetCategoryId">Target Category</Label>
                <Select
                  name="targetCategoryId"
                  defaultValue={editingFolder?.categoryId?.toString() || ""}
                >
                  <SelectTrigger id="targetCategoryId" data-testid="select-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {vodCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.categoryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scanIntervalMinutes">Scan Interval (minutes)</Label>
                <Input
                  id="scanIntervalMinutes"
                  name="scanIntervalMinutes"
                  type="number"
                  defaultValue={editingFolder?.scanInterval || 60}
                  min={5}
                  data-testid="input-scan-interval"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="enabled"
                  name="enabled"
                  defaultChecked={editingFolder?.enabled ?? true}
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-folder"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingFolder ? "Update" : "Create"} Folder
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
          {folders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No watch folders configured. Add one to automatically import content.
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-white/5"
                data-testid={`folder-item-${folder.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                    <FolderOpen className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{folder.folderName}</span>
                      <Badge variant={folder.enabled ? "default" : "secondary"}>
                        {folder.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground font-mono mt-1">
                      {folder.folderPath}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {folder.lastScanned && (
                        <span>Last scan: {format(new Date(folder.lastScanned), "MMM d, HH:mm")}</span>
                      )}
                      <span>Scan interval: {folder.scanInterval}m</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => scanMutation.mutate(folder.id)}
                    disabled={scanMutation.isPending}
                    data-testid={`button-scan-${folder.id}`}
                  >
                    <RefreshCw className={`w-4 h-4 ${scanMutation.isPending ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditDialog(folder)}
                    data-testid={`button-edit-${folder.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(folder.id)}
                    data-testid={`button-delete-${folder.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
