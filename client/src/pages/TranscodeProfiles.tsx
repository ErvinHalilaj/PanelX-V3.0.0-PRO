import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Radio, Plus, Trash2, Settings, Edit2 } from "lucide-react";
import { useState } from "react";
import type { TranscodeProfile } from "@shared/schema";

const defaultFormData = {
  profileName: "",
  videoCodec: "libx264",
  audioCodec: "aac",
  videoBitrate: "4000k",
  audioBitrate: "128k",
  resolution: "1920x1080",
  preset: "fast",
  customParams: "",
  enabled: true,
};

export default function TranscodeProfiles() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<TranscodeProfile | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const { data: profiles = [], isLoading } = useQuery<TranscodeProfile[]>({
    queryKey: ["/api/transcode-profiles"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/transcode-profiles", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcode-profiles"] });
      setIsOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Transcode profile created successfully" });
    },
    onError: () => toast({ title: "Failed to create profile", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) => apiRequest("PUT", `/api/transcode-profiles/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcode-profiles"] });
      setIsOpen(false);
      setEditingProfile(null);
      setFormData(defaultFormData);
      toast({ title: "Profile updated successfully" });
    },
    onError: () => toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/transcode-profiles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transcode-profiles"] });
      toast({ title: "Profile deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProfile) {
      updateMutation.mutate({ id: editingProfile.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (profile: TranscodeProfile) => {
    setEditingProfile(profile);
    setFormData({
      profileName: profile.profileName,
      videoCodec: profile.videoCodec || "libx264",
      audioCodec: profile.audioCodec || "aac",
      videoBitrate: profile.videoBitrate || "4000k",
      audioBitrate: profile.audioBitrate || "128k",
      resolution: profile.resolution || "1920x1080",
      preset: profile.preset || "fast",
      customParams: profile.customParams || "",
      enabled: profile.enabled ?? true,
    });
    setIsOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingProfile(null);
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
              <Radio className="w-8 h-8 text-primary" />
              Transcode Profiles
            </h1>
            <p className="text-muted-foreground mt-1">Configure FFmpeg transcoding settings for streams</p>
          </div>
          <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-profile">
                <Plus className="w-4 h-4" /> Add Profile
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingProfile ? "Edit Transcode Profile" : "Add Transcode Profile"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Profile Name</Label>
                  <Input value={formData.profileName} onChange={(e) => setFormData({ ...formData, profileName: e.target.value })} placeholder="HD 1080p" required data-testid="input-profile-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Video Codec</Label>
                    <Select value={formData.videoCodec} onValueChange={(val) => setFormData({ ...formData, videoCodec: val })}>
                      <SelectTrigger data-testid="select-video-codec">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="copy">Copy (no transcode)</SelectItem>
                        <SelectItem value="libx264">H.264 (libx264)</SelectItem>
                        <SelectItem value="libx265">H.265 (libx265)</SelectItem>
                        <SelectItem value="h264_nvenc">NVENC H.264</SelectItem>
                        <SelectItem value="hevc_nvenc">NVENC H.265</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Audio Codec</Label>
                    <Select value={formData.audioCodec} onValueChange={(val) => setFormData({ ...formData, audioCodec: val })}>
                      <SelectTrigger data-testid="select-audio-codec">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="copy">Copy</SelectItem>
                        <SelectItem value="aac">AAC</SelectItem>
                        <SelectItem value="ac3">AC3</SelectItem>
                        <SelectItem value="mp3">MP3</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Video Bitrate</Label>
                    <Input value={formData.videoBitrate} onChange={(e) => setFormData({ ...formData, videoBitrate: e.target.value })} placeholder="4000k" data-testid="input-video-bitrate" />
                  </div>
                  <div className="space-y-2">
                    <Label>Audio Bitrate</Label>
                    <Input value={formData.audioBitrate} onChange={(e) => setFormData({ ...formData, audioBitrate: e.target.value })} placeholder="128k" data-testid="input-audio-bitrate" />
                  </div>
                  <div className="space-y-2">
                    <Label>Resolution</Label>
                    <Select value={formData.resolution} onValueChange={(val) => setFormData({ ...formData, resolution: val })}>
                      <SelectTrigger data-testid="select-resolution">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3840x2160">4K (3840x2160)</SelectItem>
                        <SelectItem value="1920x1080">1080p (1920x1080)</SelectItem>
                        <SelectItem value="1280x720">720p (1280x720)</SelectItem>
                        <SelectItem value="854x480">480p (854x480)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Preset</Label>
                  <Select value={formData.preset} onValueChange={(val) => setFormData({ ...formData, preset: val })}>
                    <SelectTrigger data-testid="select-preset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ultrafast">Ultra Fast</SelectItem>
                      <SelectItem value="superfast">Super Fast</SelectItem>
                      <SelectItem value="veryfast">Very Fast</SelectItem>
                      <SelectItem value="fast">Fast</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="slow">Slow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Custom FFmpeg Parameters</Label>
                  <Textarea value={formData.customParams} onChange={(e) => setFormData({ ...formData, customParams: e.target.value })} placeholder="-threads 4 -g 50" rows={2} data-testid="input-custom-params" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.enabled} onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })} data-testid="switch-enabled" />
                  <Label>Enabled</Label>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-profile">
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (editingProfile ? "Save Changes" : "Create Profile")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-10">Loading...</div>
        ) : profiles.length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="py-10 text-center">
              <Radio className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No transcode profiles configured</p>
              <p className="text-sm text-muted-foreground mt-1">Add profiles to enable stream transcoding</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <Card key={profile.id} className="bg-card/50 border-border/50" data-testid={`card-profile-${profile.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="w-5 h-5 text-primary" />
                    {profile.profileName}
                  </CardTitle>
                  <Badge variant={profile.enabled ? "default" : "secondary"}>
                    {profile.enabled ? "Active" : "Disabled"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Video:</span>
                      <span>{profile.videoCodec} @ {profile.videoBitrate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Audio:</span>
                      <span>{profile.audioCodec} @ {profile.audioBitrate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Resolution:</span>
                      <span>{profile.resolution}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preset:</span>
                      <span>{profile.preset}</span>
                    </div>
                  </div>
                  <div className="flex justify-end mt-4 gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(profile)} data-testid={`button-edit-profile-${profile.id}`}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(profile.id)} className="text-destructive" data-testid={`button-delete-profile-${profile.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
