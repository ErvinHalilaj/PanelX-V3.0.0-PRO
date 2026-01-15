import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Film, Plus, Trash2, Play, Edit2, Info, Star } from "lucide-react";
import { useState } from "react";
import type { Stream, Category } from "@shared/schema";

export default function Movies() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMetadataOpen, setIsMetadataOpen] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<Stream | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    sourceUrl: "",
    categoryId: null as number | null,
    streamIcon: "",
    notes: "",
    isDirect: true,
    isMonitored: true,
  });
  const [metadataForm, setMetadataForm] = useState({
    plot: "",
    cast: "",
    director: "",
    genre: "",
    releaseDate: "",
    duration: "",
    rating: "",
    backdrop: "",
    youtubeTrailer: "",
    tmdbId: "",
  });

  const { data: streams = [], isLoading } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const movieStreams = streams.filter(s => s.streamType === "movie");
  const movieCategories = categories.filter(c => c.categoryType === "movie");

  const createMutation = useMutation({
    mutationFn: (data: typeof formData & { streamType: string }) => apiRequest("POST", "/api/streams", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      setIsOpen(false);
      setFormData({ name: "", sourceUrl: "", categoryId: null, streamIcon: "", notes: "", isDirect: true, isMonitored: true });
      toast({ title: "Movie added successfully" });
    },
    onError: () => toast({ title: "Failed to add movie", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/streams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Movie deleted" });
    },
  });

  const updateStreamMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: Partial<typeof formData> }) => 
      apiRequest("PUT", `/api/streams/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      setIsMetadataOpen(false);
      toast({ title: "Movie updated successfully" });
    },
    onError: () => toast({ title: "Failed to update movie", variant: "destructive" }),
  });

  const openMetadataEditor = (movie: Stream) => {
    setSelectedMovie(movie);
    setMetadataForm({
      plot: movie.notes || "",
      cast: "",
      director: "",
      genre: "",
      releaseDate: "",
      duration: "",
      rating: "",
      backdrop: "",
      youtubeTrailer: "",
      tmdbId: "",
    });
    setIsMetadataOpen(true);
  };

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
            <DialogContent className="max-w-lg">
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

        <Dialog open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="w-5 h-5" />
                Edit Movie: {selectedMovie?.name}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { 
              e.preventDefault(); 
              if (selectedMovie) {
                updateStreamMutation.mutate({ 
                  id: selectedMovie.id, 
                  data: { notes: metadataForm.plot } 
                }); 
              }
            }} className="space-y-4">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="basic">Basic Info</TabsTrigger>
                  <TabsTrigger value="media">Media & Links</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Plot Summary / Notes</Label>
                    <Textarea 
                      value={metadataForm.plot} 
                      onChange={(e) => setMetadataForm({ ...metadataForm, plot: e.target.value })} 
                      placeholder="Enter movie description..." 
                      rows={4}
                      data-testid="input-metadata-plot" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cast</Label>
                      <Input 
                        value={metadataForm.cast} 
                        onChange={(e) => setMetadataForm({ ...metadataForm, cast: e.target.value })} 
                        placeholder="Tom Hanks, Meg Ryan"
                        data-testid="input-metadata-cast" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Director</Label>
                      <Input 
                        value={metadataForm.director} 
                        onChange={(e) => setMetadataForm({ ...metadataForm, director: e.target.value })} 
                        placeholder="Steven Spielberg"
                        data-testid="input-metadata-director" 
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Genre</Label>
                      <Input 
                        value={metadataForm.genre} 
                        onChange={(e) => setMetadataForm({ ...metadataForm, genre: e.target.value })} 
                        placeholder="Action, Drama"
                        data-testid="input-metadata-genre" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Release Date</Label>
                      <Input 
                        value={metadataForm.releaseDate} 
                        onChange={(e) => setMetadataForm({ ...metadataForm, releaseDate: e.target.value })} 
                        placeholder="2024-01-15"
                        data-testid="input-metadata-release" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duration (min)</Label>
                      <Input 
                        value={metadataForm.duration} 
                        onChange={(e) => setMetadataForm({ ...metadataForm, duration: e.target.value })} 
                        placeholder="120"
                        data-testid="input-metadata-duration" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Rating (0-10)</Label>
                    <Input 
                      value={metadataForm.rating} 
                      onChange={(e) => setMetadataForm({ ...metadataForm, rating: e.target.value })} 
                      placeholder="8.5"
                      data-testid="input-metadata-rating" 
                    />
                  </div>
                </TabsContent>

                <TabsContent value="media" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Backdrop Image URL</Label>
                    <Input 
                      value={metadataForm.backdrop} 
                      onChange={(e) => setMetadataForm({ ...metadataForm, backdrop: e.target.value })} 
                      placeholder="https://..."
                      data-testid="input-metadata-backdrop" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>YouTube Trailer URL</Label>
                    <Input 
                      value={metadataForm.youtubeTrailer} 
                      onChange={(e) => setMetadataForm({ ...metadataForm, youtubeTrailer: e.target.value })} 
                      placeholder="https://youtube.com/watch?v=..."
                      data-testid="input-metadata-trailer" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>TMDB ID</Label>
                    <Input 
                      value={metadataForm.tmdbId} 
                      onChange={(e) => setMetadataForm({ ...metadataForm, tmdbId: e.target.value })} 
                      placeholder="12345"
                      data-testid="input-metadata-tmdb" 
                    />
                    <p className="text-xs text-muted-foreground">TheMovieDB identifier for auto-fetching metadata</p>
                  </div>
                </TabsContent>
              </Tabs>

              <Button type="submit" className="w-full" disabled={updateStreamMutation.isPending} data-testid="button-save-metadata">
                {updateStreamMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

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
                    <Button size="sm" variant="secondary" onClick={() => openMetadataEditor(movie)} data-testid={`button-edit-metadata-${movie.id}`}>
                      <Edit2 className="w-4 h-4" />
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
