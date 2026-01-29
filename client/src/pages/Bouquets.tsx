import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useBouquets, useCreateBouquet, useUpdateBouquet, useDeleteBouquet } from "@/hooks/use-bouquets";
import { useStreams } from "@/hooks/use-streams";
import { Plus, Layers, Edit2, Trash2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertBouquetSchema, type InsertBouquet, type Bouquet } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

export default function Bouquets() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editBouquet, setEditBouquet] = useState<Bouquet | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<number[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<number[]>([]);
  
  const { data: bouquets, isLoading } = useBouquets();
  const { data: allStreams } = useStreams();
  const createBouquet = useCreateBouquet();
  const updateBouquet = useUpdateBouquet();
  const deleteBouquet = useDeleteBouquet();

  // Filter streams by type
  const liveStreams = allStreams?.filter(s => s.streamType === 'live') || [];
  const movieStreams = allStreams?.filter(s => s.streamType === 'movie') || [];
  const seriesStreams = allStreams?.filter(s => s.streamType === 'series') || [];

  const form = useForm<InsertBouquet>({
    resolver: zodResolver(insertBouquetSchema),
    defaultValues: { bouquetChannels: [], bouquetSeries: [] }
  });

  const handleCreate = async (data: InsertBouquet) => {
    try {
      const bouquetData = {
        ...data,
        bouquetChannels: selectedChannels,
        bouquetMovies: selectedMovies,
        bouquetSeries: selectedSeries,
      };
      await createBouquet.mutateAsync(bouquetData);
      toast({ title: "Success", description: "Bouquet created" });
      setIsCreateOpen(false);
      setSelectedChannels([]);
      setSelectedMovies([]);
      setSelectedSeries([]);
      form.reset();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleEdit = async (data: InsertBouquet) => {
    if (!editBouquet) return;
    try {
      const bouquetData = {
        ...data,
        bouquetChannels: selectedChannels,
        bouquetMovies: selectedMovies,
        bouquetSeries: selectedSeries,
      };
      await updateBouquet.mutateAsync({ id: editBouquet.id, ...bouquetData });
      toast({ title: "Success", description: "Bouquet updated" });
      setEditBouquet(null);
      setSelectedChannels([]);
      setSelectedMovies([]);
      setSelectedSeries([]);
      form.reset();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteBouquet.mutateAsync(id);
      toast({ title: "Success", description: "Bouquet deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const openEditDialog = (bouquet: Bouquet) => {
    setEditBouquet(bouquet);
    setSelectedChannels(bouquet.bouquetChannels || []);
    setSelectedMovies(bouquet.bouquetMovies || []);
    setSelectedSeries(bouquet.bouquetSeries || []);
    form.reset({
      bouquetName: bouquet.bouquetName,
      bouquetChannels: bouquet.bouquetChannels || [],
      bouquetMovies: bouquet.bouquetMovies || [],
      bouquetSeries: bouquet.bouquetSeries || [],
    });
  };

  const toggleChannel = (streamId: number) => {
    setSelectedChannels(prev =>
      prev.includes(streamId)
        ? prev.filter(id => id !== streamId)
        : [...prev, streamId]
    );
  };

  const toggleMovie = (streamId: number) => {
    setSelectedMovies(prev =>
      prev.includes(streamId)
        ? prev.filter(id => id !== streamId)
        : [...prev, streamId]
    );
  };

  const toggleSeries = (streamId: number) => {
    setSelectedSeries(prev =>
      prev.includes(streamId)
        ? prev.filter(id => id !== streamId)
        : [...prev, streamId]
    );
  };

  return (
    <Layout 
      title="Bouquets"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) form.reset({ bouquetName: "", bouquetChannels: [], bouquetMovies: [], bouquetSeries: [] }); }}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-bouquet"><Plus className="w-4 h-4" /> Add Bouquet</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-white/10 text-white max-w-2xl max-h-[80vh]">
            <DialogHeader><DialogTitle>New Bouquet</DialogTitle></DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Bouquet Name</Label>
                <Input {...form.register("bouquetName")} placeholder="e.g. Premium Sports Pack" data-testid="input-bouquet-name" />
              </div>
              
              <div className="space-y-2">
                <Label>Live Channels ({selectedChannels.length} selected)</Label>
                <ScrollArea className="h-48 border border-white/10 rounded-lg p-3">
                  {liveStreams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No live streams available</p>
                  ) : (
                    <div className="space-y-2">
                      {liveStreams.map(stream => (
                        <div key={stream.id} className="flex items-center space-x-2 hover:bg-white/5 p-2 rounded">
                          <Checkbox
                            id={`channel-${stream.id}`}
                            checked={selectedChannels.includes(stream.id)}
                            onCheckedChange={() => toggleChannel(stream.id)}
                          />
                          <label htmlFor={`channel-${stream.id}`} className="text-sm cursor-pointer flex-1">
                            {stream.name} <span className="text-muted-foreground">(ID: {stream.id})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label>Movies ({selectedMovies.length} selected)</Label>
                <ScrollArea className="h-32 border border-white/10 rounded-lg p-3">
                  {movieStreams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No movies available</p>
                  ) : (
                    <div className="space-y-2">
                      {movieStreams.map(stream => (
                        <div key={stream.id} className="flex items-center space-x-2 hover:bg-white/5 p-2 rounded">
                          <Checkbox
                            id={`movie-${stream.id}`}
                            checked={selectedMovies.includes(stream.id)}
                            onCheckedChange={() => toggleMovie(stream.id)}
                          />
                          <label htmlFor={`movie-${stream.id}`} className="text-sm cursor-pointer flex-1">
                            {stream.name} <span className="text-muted-foreground">(ID: {stream.id})</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <Button type="submit" className="w-full" disabled={createBouquet.isPending} data-testid="button-submit-bouquet">
                {createBouquet.isPending ? "Creating..." : "Create Bouquet"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Dialog open={!!editBouquet} onOpenChange={(open) => { if (!open) { setEditBouquet(null); setSelectedChannels([]); setSelectedMovies([]); setSelectedSeries([]); form.reset({ bouquetName: "", bouquetChannels: [], bouquetMovies: [], bouquetSeries: [] }); } }}>
        <DialogContent className="bg-card border-white/10 text-white max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>Edit Bouquet</DialogTitle></DialogHeader>
          <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bouquet Name</Label>
              <Input {...form.register("bouquetName")} placeholder="e.g. Premium Sports Pack" data-testid="input-edit-bouquet-name" />
            </div>
            
            <div className="space-y-2">
              <Label>Live Channels ({selectedChannels.length} selected)</Label>
              <ScrollArea className="h-48 border border-white/10 rounded-lg p-3">
                {liveStreams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No live streams available</p>
                ) : (
                  <div className="space-y-2">
                    {liveStreams.map(stream => (
                      <div key={stream.id} className="flex items-center space-x-2 hover:bg-white/5 p-2 rounded">
                        <Checkbox
                          id={`edit-channel-${stream.id}`}
                          checked={selectedChannels.includes(stream.id)}
                          onCheckedChange={() => toggleChannel(stream.id)}
                        />
                        <label htmlFor={`edit-channel-${stream.id}`} className="text-sm cursor-pointer flex-1">
                          {stream.name} <span className="text-muted-foreground">(ID: {stream.id})</span>
                        </label>
                        {selectedChannels.includes(stream.id) && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="space-y-2">
              <Label>Movies ({selectedMovies.length} selected)</Label>
              <ScrollArea className="h-32 border border-white/10 rounded-lg p-3">
                {movieStreams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No movies available</p>
                ) : (
                  <div className="space-y-2">
                    {movieStreams.map(stream => (
                      <div key={stream.id} className="flex items-center space-x-2 hover:bg-white/5 p-2 rounded">
                        <Checkbox
                          id={`edit-movie-${stream.id}`}
                          checked={selectedMovies.includes(stream.id)}
                          onCheckedChange={() => toggleMovie(stream.id)}
                        />
                        <label htmlFor={`edit-movie-${stream.id}`} className="text-sm cursor-pointer flex-1">
                          {stream.name} <span className="text-muted-foreground">(ID: {stream.id})</span>
                        </label>
                        {selectedMovies.includes(stream.id) && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <Button type="submit" className="w-full" disabled={updateBouquet.isPending} data-testid="button-submit-edit-bouquet">
              {updateBouquet.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <p>Loading...</p>}
        {bouquets?.map((b) => (
          <div key={b.id} className="bg-card/40 border border-white/5 rounded-xl p-4 group hover:border-primary/50 transition-colors" data-testid={`card-bouquet-${b.id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-emerald-500">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-medium text-white">{b.bouquetName}</h3>
                  <p className="text-xs text-muted-foreground">ID: {b.id}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEditDialog(b)} data-testid={`button-edit-bouquet-${b.id}`}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)} className="text-destructive hover:text-destructive" data-testid={`button-delete-bouquet-${b.id}`}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{(b.bouquetChannels || []).length} Channels</Badge>
              <Badge variant="secondary">{(b.bouquetMovies || []).length} Movies</Badge>
              <Badge variant="secondary">{(b.bouquetSeries || []).length} Series</Badge>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
