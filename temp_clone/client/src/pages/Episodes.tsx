import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Film, Plus, Trash2, ArrowLeft, Play } from "lucide-react";
import { useState } from "react";
import type { Episode, Series as SeriesType } from "@shared/schema";

export default function Episodes() {
  const { seriesId } = useParams<{ seriesId: string }>();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    season: 1,
    episodeNum: 1,
    title: "",
    plot: "",
    duration: "",
    streamUrl: "",
    containerExtension: "mp4",
  });

  const { data: series } = useQuery<SeriesType>({
    queryKey: [`/api/series/${seriesId}`],
    enabled: !!seriesId,
  });

  const { data: episodes = [], isLoading } = useQuery<Episode[]>({
    queryKey: [`/api/series/${seriesId}/episodes`],
    enabled: !!seriesId,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData & { seriesId: number }) => 
      apiRequest("POST", `/api/series/${seriesId}/episodes`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/${seriesId}/episodes`] });
      setIsOpen(false);
      setFormData({ season: 1, episodeNum: 1, title: "", plot: "", duration: "", streamUrl: "", containerExtension: "mp4" });
      toast({ title: "Episode added successfully" });
    },
    onError: () => toast({ title: "Failed to add episode", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/episodes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/series/${seriesId}/episodes`] });
      toast({ title: "Episode deleted" });
    },
  });

  const groupedBySeason = episodes.reduce((acc, ep) => {
    const season = ep.season || 1;
    if (!acc[season]) acc[season] = [];
    acc[season].push(ep);
    return acc;
  }, {} as Record<number, Episode[]>);

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/series">
              <Button variant="ghost" className="gap-2 mb-2" data-testid="button-back-series">
                <ArrowLeft className="w-4 h-4" /> Back to Series
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Film className="w-8 h-8 text-primary" />
              {series?.name || "Series"} - Episodes
            </h1>
            <p className="text-muted-foreground mt-1">Manage episodes for this series</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-episode">
                <Plus className="w-4 h-4" /> Add Episode
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Episode</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate({ ...formData, seriesId: parseInt(seriesId!) }); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Season</Label>
                    <Input type="number" min={1} value={formData.season} onChange={(e) => setFormData({ ...formData, season: parseInt(e.target.value) || 1 })} data-testid="input-season" />
                  </div>
                  <div className="space-y-2">
                    <Label>Episode Number</Label>
                    <Input type="number" min={1} value={formData.episodeNum} onChange={(e) => setFormData({ ...formData, episodeNum: parseInt(e.target.value) || 1 })} data-testid="input-episode-num" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Episode Title</Label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Pilot" required data-testid="input-episode-title" />
                </div>
                <div className="space-y-2">
                  <Label>Stream URL</Label>
                  <Input value={formData.streamUrl} onChange={(e) => setFormData({ ...formData, streamUrl: e.target.value })} placeholder="https://..." required data-testid="input-stream-url" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} placeholder="45" data-testid="input-duration" />
                  </div>
                  <div className="space-y-2">
                    <Label>Container</Label>
                    <Select value={formData.containerExtension} onValueChange={(val) => setFormData({ ...formData, containerExtension: val })}>
                      <SelectTrigger data-testid="select-container">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mp4">MP4</SelectItem>
                        <SelectItem value="mkv">MKV</SelectItem>
                        <SelectItem value="avi">AVI</SelectItem>
                        <SelectItem value="ts">TS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Plot Summary</Label>
                  <Input value={formData.plot} onChange={(e) => setFormData({ ...formData, plot: e.target.value })} placeholder="Episode description..." data-testid="input-plot" />
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-episode">
                  {createMutation.isPending ? "Adding..." : "Add Episode"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-10">Loading...</div>
        ) : episodes.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-10 text-center">
              <Film className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No episodes added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Add the first episode for this series</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedBySeason).sort(([a], [b]) => Number(a) - Number(b)).map(([season, eps]) => (
              <Card key={season} className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Season {season}
                    <Badge variant="secondary">{eps.length} episodes</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {eps.sort((a, b) => (a.episodeNum || 0) - (b.episodeNum || 0)).map((episode) => (
                      <div key={episode.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors" data-testid={`row-episode-${episode.id}`}>
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="font-mono">E{String(episode.episodeNum).padStart(2, '0')}</Badge>
                          <div>
                            <p className="font-medium text-white">{episode.title || `Episode ${episode.episodeNum}`}</p>
                            {episode.duration && <p className="text-sm text-muted-foreground">{episode.duration} min</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" data-testid={`button-play-episode-${episode.id}`}>
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(episode.id)} className="text-destructive" data-testid={`button-delete-episode-${episode.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
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
