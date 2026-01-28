import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Clock, Save, Loader2, HardDrive, Video, Settings, FolderArchive } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import type { CatchupSettings, TranscodeProfile, Category } from "@shared/schema";

export default function CatchupSettingsPage() {
  const [formData, setFormData] = useState<Partial<CatchupSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery<CatchupSettings>({
    queryKey: ["/api/catchup/settings"],
  });

  const { data: storage } = useQuery<{
    totalArchives: number;
    storageUsedGb: number;
    activeRecordings: number;
    completedRecordings: number;
  }>({
    queryKey: ["/api/catchup/storage"],
  });

  const { data: profiles = [] } = useQuery<TranscodeProfile[]>({
    queryKey: ["/api/transcode-profiles"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<CatchupSettings>) => apiRequest("PUT", "/api/catchup/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/catchup/settings"] });
      setHasChanges(false);
      toast({ title: "Catchup settings saved" });
    },
    onError: () => toast({ title: "Failed to save settings", variant: "destructive" }),
  });

  const handleChange = (key: keyof CatchupSettings, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate({ ...settings, ...formData });
  };

  const currentSettings = { ...settings, ...formData };
  const storagePercentage = storage && currentSettings.maxStorageGb 
    ? (storage.storageUsedGb / currentSettings.maxStorageGb) * 100 
    : 0;

  if (isLoading) {
    return (
      <Layout title="Catchup Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Catchup & TV Archive Settings" subtitle="Configure TV archive recording and catchup playback">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Clock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">TV Archive & Catchup</h2>
              <p className="text-sm text-muted-foreground">Manage recording and playback settings</p>
            </div>
          </div>
          {hasChanges && (
            <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-settings">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <FolderArchive className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Archives</p>
                  <p className="text-2xl font-bold text-white" data-testid="text-total-archives">{storage?.totalArchives || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Recordings</p>
                  <p className="text-2xl font-bold text-white">{storage?.activeRecordings || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Video className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-white">{storage?.completedRecordings || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Storage Used</p>
                  <p className="text-2xl font-bold text-white">{storage?.storageUsedGb || 0} GB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-white">Storage Usage</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {storage?.storageUsedGb || 0} GB / {currentSettings.maxStorageGb || 100} GB
              </span>
            </div>
            <Progress value={storagePercentage} className="h-3" />
            <p className="text-xs text-muted-foreground mt-2">
              {storagePercentage.toFixed(1)}% used
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card/40 border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Settings
              </CardTitle>
              <CardDescription>Configure catchup functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Catchup</Label>
                  <p className="text-xs text-muted-foreground">Allow users to watch past content</p>
                </div>
                <Switch
                  checked={currentSettings.enabled ?? false}
                  onCheckedChange={(checked) => handleChange("enabled", checked)}
                  data-testid="switch-enabled"
                />
              </div>

              <div className="space-y-2">
                <Label>Retention Days</Label>
                <Input
                  type="number"
                  value={currentSettings.retentionDays ?? 7}
                  onChange={(e) => handleChange("retentionDays", parseInt(e.target.value))}
                  placeholder="7"
                  data-testid="input-retention-days"
                />
                <p className="text-xs text-muted-foreground">How long to keep archived content</p>
              </div>

              <div className="space-y-2">
                <Label>Max Storage (GB)</Label>
                <Input
                  type="number"
                  value={currentSettings.maxStorageGb ?? 100}
                  onChange={(e) => handleChange("maxStorageGb", parseInt(e.target.value))}
                  placeholder="100"
                  data-testid="input-max-storage"
                />
              </div>

              <div className="space-y-2">
                <Label>Recordings Path</Label>
                <Input
                  value={currentSettings.recordingsPath ?? "./recordings"}
                  onChange={(e) => handleChange("recordingsPath", e.target.value)}
                  placeholder="./recordings"
                  data-testid="input-recordings-path"
                />
              </div>

              <div className="space-y-2">
                <Label>Default Quality</Label>
                <Select
                  value={currentSettings.defaultQuality ?? "source"}
                  onValueChange={(value) => handleChange("defaultQuality", value)}
                >
                  <SelectTrigger data-testid="select-quality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">Source (Original)</SelectItem>
                    <SelectItem value="high">High (1080p)</SelectItem>
                    <SelectItem value="medium">Medium (720p)</SelectItem>
                    <SelectItem value="low">Low (480p)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Transcode Profile</Label>
                <Select
                  value={currentSettings.transcodeProfileId?.toString() ?? "none"}
                  onValueChange={(value) => handleChange("transcodeProfileId", value === "none" ? null : parseInt(value))}
                >
                  <SelectTrigger data-testid="select-transcode-profile">
                    <SelectValue placeholder="Select profile..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Transcoding</SelectItem>
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
                <Video className="w-5 h-5" />
                Auto-Recording
              </CardTitle>
              <CardDescription>Automatically record channels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Auto-Record</Label>
                  <p className="text-xs text-muted-foreground">Automatically record enabled channels</p>
                </div>
                <Switch
                  checked={currentSettings.autoRecordEnabled ?? false}
                  onCheckedChange={(checked) => handleChange("autoRecordEnabled", checked)}
                  data-testid="switch-auto-record"
                />
              </div>

              <div className="space-y-2">
                <Label>Cleanup Schedule (Cron)</Label>
                <Input
                  value={currentSettings.cleanupSchedule ?? "0 3 * * *"}
                  onChange={(e) => handleChange("cleanupSchedule", e.target.value)}
                  placeholder="0 3 * * *"
                  data-testid="input-cleanup-schedule"
                />
                <p className="text-xs text-muted-foreground">Default: 3 AM daily</p>
              </div>

              <div className="space-y-2">
                <Label>Auto-Record Categories</Label>
                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-2">
                  {categories.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No categories available</p>
                  ) : (
                    categories.map((category) => {
                      const isSelected = (currentSettings.autoRecordCategories as number[] || []).includes(category.id);
                      return (
                        <div key={category.id} className="flex items-center justify-between">
                          <span className="text-sm">{category.categoryName}</span>
                          <Switch
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const current = (currentSettings.autoRecordCategories as number[] || []);
                              if (checked) {
                                handleChange("autoRecordCategories", [...current, category.id]);
                              } else {
                                handleChange("autoRecordCategories", current.filter(id => id !== category.id));
                              }
                            }}
                            data-testid={`switch-category-${category.id}`}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
