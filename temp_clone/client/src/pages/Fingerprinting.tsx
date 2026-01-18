import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Fingerprint, Type, Image, Loader2, Save, AlertTriangle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import type { FingerprintSettings } from "@shared/schema";

export default function Fingerprinting() {
  const { data: settings, isLoading, isError } = useQuery<FingerprintSettings | null>({
    queryKey: ["/api/fingerprint-settings"],
  });

  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("{username}");
  const [imageUrl, setImageUrl] = useState("");
  const [position, setPosition] = useState("bottom-right");
  const [opacity, setOpacity] = useState(50);
  const [fontSize, setFontSize] = useState(24);
  const [fontColor, setFontColor] = useState("#FFFFFF");
  const [fingerprintType, setFingerprintType] = useState("text");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled ?? false);
      setText(settings.text ?? "{username}");
      setImageUrl(settings.imageUrl ?? "");
      setPosition(settings.position ?? "bottom-right");
      setOpacity(settings.opacity ?? 50);
      setFontSize(settings.fontSize ?? 24);
      setFontColor(settings.fontColor ?? "#FFFFFF");
      setFingerprintType(settings.fingerprintType ?? "text");
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/fingerprint-settings/${settings?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fingerprint-settings"] });
      toast({ title: "Fingerprint settings updated successfully" });
    },
    onError: () => toast({ title: "Failed to update settings", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/fingerprint-settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fingerprint-settings"] });
      toast({ title: "Fingerprint settings created successfully" });
    },
    onError: () => toast({ title: "Failed to create settings", variant: "destructive" }),
  });

  const handleSave = () => {
    const data = {
      name: settings?.name ?? "Default Fingerprint",
      enabled,
      fingerprintType,
      text,
      imageUrl: imageUrl || null,
      position,
      opacity,
      fontSize,
      fontColor,
    };

    if (settings?.id) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isError) {
    return (
      <Layout title="Fingerprint Watermarking" subtitle="Configure stream watermarking for security">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load fingerprint settings. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Fingerprint Watermarking" subtitle="Configure stream watermarking for security">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-3xl space-y-6">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Fingerprint watermarking embeds invisible or visible identifiers in streams to track
              unauthorized redistribution. This feature requires FFmpeg processing and may increase
              server load.
            </AlertDescription>
          </Alert>

          <div className="p-6 rounded-lg bg-secondary/30 border border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Fingerprint className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Watermarking</h3>
                  <p className="text-sm text-muted-foreground">Enable stream fingerprinting</p>
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                data-testid="switch-enabled"
              />
            </div>

            <Tabs value={fingerprintType} onValueChange={setFingerprintType} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="text" data-testid="tab-text">
                  <Type className="w-4 h-4 mr-2" /> Text Watermark
                </TabsTrigger>
                <TabsTrigger value="image" data-testid="tab-image">
                  <Image className="w-4 h-4 mr-2" /> Image Watermark
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="text">Watermark Text</Label>
                  <Input
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="{username} - {ip}"
                    data-testid="input-watermark-text"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available variables: {"{username}"}, {"{ip}"}, {"{date}"}, {"{time}"}, {"{line_id}"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fontSize">Font Size</Label>
                    <Input
                      id="fontSize"
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value) || 24)}
                      min={8}
                      max={72}
                      data-testid="input-font-size"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fontColor">Font Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="fontColor"
                        type="color"
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value)}
                        className="w-12 h-9 p-1"
                        data-testid="input-font-color"
                      />
                      <Input
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value)}
                        placeholder="#FFFFFF"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Watermark Image URL</Label>
                  <Input
                    id="imageUrl"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    data-testid="input-watermark-image"
                  />
                  <p className="text-xs text-muted-foreground">
                    Recommended: PNG with transparency, max 200x200 pixels
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-4 mt-6 pt-6 border-t border-white/10">
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger data-testid="select-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="top-left">Top Left</SelectItem>
                    <SelectItem value="top-right">Top Right</SelectItem>
                    <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    <SelectItem value="bottom-right">Bottom Right</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="random">Random</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Opacity</Label>
                  <span className="text-sm text-muted-foreground">{opacity}%</span>
                </div>
                <Slider
                  value={[opacity]}
                  onValueChange={([value]) => setOpacity(value)}
                  min={10}
                  max={100}
                  step={5}
                  data-testid="slider-opacity"
                />
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending || createMutation.isPending}
                data-testid="button-save-settings"
              >
                {(updateMutation.isPending || createMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                <Save className="w-4 h-4 mr-2" /> Save Settings
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
