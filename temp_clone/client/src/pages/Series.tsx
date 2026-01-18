import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clapperboard, Plus, Trash2, Calendar, Star, List, Edit2 } from "lucide-react";
import { useState } from "react";
import type { Series as SeriesType, Category } from "@shared/schema";

const defaultFormData = {
  name: "",
  categoryId: null as number | null,
  cover: "",
  backdrop: "",
  plot: "",
  cast: "",
  director: "",
  genre: "",
  releaseDate: "",
  rating: "",
  youtubeTrailer: "",
};

export default function Series() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesType | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const { data: seriesList = [], isLoading } = useQuery<SeriesType[]>({
    queryKey: ["/api/series"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const seriesCategories = categories.filter(c => c.categoryType === "series");

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/series", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      setIsOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Series created successfully" });
    },
    onError: () => toast({ title: "Failed to create series", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) => apiRequest("PUT", `/api/series/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      setIsOpen(false);
      setEditingSeries(null);
      setFormData(defaultFormData);
      toast({ title: "Series updated successfully" });
    },
    onError: () => toast({ title: "Failed to update series", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/series/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/series"] });
      toast({ title: "Series deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSeries) {
      updateMutation.mutate({ id: editingSeries.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (series: SeriesType) => {
    setEditingSeries(series);
    setFormData({
      name: series.name,
      categoryId: series.categoryId,
      cover: series.cover || "",
      backdrop: series.backdrop || "",
      plot: series.plot || "",
      cast: series.cast || "",
      director: series.director || "",
      genre: series.genre || "",
      releaseDate: series.releaseDate || "",
      rating: series.rating || "",
      youtubeTrailer: series.youtubeTrailer || "",
    });
    setIsOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingSeries(null);
      setFormData(defaultFormData);
    }
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Clapperboard className="w-8 h-8 text-primary" />
              TV Series
            </h1>
            <p className="text-muted-foreground mt-1">Manage TV series and episodes</p>
          </div>
          <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-series">
                <Plus className="w-4 h-4" /> Add Series
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSeries ? "Edit Series" : "Add New Series"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Series Name</Label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Breaking Bad" required data-testid="input-series-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={formData.categoryId?.toString() || ""} onValueChange={(val) => setFormData({ ...formData, categoryId: parseInt(val) })}>
                      <SelectTrigger data-testid="select-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cover Image URL</Label>
                    <Input value={formData.cover} onChange={(e) => setFormData({ ...formData, cover: e.target.value })} placeholder="https://..." data-testid="input-cover" />
                  </div>
                  <div className="space-y-2">
                    <Label>Backdrop Image URL</Label>
                    <Input value={formData.backdrop} onChange={(e) => setFormData({ ...formData, backdrop: e.target.value })} placeholder="https://..." data-testid="input-backdrop" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Plot Summary</Label>
                  <Textarea value={formData.plot} onChange={(e) => setFormData({ ...formData, plot: e.target.value })} placeholder="A high school chemistry teacher..." rows={3} data-testid="input-plot" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cast</Label>
                    <Input value={formData.cast} onChange={(e) => setFormData({ ...formData, cast: e.target.value })} placeholder="Bryan Cranston, Aaron Paul" data-testid="input-cast" />
                  </div>
                  <div className="space-y-2">
                    <Label>Director</Label>
                    <Input value={formData.director} onChange={(e) => setFormData({ ...formData, director: e.target.value })} placeholder="Vince Gilligan" data-testid="input-director" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Genre</Label>
                    <Input value={formData.genre} onChange={(e) => setFormData({ ...formData, genre: e.target.value })} placeholder="Drama, Crime" data-testid="input-genre" />
                  </div>
                  <div className="space-y-2">
                    <Label>Release Date</Label>
                    <Input value={formData.releaseDate} onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })} placeholder="2008-01-20" data-testid="input-release-date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Rating (0-10)</Label>
                    <Input value={formData.rating} onChange={(e) => setFormData({ ...formData, rating: e.target.value })} placeholder="9.5" data-testid="input-rating" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-series">
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (editingSeries ? "Save Changes" : "Create Series")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-10">Loading...</div>
        ) : seriesList.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-10 text-center">
              <Clapperboard className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No TV series added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add your first series to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {seriesList.map((series) => (
              <Card key={series.id} className="bg-card/50 border-border/50 overflow-hidden" data-testid={`card-series-${series.id}`}>
                <div className="aspect-[2/3] bg-secondary/50 relative">
                  {series.cover ? (
                    <img src={series.cover} alt={series.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Clapperboard className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button variant="secondary" size="sm" onClick={() => openEditDialog(series)} data-testid={`button-edit-series-${series.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(series.id)} data-testid={`button-delete-series-${series.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-white truncate">{series.name}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    {series.rating && (
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" fill="currentColor" />
                        {series.rating}
                      </span>
                    )}
                    {series.releaseDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {series.releaseDate.split("-")[0]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    {series.genre && <Badge variant="secondary">{series.genre.split(",")[0]}</Badge>}
                    <Link href={`/series/${series.id}/episodes`}>
                      <Button variant="outline" size="sm" className="gap-1" data-testid={`button-episodes-${series.id}`}>
                        <List className="w-3 h-3" /> Episodes
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
