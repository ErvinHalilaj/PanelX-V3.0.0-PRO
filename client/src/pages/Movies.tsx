import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Film, Plus, Trash2, Play, Eye } from "lucide-react";
import { useState } from "react";
import type { Stream, Category } from "@shared/schema";

export default function Movies() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sourceUrl: "",
    categoryId: null as number | null,
    streamIcon: "",
    notes: "",
    isDirect: true,
    isMonitored: true,
  });

  const { data: streams = [], isLoading } = useQuery<Stream[]>({
    queryKey: ["/api/streams", { type: "movie" }],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const movieStreams = streams.filter(s => s.streamType === "movie");
  const movieCategories = categories.filter(c => c.categoryType === "movie");

  const createMutation = useMutation({
    mutationFn: (data: typeof formData & { streamType: string }) => apiRequest("/api/streams", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      setIsOpen(false);
      setFormData({ name: "", sourceUrl: "", categoryId: null, streamIcon: "", notes: "", isDirect: true, isMonitored: true });
      toast({ title: "Movie added successfully" });
    },
    onError: () => toast({ title: "Failed to add movie", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/streams/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Movie deleted" });
    },
  });

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Film className="w-8 h-8 text-primary" />
              Movies (VOD)
            </h1>
            <p className="text-muted-foreground mt-1">Manage video on demand content</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-movie">
                <Plus className="w-4 h-4" /> Add Movie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Movie</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...formData, streamType: "movie" }); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Movie Title</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="The Movie Title" required data-testid="input-movie-name" />
                </div>
                <div className="space-y-2">
                  <Label>Source URL</Label>
                  <Input value={formData.sourceUrl} onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })} placeholder="https://..." required data-testid="input-source-url" />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={formData.categoryId?.toString() || ""} onValueChange={(val) => setFormData({ ...formData, categoryId: parseInt(val) })}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {movieCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poster/Cover URL</Label>
                  <Input value={formData.streamIcon} onChange={(e) => setFormData({ ...formData, streamIcon: e.target.value })} placeholder="https://..." data-testid="input-poster" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.isDirect} onCheckedChange={(checked) => setFormData({ ...formData, isDirect: checked })} data-testid="switch-direct" />
                    <Label>Direct Source</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={formData.isMonitored} onCheckedChange={(checked) => setFormData({ ...formData, isMonitored: checked })} data-testid="switch-monitored" />
                    <Label>Monitor</Label>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-movie">
                  {createMutation.isPending ? "Adding..." : "Add Movie"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-10">Loading...</div>
        ) : movieStreams.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-10 text-center">
              <Film className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No movies added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first movie to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {movieStreams.map((movie) => (
              <Card key={movie.id} className="bg-card/50 border-border/50 overflow-hidden group" data-testid={`card-movie-${movie.id}`}>
                <div className="aspect-[2/3] bg-secondary/50 relative">
                  {movie.streamIcon ? (
                    <img src={movie.streamIcon} alt={movie.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" data-testid={`button-play-movie-${movie.id}`}>
                      <Play className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(movie.id)} data-testid={`button-delete-movie-${movie.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge variant={movie.monitorStatus === "online" ? "default" : "secondary"}>
                      {movie.monitorStatus || "unknown"}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-white truncate">{movie.name}</h3>
                  {movie.categoryId && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {categories.find(c => c.id === movie.categoryId)?.categoryName}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
