import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Repeat, Plus, Trash2, Edit2, Play, Pause, Loader2, List, Clock, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { LoopingChannel, Category } from "@shared/schema";

export default function LoopingChannels() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<LoopingChannel | null>(null);
  const [playlistText, setPlaylistText] = useState("");

  const { data: channels = [], isLoading, isError } = useQuery<LoopingChannel[]>({
    queryKey: ["/api/looping-channels"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const liveCategories = categories.filter((c) => c.categoryType === "live");

  const createMutation = useMutation({
    mutationFn: (data: Partial<LoopingChannel>) => apiRequest("POST", "/api/looping-channels", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/looping-channels"] });
      closeDialog();
      toast({ title: "24/7 channel created successfully" });
    },
    onError: () => toast({ title: "Failed to create channel", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<LoopingChannel> }) =>
      apiRequest("PUT", `/api/looping-channels/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/looping-channels"] });
      closeDialog();
      toast({ title: "Channel updated successfully" });
    },
    onError: () => toast({ title: "Failed to update channel", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/looping-channels/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/looping-channels"] });
      toast({ title: "Channel deleted" });
    },
    onError: () => toast({ title: "Failed to delete channel", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const playlistItems = playlistText
      .split("\n")
      .map((line, index) => ({ streamId: 0, order: index, url: line.trim() }))
      .filter((item) => item.url);

    const data = {
      channelName: formData.get("channelName") as string,
      categoryId: parseInt(formData.get("categoryId") as string) || null,
      enabled: formData.get("enabled") === "on",
      streamIcon: (formData.get("streamIcon") as string) || null,
      playlist: playlistItems.map((item, i) => ({ streamId: i, order: item.order })),
    };

    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (channel: LoopingChannel) => {
    setEditingChannel(channel);
    const playlist = channel.playlist as { streamId: number; order: number }[] || [];
    setPlaylistText(playlist.map((p) => `Stream ${p.streamId}`).join("\n"));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingChannel(null);
    setPlaylistText("");
  };

  if (isError) {
    return (
      <Layout title="24/7 Looping Channels" subtitle="Create continuous looping content channels">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load looping channels. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="24/7 Looping Channels" subtitle="Create continuous looping content channels">
      <div className="flex gap-2 mb-6">
        <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)} data-testid="button-create-channel">
              <Plus className="w-4 h-4 mr-2" /> Create 24/7 Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingChannel ? "Edit" : "Create"} 24/7 Channel</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="channelName">Channel Name</Label>
                  <Input
                    id="channelName"
                    name="channelName"
                    defaultValue={editingChannel?.channelName || ""}
                    placeholder="24/7 Movies"
                    required
                    data-testid="input-channel-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Category</Label>
                  <Select
                    name="categoryId"
                    defaultValue={editingChannel?.categoryId?.toString() || ""}
                  >
                    <SelectTrigger id="categoryId" data-testid="select-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {liveCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          {cat.categoryName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streamIcon">Channel Icon URL (optional)</Label>
                <Input
                  id="streamIcon"
                  name="streamIcon"
                  defaultValue={editingChannel?.streamIcon || ""}
                  placeholder="https://example.com/icon.png"
                  data-testid="input-stream-icon"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="playlist">Playlist (one URL per line)</Label>
                <Textarea
                  id="playlist"
                  value={playlistText}
                  onChange={(e) => setPlaylistText(e.target.value)}
                  placeholder="https://example.com/video1.mp4&#10;https://example.com/video2.mp4&#10;https://example.com/video3.mp4"
                  rows={8}
                  className="font-mono text-sm"
                  data-testid="textarea-playlist"
                />
                <p className="text-xs text-muted-foreground">
                  Enter video URLs, one per line. They will loop continuously.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="enabled"
                    name="enabled"
                    defaultChecked={editingChannel?.enabled ?? true}
                  />
                  <Label htmlFor="enabled">Enabled</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="shuffle"
                    name="shuffle"
                    defaultChecked={editingChannel?.shuffle ?? false}
                  />
                  <Label htmlFor="shuffle">Shuffle Playlist</Label>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-channel"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingChannel ? "Update" : "Create"} Channel
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
          {channels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No 24/7 channels configured. Create one for continuous looping content.
            </div>
          ) : (
            channels.map((channel) => {
              const playlist = channel.playlist as { streamId: number; order: number }[] || [];
              const playlistCount = playlist.length;
              return (
                <div
                  key={channel.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-white/5"
                  data-testid={`channel-item-${channel.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                      {channel.streamIcon ? (
                        <img
                          src={channel.streamIcon}
                          alt={channel.channelName}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <Repeat className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{channel.channelName}</span>
                        <Badge variant={channel.enabled ? "default" : "secondary"}>
                          {channel.enabled ? "Active" : "Disabled"}
                        </Badge>
                        {channel.shuffle && (
                          <Badge variant="outline">Shuffle</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <List className="w-3 h-3" />
                          {playlistCount} items
                        </span>
                        {channel.currentIndex !== null && (
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            Playing: #{(channel.currentIndex || 0) + 1}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditDialog(channel)}
                      data-testid={`button-edit-${channel.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(channel.id)}
                      data-testid={`button-delete-${channel.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </Layout>
  );
}
