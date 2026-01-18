import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Edit, Radio } from "lucide-react";
import { insertCreatedChannelSchema, type CreatedChannel, type InsertCreatedChannel } from "@shared/schema";

const channelFormSchema = insertCreatedChannelSchema.extend({
  channelName: insertCreatedChannelSchema.shape.channelName.min(1, "Channel name is required")
});

type ChannelFormValues = InsertCreatedChannel;

export default function CreatedChannels() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<CreatedChannel | null>(null);

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelFormSchema),
    defaultValues: {
      channelName: "",
      rtmpSource: "",
      hlsOutput: "",
      streamIcon: "",
      notes: "",
      transcodeEnabled: true,
      autoRestart: true,
      delayMinutes: 0,
      rtmpOutput: false,
      externalPush: "",
      epgChannelId: "",
      epgLang: "en",
      channelOrder: 0,
      allowRecord: false,
      tvArchiveDuration: 0
    }
  });

  const { data: channels = [], isLoading } = useQuery<CreatedChannel[]>({
    queryKey: ["/api/created-channels"]
  });

  const createMutation = useMutation({
    mutationFn: async (data: ChannelFormValues) => {
      return apiRequest("/api/created-channels", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/created-channels"] });
      toast({ title: "Channel created successfully" });
      form.reset();
      setIsDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<ChannelFormValues> }) => {
      return apiRequest(`/api/created-channels/${id}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/created-channels"] });
      toast({ title: "Channel updated successfully" });
      form.reset();
      setIsDialogOpen(false);
      setEditingChannel(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/created-channels/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/created-channels"] });
      toast({ title: "Channel deleted successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const openEditDialog = (channel: CreatedChannel) => {
    setEditingChannel(channel);
    form.reset({
      channelName: channel.channelName,
      rtmpSource: channel.rtmpSource || "",
      hlsOutput: channel.hlsOutput || "",
      streamIcon: channel.streamIcon || "",
      notes: channel.notes || "",
      transcodeEnabled: channel.transcodeEnabled ?? true,
      autoRestart: channel.autoRestart ?? true,
      delayMinutes: channel.delayMinutes ?? 0,
      rtmpOutput: channel.rtmpOutput ?? false,
      externalPush: channel.externalPush || "",
      epgChannelId: channel.epgChannelId || "",
      epgLang: channel.epgLang || "en",
      channelOrder: channel.channelOrder ?? 0,
      allowRecord: channel.allowRecord ?? false,
      tvArchiveDuration: channel.tvArchiveDuration ?? 0
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (data: ChannelFormValues) => {
    if (editingChannel) {
      updateMutation.mutate({ id: editingChannel.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-500">Running</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Stopped</Badge>;
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Created Channels</h1>
          <p className="text-muted-foreground">Manage RTMP to HLS live transcoded channels</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { form.reset(); setEditingChannel(null); } }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-channel">
              <Plus className="w-4 h-4 mr-2" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingChannel ? "Edit Channel" : "Create Channel"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="channelName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Channel Name</FormLabel>
                        <FormControl>
                          <Input data-testid="input-channel-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="channelOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Order</FormLabel>
                        <FormControl>
                          <Input type="number" data-testid="input-channel-order" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="rtmpSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RTMP Source URL</FormLabel>
                      <FormControl>
                        <Input placeholder="rtmp://example.com/live/stream" data-testid="input-rtmp-source" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="hlsOutput"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>HLS Output Path</FormLabel>
                      <FormControl>
                        <Input placeholder="/hls/channel1/stream.m3u8" data-testid="input-hls-output" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="streamIcon"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stream Icon URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/icon.png" data-testid="input-stream-icon" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="epgChannelId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EPG Channel ID</FormLabel>
                        <FormControl>
                          <Input data-testid="input-epg-channel-id" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="epgLang"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EPG Language</FormLabel>
                        <FormControl>
                          <Input data-testid="input-epg-lang" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="delayMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delay (minutes)</FormLabel>
                        <FormControl>
                          <Input type="number" data-testid="input-delay-minutes" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tvArchiveDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TV Archive Duration (days)</FormLabel>
                        <FormControl>
                          <Input type="number" data-testid="input-tv-archive-duration" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="externalPush"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>External Push URL (CDN)</FormLabel>
                      <FormControl>
                        <Input placeholder="rtmp://cdn.example.com/live" data-testid="input-external-push" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Input data-testid="input-notes" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="transcodeEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-transcode-enabled" />
                        </FormControl>
                        <FormLabel className="!mt-0">Enable Transcoding</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="autoRestart"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-auto-restart" />
                        </FormControl>
                        <FormLabel className="!mt-0">Auto Restart</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="rtmpOutput"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-rtmp-output" />
                        </FormControl>
                        <FormLabel className="!mt-0">RTMP Output</FormLabel>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="allowRecord"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-allow-record" />
                        </FormControl>
                        <FormLabel className="!mt-0">Allow Recording</FormLabel>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); form.reset(); setEditingChannel(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-channel" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingChannel ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {channels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Radio className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No created channels yet</p>
              <p className="text-sm text-muted-foreground">Add your first RTMP to HLS channel to get started</p>
            </CardContent>
          </Card>
        ) : (
          channels.map((channel) => (
            <Card key={channel.id} data-testid={`card-channel-${channel.id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  {channel.streamIcon && (
                    <img src={channel.streamIcon} alt="" className="w-10 h-10 rounded object-cover" />
                  )}
                  <div>
                    <CardTitle className="text-lg">{channel.channelName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{channel.rtmpSource}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(channel.status)}
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(channel)} data-testid={`button-edit-channel-${channel.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(channel.id)}
                    data-testid={`button-delete-channel-${channel.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">HLS Output:</span>
                    <p className="font-mono text-xs truncate">{channel.hlsOutput || "Not set"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transcode:</span>
                    <p>{channel.transcodeEnabled ? "Enabled" : "Disabled"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Auto Restart:</span>
                    <p>{channel.autoRestart ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delay:</span>
                    <p>{channel.delayMinutes || 0} min</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
