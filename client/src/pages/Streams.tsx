import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { Layout } from "@/components/Layout";
import { useStreams, useCreateStream, useDeleteStream } from "@/hooks/use-streams";
import { useCategories } from "@/hooks/use-categories";
import { useServers } from "@/hooks/use-servers";
import { useTranscodeProfiles } from "@/hooks/use-transcode-profiles";
import { useImportM3U, useBulkDeleteStreams, useBulkUpdateStreams } from "@/hooks/use-bulk";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Edit2, Play, AlertCircle, Filter, X, Maximize2, Minimize2, Volume1, Volume2, VolumeX, Info, Tv, Radio, Film, Gauge, Clock, Wifi, Upload, FileText, CheckSquare, Square, Globe, PlayCircle, StopCircle, RotateCw, Download, FileSpreadsheet, Power, Server as ServerIcon, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertStreamSchema, type InsertStream, type Stream } from "@shared/schema";

function StreamForm({ onSubmit, categories, servers, transcodeProfiles, isLoading, initialData }: { onSubmit: (data: InsertStream) => void, categories: any[], servers: any[], transcodeProfiles: any[], isLoading: boolean, initialData?: Partial<Stream> }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [backupUrls, setBackupUrls] = useState<string[]>(initialData?.backupUrls || []);
  const [newBackupUrl, setNewBackupUrl] = useState("");
  
  const form = useForm<InsertStream>({
    resolver: zodResolver(insertStreamSchema),
    defaultValues: {
      name: initialData?.name || "",
      sourceUrl: initialData?.sourceUrl || "",
      categoryId: initialData?.categoryId || undefined,
      streamType: initialData?.streamType || "live",
      serverId: initialData?.serverId || undefined,
      transcodeProfileId: initialData?.transcodeProfileId || undefined,
      streamIcon: initialData?.streamIcon || "",
      customSid: initialData?.customSid || "",
      notes: initialData?.notes || "",
      isDirect: initialData?.isDirect || false,
      onDemand: initialData?.onDemand || false,
      autoRestartHours: initialData?.autoRestartHours || 0,
      delayMinutes: initialData?.delayMinutes || 0,
      rtmpOutput: initialData?.rtmpOutput || "",
      readNative: initialData?.readNative || false,
      streamAll: initialData?.streamAll || false,
      removeSubtitles: initialData?.removeSubtitles || false,
      genTimestamps: initialData?.genTimestamps || false,
      allowRecord: initialData?.allowRecord !== false,
      tvArchiveEnabled: initialData?.tvArchiveEnabled || false,
      tvArchiveDuration: initialData?.tvArchiveDuration || 0,
      backupUrls: initialData?.backupUrls || [],
      customFfmpeg: initialData?.customFfmpeg || "",
    }
  });

  const addBackupUrl = () => {
    if (newBackupUrl.trim() && !backupUrls.includes(newBackupUrl.trim())) {
      const updated = [...backupUrls, newBackupUrl.trim()];
      setBackupUrls(updated);
      form.setValue("backupUrls", updated);
      setNewBackupUrl("");
    }
  };

  const removeBackupUrl = (index: number) => {
    const updated = backupUrls.filter((_, i) => i !== index);
    setBackupUrls(updated);
    form.setValue("backupUrls", updated);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-2">
        <Label htmlFor="name">Stream Name</Label>
        <Input id="name" {...form.register("name")} placeholder="e.g. Sky Sports 1 HD" data-testid="input-stream-name" />
        {form.formState.errors.name && <p className="text-red-500 text-xs">{form.formState.errors.name.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="sourceUrl">Source URL</Label>
        <Input id="sourceUrl" {...form.register("sourceUrl")} placeholder="http://source:8080/..." data-testid="input-source-url" />
        {form.formState.errors.sourceUrl && <p className="text-red-500 text-xs">{form.formState.errors.sourceUrl.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select 
            value={form.watch("categoryId")?.toString() || ""} 
            onValueChange={(val) => form.setValue("categoryId", parseInt(val))}
          >
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Stream Type</Label>
          <Select 
            value={form.watch("streamType") || "live"} 
            onValueChange={(val) => form.setValue("streamType", val)}
          >
            <SelectTrigger data-testid="select-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="live">Live Stream</SelectItem>
              <SelectItem value="movie">Movie</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ServerIcon className="h-4 w-4" />
            Server (Optional)
          </Label>
          <Select 
            value={form.watch("serverId")?.toString() || "auto"} 
            onValueChange={(val) => form.setValue("serverId", val === "auto" ? undefined : parseInt(val))}
          >
            <SelectTrigger data-testid="select-server">
              <SelectValue placeholder="Auto (Main Server)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto (Main Server)</SelectItem>
              {servers.map((server) => (
                <SelectItem key={server.id} value={server.id.toString()}>
                  {server.serverName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Assign stream to specific server</p>
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Transcode Profile (Optional)
          </Label>
          <Select 
            value={form.watch("transcodeProfileId")?.toString() || "none"} 
            onValueChange={(val) => form.setValue("transcodeProfileId", val === "none" ? undefined : parseInt(val))}
          >
            <SelectTrigger data-testid="select-transcode">
              <SelectValue placeholder="No Transcoding (Copy)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Transcoding (Copy)</SelectItem>
              {transcodeProfiles.map((profile) => (
                <SelectItem key={profile.id} value={profile.id.toString()}>
                  {profile.profileName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Apply transcoding to stream</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="streamIcon">Stream Icon URL</Label>
          <Input 
            id="streamIcon" 
            {...form.register("streamIcon")} 
            placeholder="https://example.com/icon.png" 
            data-testid="input-stream-icon" 
          />
          <p className="text-xs text-muted-foreground">Channel logo/icon URL</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="customSid">Custom Service ID</Label>
          <Input 
            id="customSid" 
            {...form.register("customSid")} 
            placeholder="e.g. 1:0:1:..." 
            data-testid="input-custom-sid" 
          />
          <p className="text-xs text-muted-foreground">For Enigma2 devices</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Admin/Reseller Notes</Label>
        <Textarea 
          id="notes" 
          {...form.register("notes")} 
          placeholder="Internal notes about this stream..."
          rows={2}
          data-testid="input-notes" 
        />
        <p className="text-xs text-muted-foreground">Private notes (not visible to end users)</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 p-3 border border-white/10 rounded-lg">
          <Checkbox
            id="tvArchiveEnabled"
            checked={form.watch("tvArchiveEnabled") || false}
            onCheckedChange={(v) => form.setValue("tvArchiveEnabled", !!v)}
            data-testid="checkbox-archive-enabled"
          />
          <Label htmlFor="tvArchiveEnabled" className="text-sm cursor-pointer">
            Enable TV Archive (Catchup)
          </Label>
        </div>
        {form.watch("tvArchiveEnabled") && (
          <div className="space-y-2">
            <Label htmlFor="tvArchiveDuration">Archive Duration (days)</Label>
            <Input
              id="tvArchiveDuration"
              type="number"
              {...form.register("tvArchiveDuration", { valueAsNumber: true })}
              placeholder="7"
              data-testid="input-archive-duration"
            />
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-xs text-muted-foreground"
        data-testid="button-toggle-advanced"
      >
        {showAdvanced ? "Hide" : "Show"} Advanced Options
      </Button>

      {showAdvanced && (
        <div className="space-y-4 border border-white/10 rounded-lg p-4">
          <h4 className="font-medium text-sm text-muted-foreground">Advanced Stream Options</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Auto-Restart (hours)</Label>
              <Input
                type="number"
                {...form.register("autoRestartHours", { valueAsNumber: true })}
                placeholder="0 = disabled"
                data-testid="input-auto-restart"
              />
              <p className="text-xs text-muted-foreground">Restart stream every N hours</p>
            </div>
            <div className="space-y-2">
              <Label>Delay Minutes</Label>
              <Input
                type="number"
                {...form.register("delayMinutes", { valueAsNumber: true })}
                placeholder="0"
                data-testid="input-delay"
              />
              <p className="text-xs text-muted-foreground">Add delay for timeshift</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="onDemand"
                checked={form.watch("onDemand") || false}
                onCheckedChange={(v) => form.setValue("onDemand", !!v)}
                data-testid="checkbox-on-demand"
              />
              <Label htmlFor="onDemand" className="text-sm">On-Demand Mode</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="isDirect"
                checked={!!form.watch("isDirect")}
                onCheckedChange={(v) => form.setValue("isDirect", !!v)}
                data-testid="checkbox-direct"
              />
              <Label htmlFor="isDirect" className="text-sm">Direct Source</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="readNative"
                checked={form.watch("readNative") || false}
                onCheckedChange={(v) => form.setValue("readNative", !!v)}
                data-testid="checkbox-read-native"
              />
              <Label htmlFor="readNative" className="text-sm">Read Native</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="streamAll"
                checked={form.watch("streamAll") || false}
                onCheckedChange={(v) => form.setValue("streamAll", !!v)}
                data-testid="checkbox-stream-all"
              />
              <Label htmlFor="streamAll" className="text-sm">Stream All</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="removeSubtitles"
                checked={form.watch("removeSubtitles") || false}
                onCheckedChange={(v) => form.setValue("removeSubtitles", !!v)}
                data-testid="checkbox-remove-subs"
              />
              <Label htmlFor="removeSubtitles" className="text-sm">Remove Subtitles</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="genTimestamps"
                checked={form.watch("genTimestamps") || false}
                onCheckedChange={(v) => form.setValue("genTimestamps", !!v)}
                data-testid="checkbox-timestamps"
              />
              <Label htmlFor="genTimestamps" className="text-sm">Generate Timestamps</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="allowRecord"
                checked={form.watch("allowRecord") !== false}
                onCheckedChange={(v) => form.setValue("allowRecord", !!v)}
                data-testid="checkbox-allow-record"
              />
              <Label htmlFor="allowRecord" className="text-sm">Allow Recording</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>RTMP Output URL</Label>
            <Input
              {...form.register("rtmpOutput")}
              placeholder="rtmp://server/app/stream_key"
              data-testid="input-rtmp-output"
            />
            <p className="text-xs text-muted-foreground">Push stream to external RTMP destination</p>
          </div>

          <div className="space-y-2">
            <Label>Backup URLs (Failover Sources)</Label>
            <div className="flex gap-2">
              <Input
                value={newBackupUrl}
                onChange={(e) => setNewBackupUrl(e.target.value)}
                placeholder="http://backup-source/stream"
                data-testid="input-backup-url"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBackupUrl(); } }}
              />
              <Button type="button" size="sm" onClick={addBackupUrl} data-testid="button-add-backup">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {backupUrls.length > 0 && (
              <div className="space-y-1 mt-2">
                {backupUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm bg-white/5 rounded px-2 py-1">
                    <span className="text-muted-foreground">#{index + 1}</span>
                    <span className="flex-1 truncate">{url}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeBackupUrl(index)} data-testid={`button-remove-backup-${index}`}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Add backup sources that will be tried if primary fails</p>
          </div>

          <div className="space-y-2">
            <Label>Custom FFmpeg Command</Label>
            <Input
              {...form.register("customFfmpeg")}
              placeholder="-vcodec copy -acodec copy"
              data-testid="input-custom-ffmpeg"
            />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-submit-stream">
          {isLoading ? (initialData ? "Updating..." : "Creating...") : (initialData ? "Update Stream" : "Add Stream")}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface VideoPlayerProps {
  stream: Stream;
  onClose: () => void;
}

function VideoPlayer({ stream, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState({
    resolution: "—",
    codec: "—",
    bitrate: "—",
    fps: "—",
    buffered: 0,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    const updateVideoInfo = () => {
      if (video.videoWidth && video.videoHeight) {
        setVideoInfo(prev => ({
          ...prev,
          resolution: `${video.videoWidth}x${video.videoHeight}`,
        }));
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        const duration = video.duration || bufferedEnd;
        setVideoInfo(prev => ({
          ...prev,
          buffered: Math.round((bufferedEnd / duration) * 100),
        }));
      }
    };

    video.addEventListener("loadedmetadata", updateVideoInfo);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("progress", handleProgress);

    // Use the direct source URL for testing (admin preview)
    const sourceUrl = stream.sourceUrl;
    const isHls = sourceUrl.includes(".m3u8") || sourceUrl.includes("m3u8");
    
    // For direct URL streams, try to play directly first
    const playUrl = sourceUrl;

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        xhrSetup: (xhr: XMLHttpRequest) => {
          // Allow cross-origin requests for testing
          xhr.withCredentials = false;
        },
      });
      
      // Try direct source URL first
      hls.loadSource(playUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch((err) => {
          console.error("Autoplay failed:", err);
          // Autoplay may fail, but show controls for manual play
        });
      });
      
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        setVideoInfo(prev => ({
          ...prev,
          bitrate: data.details.averagetargetduration ? `${Math.round(data.details.averagetargetduration)}s` : "—",
        }));
      });
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error("HLS Error:", data);
        if (data.fatal) {
          setIsLoading(false);
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError(`Network error loading stream. 
              
              Possible causes:
              • The stream source is offline or unreachable
              • CORS policy blocking the request
              • Invalid or expired stream URL
              
              Stream URL: ${playUrl}
              
              Try opening this URL in VLC Media Player for testing.`);
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              setError(`Media error: ${data.details}. The stream format may be incompatible.`);
              break;
            default:
              setError(`Playback error: ${data.details}`);
          }
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS support
      video.src = playUrl;
      video.addEventListener("canplay", () => {
        setIsLoading(false);
      });
      video.addEventListener("error", (e) => {
        setIsLoading(false);
        setError(`Stream unavailable. Error: ${(e.target as HTMLVideoElement).error?.message || 'Unknown error'}`);
      });
      video.play().catch((err) => {
        console.error("Autoplay failed:", err);
      });
    } else {
      // For non-HLS streams, try direct playback
      video.src = playUrl;
      video.addEventListener("canplay", () => {
        setIsLoading(false);
      });
      video.addEventListener("error", (e) => {
        setIsLoading(false);
        const mediaError = (e.target as HTMLVideoElement).error;
        setError(`Cannot play this stream format in browser.
        
        Error: ${mediaError?.message || 'Unknown error'}
        
        ✅ To test this stream:
        1. Copy this URL: ${playUrl}
        2. Open VLC Media Player
        3. Go to Media → Open Network Stream
        4. Paste the URL and click Play
        
        Or use IPTV apps like IPTV Smarters, TiviMate, etc.`);
      });
      video.play().catch((err) => {
        console.error("Autoplay failed:", err);
      });
    }

    return () => {
      video.removeEventListener("loadedmetadata", updateVideoInfo);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("progress", handleProgress);
      if (hls) {
        hls.destroy();
      }
    };
  }, [stream.id, stream.sourceUrl]);

  const toggleFullscreen = async () => {
    if (!playerRef.current) return;
    
    if (!document.fullscreenElement) {
      await playerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      if (newVolume === 0) {
        setIsMuted(true);
        videoRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        videoRef.current.muted = false;
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
      } else {
        videoRef.current.pause();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="video-player-overlay"
    >
      <div 
        ref={playerRef}
        className={`bg-black rounded-xl overflow-hidden shadow-2xl flex flex-col ${isFullscreen ? "w-full h-full rounded-none" : "w-[900px] max-w-[90vw] max-h-[85vh]"}`}
      >
        <div className="flex items-center justify-between p-3 bg-gradient-to-b from-zinc-900 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              {stream.streamType === "live" ? <Tv className="w-4 h-4 text-primary" /> : <Film className="w-4 h-4 text-primary" />}
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">{stream.name}</h3>
              <p className="text-xs text-muted-foreground">
                {stream.streamType === "live" ? "Live Stream" : "Video on Demand"}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-white hover:bg-white/10 h-8 w-8"
            data-testid="button-close-player"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] relative">
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm">Loading stream...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <AlertCircle className="w-10 h-10 text-red-500" />
                <span className="text-white text-sm max-w-md">{error}</span>
                <p className="text-xs text-muted-foreground">The stream source may be unavailable or blocked.</p>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            onClick={togglePlay}
            autoPlay
            playsInline
            data-testid="video-element"
          />
        </div>

        <div className="bg-gradient-to-t from-zinc-900 to-transparent p-3">
          {stream.streamType === "live" && (
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md">
                <Gauge className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-white">Resolution: <span className="text-blue-400">{videoInfo.resolution}</span></span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-white/10 rounded-md">
                <Wifi className="w-3 h-3 text-green-400" />
                <span className="text-xs text-white">Buffer: <span className="text-green-400">{videoInfo.buffered}%</span></span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-md">
                <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                <span className="text-xs text-red-400 font-medium">LIVE</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/10 h-8 w-8"
                data-testid="button-play-pause"
              >
                {isPlaying ? (
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>
              <div className="flex items-center gap-2 group">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/10 h-8 w-8"
                  data-testid="button-mute"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : volume < 0.5 ? (
                    <Volume1 className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </Button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none 
                    [&::-webkit-slider-thumb]:w-3 
                    [&::-webkit-slider-thumb]:h-3 
                    [&::-webkit-slider-thumb]:bg-white 
                    [&::-webkit-slider-thumb]:rounded-full 
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-moz-range-thumb]:w-3 
                    [&::-moz-range-thumb]:h-3 
                    [&::-moz-range-thumb]:bg-white 
                    [&::-moz-range-thumb]:rounded-full 
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:cursor-pointer"
                  data-testid="slider-volume"
                />
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={toggleFullscreen}
              className="text-white hover:bg-white/10 h-8 w-8"
              data-testid="button-fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StreamInfoBadges({ stream }: { stream: Stream }) {
  const getStatusColor = () => {
    if (stream.monitorStatus === "online") return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    if (stream.monitorStatus === "offline") return "bg-red-500/10 text-red-500 border-red-500/20";
    return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor()}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${stream.monitorStatus === "online" ? "bg-emerald-500 animate-pulse" : stream.monitorStatus === "offline" ? "bg-red-500" : "bg-yellow-500"}`} />
        {stream.monitorStatus === "online" ? "Online" : stream.monitorStatus === "offline" ? "Offline" : "Unknown"}
      </span>
      {stream.streamType === "live" && (
        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
          <Radio className="w-3 h-3 mr-1" />
          LIVE
        </Badge>
      )}
      {stream.streamType === "movie" && (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
          <Film className="w-3 h-3 mr-1" />
          VOD
        </Badge>
      )}
      {stream.isDirect && (
        <Badge variant="outline" className="text-xs">Direct</Badge>
      )}
      {stream.tvArchiveEnabled && (
        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
          <Clock className="w-3 h-3 mr-1" />
          Archive
        </Badge>
      )}
    </div>
  );
}

export default function Streams() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isXtreamImportOpen, setIsXtreamImportOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [playingStream, setPlayingStream] = useState<Stream | null>(null);
  const [selectedStreams, setSelectedStreams] = useState<Set<number>>(new Set());
  const [m3uContent, setM3uContent] = useState("");
  const [importCategory, setImportCategory] = useState<number | undefined>();
  const [importType, setImportType] = useState<"live" | "movie">("live");
  const [xtreamUrl, setXtreamUrl] = useState("");
  const [xtreamUsername, setXtreamUsername] = useState("");
  const [xtreamPassword, setXtreamPassword] = useState("");
  const [xtreamImportPending, setXtreamImportPending] = useState(false);
  const [editingStream, setEditingStream] = useState<Stream | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Stream>>({});
  const [isEditPending, setIsEditPending] = useState(false);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState<{
    categoryId?: number, 
    streamType?: string,
    serverId?: number,
    transcodeProfileId?: number,
    tvArchiveEnabled?: boolean,
    tvArchiveDuration?: number
  }>({});
  
  const { data: streams, isLoading } = useStreams(selectedCategory);
  const { data: categories } = useCategories();
  const { data: servers } = useServers();
  const { data: transcodeProfiles } = useTranscodeProfiles();
  const createStream = useCreateStream();
  const deleteStream = useDeleteStream();
  const importM3U = useImportM3U();
  const bulkDelete = useBulkDeleteStreams();
  const bulkUpdate = useBulkUpdateStreams();

  const handleCreate = async (data: InsertStream) => {
    try {
      await createStream.mutateAsync(data);
      toast({ title: "Success", description: "Stream created successfully" });
      setIsCreateOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create stream", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this stream?")) {
      await deleteStream.mutateAsync(id);
      toast({ title: "Deleted", description: "Stream removed" });
    }
  };

  const handlePlay = (stream: Stream) => {
    setPlayingStream(stream);
  };

  const handleEdit = (stream: Stream) => {
    setEditingStream(stream);
    setEditFormData({
      name: stream.name,
      sourceUrl: stream.sourceUrl,
      categoryId: stream.categoryId,
      streamType: stream.streamType,
      isDirect: stream.isDirect,
      onDemand: stream.onDemand,
      autoRestartHours: stream.autoRestartHours,
      delayMinutes: stream.delayMinutes,
      rtmpOutput: stream.rtmpOutput,
      readNative: stream.readNative,
      streamAll: stream.streamAll,
      removeSubtitles: stream.removeSubtitles,
      genTimestamps: stream.genTimestamps,
      allowRecord: stream.allowRecord,
    });
  };

  const handleEditSubmit = async (data: InsertStream) => {
    if (!editingStream) return;
    setIsEditPending(true);
    try {
      await apiRequest("PATCH", `/api/streams/${editingStream.id}`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
      toast({ title: "Success", description: "Stream updated successfully" });
      setEditingStream(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update stream", variant: "destructive" });
    } finally {
      setIsEditPending(false);
    }
  };

  const handleImportM3U = async () => {
    try {
      const result = await importM3U.mutateAsync({
        content: m3uContent,
        categoryId: importCategory,
        streamType: importType,
      });
      toast({ title: "Success", description: `Imported ${result.imported} streams` });
      setIsImportOpen(false);
      setM3uContent("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to import M3U", variant: "destructive" });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedStreams.size === 0) return;
    if (!confirm(`Delete ${selectedStreams.size} selected streams?`)) return;
    try {
      await bulkDelete.mutateAsync(Array.from(selectedStreams));
      toast({ title: "Deleted", description: `Removed ${selectedStreams.size} streams` });
      setSelectedStreams(new Set());
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleBulkEdit = async () => {
    if (selectedStreams.size === 0) return;
    try {
      await bulkUpdate.mutateAsync({
        ids: Array.from(selectedStreams),
        updates: bulkEditData
      });
      toast({ title: "Success", description: `Updated ${selectedStreams.size} streams` });
      setIsBulkEditOpen(false);
      setSelectedStreams(new Set());
      setBulkEditData({});
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update streams", variant: "destructive" });
    }
  };

  const handleStreamAction = async (streamId: number, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await apiRequest("POST", `/api/streams/${streamId}/${action}`, {});
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
        toast({ 
          title: "Success", 
          description: `Stream ${action}ed successfully` 
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || `Failed to ${action} stream`);
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error.message || `Failed to ${action} stream`,
        variant: "destructive" 
      });
    }
  };

  const handleXtreamImport = async () => {
    if (!xtreamUrl || !xtreamUsername || !xtreamPassword) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setXtreamImportPending(true);
    try {
      const response = await apiRequest("POST", "/api/streams/import-xtream", {
        url: xtreamUrl,
        username: xtreamUsername,
        password: xtreamPassword,
        categoryId: importCategory,
        streamType: importType,
      });
      const result = await response.json();
      toast({ title: "Success", description: `Imported ${result.imported} streams from Xtream panel` });
      setIsXtreamImportOpen(false);
      setXtreamUrl("");
      setXtreamUsername("");
      setXtreamPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/streams"] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to import from Xtream", variant: "destructive" });
    } finally {
      setXtreamImportPending(false);
    }
  };

  const toggleStreamSelection = (id: number) => {
    setSelectedStreams(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleExport = (format: 'csv' | 'excel') => {
    const url = `/api/streams/export/${format}`;
    window.open(url, '_blank');
    toast({ title: "Success", description: `Exporting streams to ${format.toUpperCase()}...` });
  };

  const toggleSelectAll = () => {
    if (!streams) return;
    if (selectedStreams.size === streams.length) {
      setSelectedStreams(new Set());
    } else {
      setSelectedStreams(new Set(streams.map(s => s.id)));
    }
  };

  return (
    <Layout 
      title="Manage Streams"
      actions={
        <div className="flex gap-2">
          {selectedStreams.size > 0 && (
            <>
              <Button 
                variant="outline" 
                className="gap-2" 
                onClick={() => setIsBulkEditOpen(true)}
                data-testid="button-bulk-edit"
              >
                <Edit2 className="w-4 h-4" /> Edit ({selectedStreams.size})
              </Button>
              <Button 
                variant="destructive" 
                className="gap-2" 
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="w-4 h-4" /> Delete ({selectedStreams.size})
              </Button>
            </>
          )}
          <Dialog open={isXtreamImportOpen} onOpenChange={setIsXtreamImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-import-xtream">
                <Globe className="w-4 h-4" /> Import Xtream
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" /> Import from Xtream Panel
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Import streams from another Xtream Codes compatible panel. Enter the panel URL and credentials.
                </p>
                <div className="space-y-2">
                  <Label>Panel URL</Label>
                  <Input
                    data-testid="input-xtream-url"
                    value={xtreamUrl}
                    onChange={(e) => setXtreamUrl(e.target.value)}
                    placeholder="http://panel.example.com:8080"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      data-testid="input-xtream-username"
                      value={xtreamUsername}
                      onChange={(e) => setXtreamUsername(e.target.value)}
                      placeholder="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      data-testid="input-xtream-password"
                      type="password"
                      value={xtreamPassword}
                      onChange={(e) => setXtreamPassword(e.target.value)}
                      placeholder="password"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Category</Label>
                    <Select onValueChange={(val) => setImportCategory(val === "none" ? undefined : parseInt(val))}>
                      <SelectTrigger data-testid="select-xtream-category">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Auto-create</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stream Type</Label>
                    <Select value={importType} onValueChange={(v) => setImportType(v as "live" | "movie")}>
                      <SelectTrigger data-testid="select-xtream-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="live">Live Streams</SelectItem>
                        <SelectItem value="movie">Movies (VOD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleXtreamImport} 
                  disabled={xtreamImportPending || !xtreamUrl.trim()} 
                  className="w-full btn-primary"
                  data-testid="button-submit-xtream-import"
                >
                  {xtreamImportPending ? "Importing..." : "Import from Xtream"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-import-m3u">
                <Upload className="w-4 h-4" /> Import M3U
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-card border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" /> Import M3U Playlist
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>M3U Content</Label>
                  <Textarea
                    data-testid="input-m3u-content"
                    value={m3uContent}
                    onChange={(e) => setM3uContent(e.target.value)}
                    placeholder="#EXTM3U&#10;#EXTINF:-1 tvg-id=&quot;channel1&quot; tvg-name=&quot;Channel 1&quot;,Channel 1&#10;http://example.com/stream1.m3u8"
                    className="min-h-[200px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your M3U content here or paste the URL from your M3U file
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Assign to Category</Label>
                    <Select value={importCategory?.toString()} onValueChange={(v) => setImportCategory(v ? parseInt(v) : undefined)}>
                      <SelectTrigger data-testid="select-import-category">
                        <SelectValue placeholder="Select Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stream Type</Label>
                    <Select value={importType} onValueChange={(v) => setImportType(v as "live" | "movie")}>
                      <SelectTrigger data-testid="select-import-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="live">Live Streams</SelectItem>
                        <SelectItem value="movie">Movies (VOD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleImportM3U} 
                  disabled={importM3U.isPending || !m3uContent.trim()} 
                  className="w-full btn-primary"
                  data-testid="button-submit-import"
                >
                  {importM3U.isPending ? "Importing..." : "Import Streams"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => handleExport('csv')}
            data-testid="button-export-csv-streams"
          >
            <FileText className="w-4 h-4" /> CSV
          </Button>
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={() => handleExport('excel')}
            data-testid="button-export-excel-streams"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary gap-2" data-testid="button-add-stream">
                <Plus className="w-4 h-4" /> Add Stream
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
              <DialogHeader>
                <DialogTitle>Add New Stream</DialogTitle>
              </DialogHeader>
              <StreamForm 
                onSubmit={handleCreate} 
                categories={categories || []} 
                servers={servers || []}
                transcodeProfiles={transcodeProfiles || []}
                isLoading={createStream.isPending} 
              />
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {playingStream && (
        <VideoPlayer stream={playingStream} onClose={() => setPlayingStream(null)} />
      )}

      <Dialog open={!!editingStream} onOpenChange={(open) => !open && setEditingStream(null)}>
        <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" /> Edit Stream
            </DialogTitle>
          </DialogHeader>
          {editingStream && (
            <StreamForm 
              onSubmit={handleEditSubmit} 
              categories={categories || []} 
              servers={servers || []}
              transcodeProfiles={transcodeProfiles || []}
              isLoading={isEditPending}
              initialData={editingStream}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5" /> Bulk Edit Streams
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Editing {selectedStreams.size} selected stream{selectedStreams.size > 1 ? 's' : ''}. Only fill the fields you want to update.
            </p>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={bulkEditData.categoryId?.toString() || ""}
                onValueChange={(val) => setBulkEditData({ ...bulkEditData, categoryId: val ? parseInt(val) : undefined })}
              >
                <SelectTrigger data-testid="select-bulk-category">
                  <SelectValue placeholder="Keep current categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep current categories</SelectItem>
                  {categories?.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id.toString()}>{cat.categoryName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Stream Type</Label>
              <Select
                value={bulkEditData.streamType || ""}
                onValueChange={(val) => setBulkEditData({ ...bulkEditData, streamType: val || undefined })}
              >
                <SelectTrigger data-testid="select-bulk-type">
                  <SelectValue placeholder="Keep current types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep current types</SelectItem>
                  <SelectItem value="live">Live Stream</SelectItem>
                  <SelectItem value="movie">Movie</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ServerIcon className="h-4 w-4" />
                Server
              </Label>
              <Select
                value={bulkEditData.serverId?.toString() || ""}
                onValueChange={(val) => setBulkEditData({ ...bulkEditData, serverId: val ? parseInt(val) : undefined })}
              >
                <SelectTrigger data-testid="select-bulk-server">
                  <SelectValue placeholder="Keep current servers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep current servers</SelectItem>
                  {servers?.map((server) => (
                    <SelectItem key={server.id} value={server.id.toString()}>
                      {server.serverName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Transcode Profile
              </Label>
              <Select
                value={bulkEditData.transcodeProfileId?.toString() || ""}
                onValueChange={(val) => setBulkEditData({ ...bulkEditData, transcodeProfileId: val ? parseInt(val) : undefined })}
              >
                <SelectTrigger data-testid="select-bulk-transcode">
                  <SelectValue placeholder="Keep current profiles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep current profiles</SelectItem>
                  {transcodeProfiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id.toString()}>
                      {profile.profileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>TV Archive (Catchup)</Label>
              <Select
                value={bulkEditData.tvArchiveEnabled?.toString() || ""}
                onValueChange={(val) => {
                  if (val === "") {
                    setBulkEditData({ ...bulkEditData, tvArchiveEnabled: undefined });
                  } else {
                    setBulkEditData({ ...bulkEditData, tvArchiveEnabled: val === "true" });
                  }
                }}
              >
                <SelectTrigger data-testid="select-bulk-archive">
                  <SelectValue placeholder="Keep current settings" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep current settings</SelectItem>
                  <SelectItem value="true">Enable Archive</SelectItem>
                  <SelectItem value="false">Disable Archive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkEditData.tvArchiveEnabled === true && (
              <div className="space-y-2">
                <Label>Archive Duration (days)</Label>
                <Input
                  type="number"
                  value={bulkEditData.tvArchiveDuration || ""}
                  onChange={(e) => setBulkEditData({ 
                    ...bulkEditData, 
                    tvArchiveDuration: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="7"
                  data-testid="input-bulk-archive-duration"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleBulkEdit}
              className="w-full btn-primary"
              data-testid="button-submit-bulk-edit"
            >
              Update {selectedStreams.size} Stream{selectedStreams.size > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-white/5 flex gap-4 items-center">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Filter className="w-4 h-4" />
            <span>Filter by Category:</span>
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px] bg-background/50 border-white/10" data-testid="select-filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.categoryName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading streams...</div>
        ) : streams?.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white">No streams found</h3>
            <p className="text-muted-foreground text-sm">Add your first stream to get started.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    data-testid="checkbox-select-all"
                    checked={streams && streams.length > 0 && selectedStreams.size === streams.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Stream Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Stream Info</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {streams?.map((stream) => (
                <tr key={stream.id} className={`hover:bg-white/5 transition-colors group ${selectedStreams.has(stream.id) ? "bg-primary/5" : ""}`} data-testid={`row-stream-${stream.id}`}>
                  <td className="px-4 py-3">
                    <Checkbox
                      data-testid={`checkbox-stream-${stream.id}`}
                      checked={selectedStreams.has(stream.id)}
                      onCheckedChange={() => toggleStreamSelection(stream.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary"
                          onClick={() => handlePlay(stream)}
                          data-testid={`button-play-stream-${stream.id}`}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Play Stream</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="px-4 py-3">
                    <StreamInfoBadges stream={stream} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {stream.streamIcon ? (
                        <img src={stream.streamIcon} alt="" className="w-8 h-8 rounded object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-background flex items-center justify-center">
                          {stream.streamType === "live" ? (
                            <Tv className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <Film className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-white">{stream.name}</span>
                        {stream.epgChannelId && (
                          <p className="text-xs text-muted-foreground">EPG: {stream.epgChannelId}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {categories?.find(c => c.id === stream.categoryId)?.categoryName || "Uncategorized"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Source:</span>
                        <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded text-blue-400 truncate max-w-[180px]">
                          {stream.sourceUrl.includes("://") 
                            ? new URL(stream.sourceUrl).hostname 
                            : stream.sourceUrl.substring(0, 30)}
                        </code>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {stream.streamType === "live" && (
                          <>
                            <span className="flex items-center gap-1">
                              <Gauge className="w-3 h-3" />
                              Auto
                            </span>
                            <span className="flex items-center gap-1">
                              <Info className="w-3 h-3" />
                              HLS/MPEG-TS
                            </span>
                          </>
                        )}
                        {stream.tvArchiveDuration && stream.tvArchiveDuration > 0 && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {stream.tvArchiveDuration}d catchup
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-emerald-500/20 hover:text-emerald-500 text-muted-foreground"
                            onClick={() => handleStreamAction(stream.id, 'start')}
                            data-testid={`button-start-stream-${stream.id}`}
                          >
                            <PlayCircle className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Start Stream</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-red-500/20 hover:text-red-500 text-muted-foreground"
                            onClick={() => handleStreamAction(stream.id, 'stop')}
                            data-testid={`button-stop-stream-${stream.id}`}
                          >
                            <StopCircle className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Stop Stream</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-blue-500/20 hover:text-blue-500 text-muted-foreground"
                            onClick={() => handleStreamAction(stream.id, 'restart')}
                            data-testid={`button-restart-stream-${stream.id}`}
                          >
                            <RotateCw className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Restart Stream</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-white/10 hover:text-white"
                            onClick={() => handleEdit(stream)}
                            data-testid={`button-edit-stream-${stream.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit Stream</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive text-muted-foreground"
                            onClick={() => handleDelete(stream.id)}
                            data-testid={`button-delete-stream-${stream.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete Stream</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
