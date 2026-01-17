import { useState, useRef, useEffect } from "react";
import Hls from "hls.js";
import { Layout } from "@/components/Layout";
import { useStreams, useCreateStream, useDeleteStream } from "@/hooks/use-streams";
import { useCategories } from "@/hooks/use-categories";
import { Plus, Trash2, Edit2, Play, AlertCircle, Filter, X, Maximize2, Minimize2, Volume1, Volume2, VolumeX, Info, Tv, Radio, Film, Gauge, Clock, Wifi } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertStreamSchema, type InsertStream, type Stream } from "@shared/schema";

function StreamForm({ onSubmit, categories, isLoading }: { onSubmit: (data: InsertStream) => void, categories: any[], isLoading: boolean }) {
  const form = useForm<InsertStream>({
    resolver: zodResolver(insertStreamSchema),
    defaultValues: {
      streamType: "live",
      isDirect: false,
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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
          <Select onValueChange={(val) => form.setValue("categoryId", parseInt(val))}>
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
          <Select defaultValue="live" onValueChange={(val) => form.setValue("streamType", val)}>
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

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-submit-stream">
          {isLoading ? "Creating..." : "Add Stream"}
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

    const sourceUrl = stream.sourceUrl;
    const isHls = sourceUrl.includes(".m3u8") || sourceUrl.includes("m3u8");

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      });
      hls.loadSource(sourceUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        video.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        setVideoInfo(prev => ({
          ...prev,
          bitrate: data.details.averagetargetduration ? `${Math.round(data.details.averagetargetduration)}s` : "—",
        }));
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setIsLoading(false);
          setError(data.type === Hls.ErrorTypes.NETWORK_ERROR 
            ? "Network error - Stream may be unavailable or blocked by CORS"
            : `Playback error: ${data.details}`);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = sourceUrl;
      video.addEventListener("canplay", () => setIsLoading(false));
      video.addEventListener("error", () => setError("Failed to load stream"));
      video.play().catch(() => {});
    } else {
      video.src = sourceUrl;
      video.addEventListener("canplay", () => setIsLoading(false));
      video.addEventListener("error", () => setError("Failed to load stream"));
      video.play().catch(() => {});
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
  }, [stream.sourceUrl]);

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
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [playingStream, setPlayingStream] = useState<Stream | null>(null);
  
  const { data: streams, isLoading } = useStreams(selectedCategory);
  const { data: categories } = useCategories();
  const createStream = useCreateStream();
  const deleteStream = useDeleteStream();

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

  return (
    <Layout 
      title="Manage Streams"
      actions={
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
            <StreamForm onSubmit={handleCreate} categories={categories || []} isLoading={createStream.isPending} />
          </DialogContent>
        </Dialog>
      }
    >
      {playingStream && (
        <VideoPlayer stream={playingStream} onClose={() => setPlayingStream(null)} />
      )}

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
                <tr key={stream.id} className="hover:bg-white/5 transition-colors group" data-testid={`row-stream-${stream.id}`}>
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
                            className="h-8 w-8 hover:bg-white/10 hover:text-white"
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
