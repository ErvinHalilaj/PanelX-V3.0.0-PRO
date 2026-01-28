import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Film, Save, Loader2, HardDrive, Tv, Settings, FolderOpen, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { OnDemandSettings, TranscodeProfile } from "@shared/schema";

export default function OnDemandSettingsPage() {
  const [formData, setFormData] = useState<Partial<OnDemandSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery<OnDemandSettings>({
    queryKey: ["/api/on-demand/settings"],
  });

  const { data: stats } = useQuery<{
    totalMovies: number;
    totalSeries: number;
    totalEpisodes: number;
  }>({
    queryKey: ["/api/on-demand/stats"],
  });

  const { data: profiles = [] } = useQuery<TranscodeProfile[]>({
    queryKey: ["/api/transcode-profiles"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<OnDemandSettings>) => apiRequest("PUT", "/api/on-demand/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/on-demand/settings"] });
      setHasChanges(false);
      toast({ title: "On-Demand settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const handleChange = (key: keyof OnDemandSettings, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate({ ...settings, ...formData });
  };

  const currentSettings = { ...settings, ...formData };

  if (isLoading) {
    return (
      <Layout title="On-Demand Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="On-Demand Settings" subtitle="Configure VOD and media library settings">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Film className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">On-Demand / VOD</h2>
              <p className="text-sm text-muted-foreground">Movies, series, and media management</p>
            </div>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-settings">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Film className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Movies</p>
                  <p className="text-2xl font-bold text-white" data-testid="text-total-movies">{stats?.totalMovies || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Tv className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Series</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalSeries || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Film className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Episodes</p>
                  <p className="text-2xl font-bold text-white">{stats?.totalEpisodes || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/40 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Settings
              </CardTitle>
              <CardDescription>Configure VOD functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable On-Demand</Label>
                  <p className="text-xs text-muted-foreground">Allow users to access VOD content</p>
                </div>
                <Switch
                  checked={currentSettings.enabled ?? true}
                  onCheckedChange={(checked) => handleChange("enabled", checked)}
                  data-testid="switch-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>VOD Path</Label>
                <Input
                  value={currentSettings.vodPath ?? "./vod"}
                  onChange={(e) => handleChange("vodPath", e.target.value)}
                  placeholder="./vod"
                  data-testid="input-vod-path"
                />
                <p className="text-xs text-muted-foreground">Directory for VOD files</p>
              </div>

              <div className="space-y-2">
                <Label>Max File Size (MB)</Label>
                <Input
                  type="number"
                  value={currentSettings.maxFileSize ?? 10240}
                  onChange={(e) => handleChange("maxFileSize", parseInt(e.target.value))}
                  placeholder="10240"
                  data-testid="input-max-file-size"
                />
              </div>

              <div className="space-y-2">
                <Label>Allowed Extensions</Label>
                <div className="flex flex-wrap gap-1">
                  {(currentSettings.allowedExtensions as string[] || ["mp4", "mkv", "avi", "ts", "m2ts"]).map((ext) => (
                    <Badge key={ext} variant="secondary" className="text-xs">
                      .{ext}
                    </Badge>
                  ))}
                </div>
                <Input
                  value={(currentSettings.allowedExtensions as string[] || []).join(", ")}
                  onChange={(e) => handleChange("allowedExtensions", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder="mp4, mkv, avi, ts, m2ts"
                  data-testid="input-extensions"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                Auto-Scan
              </CardTitle>
              <CardDescription>Automatically scan for new media files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Scan</Label>
                  <p className="text-xs text-muted-foreground">Automatically detect new files</p>
                </div>
                <Switch
                  checked={currentSettings.autoScanEnabled ?? false}
                  onCheckedChange={(checked) => handleChange("autoScanEnabled", checked)}
                  data-testid="switch-auto-scan"
                />
              </div>

              <div className="space-y-2">
                <Label>Scan Interval (minutes)</Label>
                <Input
                  type="number"
                  value={currentSettings.scanInterval ?? 60}
                  onChange={(e) => handleChange("scanInterval", parseInt(e.target.value))}
                  placeholder="60"
                  data-testid="input-scan-interval"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Fetch Metadata</Label>
                  <p className="text-xs text-muted-foreground">Fetch info from TMDB</p>
                </div>
                <Switch
                  checked={currentSettings.autoFetchMetadata ?? true}
                  onCheckedChange={(checked) => handleChange("autoFetchMetadata", checked)}
                  data-testid="switch-auto-metadata"
                />
              </div>

              <div className="space-y-2">
                <Label>TMDB API Key</Label>
                <Input
                  type="password"
                  value={currentSettings.tmdbApiKey ?? ""}
                  onChange={(e) => handleChange("tmdbApiKey", e.target.value)}
                  placeholder="Enter TMDB API key..."
                  data-testid="input-tmdb-key"
                />
                <p className="text-xs text-muted-foreground">Required for metadata fetching</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="w-5 h-5" />
                Transcoding
              </CardTitle>
              <CardDescription>Convert VOD files on-the-fly</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Transcoding</Label>
                  <p className="text-xs text-muted-foreground">Transcode VOD files</p>
                </div>
                <Switch
                  checked={currentSettings.transcodeEnabled ?? false}
                  onCheckedChange={(checked) => handleChange("transcodeEnabled", checked)}
                  data-testid="switch-transcode"
                />
              </div>

              <div className="space-y-2">
                <Label>Default Transcode Profile</Label>
                <Select
                  value={currentSettings.defaultTranscodeProfileId?.toString() ?? "none"}
                  onValueChange={(value) => handleChange("defaultTranscodeProfileId", value === "none" ? null : parseInt(value))}
                >
                  <SelectTrigger data-testid="select-transcode-profile">
                    <SelectValue placeholder="Select profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Default Profile</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id.toString()}>
                        {profile.profileName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Thumbnails
              </CardTitle>
              <CardDescription>Generate preview thumbnails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Generate Thumbnails</Label>
                  <p className="text-xs text-muted-foreground">Create preview images</p>
                </div>
                <Switch
                  checked={currentSettings.generateThumbnails ?? true}
                  onCheckedChange={(checked) => handleChange("generateThumbnails", checked)}
                  data-testid="switch-thumbnails"
                />
              </div>

              <div className="space-y-2">
                <Label>Thumbnail Interval (seconds)</Label>
                <Input
                  type="number"
                  value={currentSettings.thumbnailInterval ?? 300}
                  onChange={(e) => handleChange("thumbnailInterval", parseInt(e.target.value))}
                  placeholder="300"
                  data-testid="input-thumbnail-interval"
                />
                <p className="text-xs text-muted-foreground">Time between captured frames</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
