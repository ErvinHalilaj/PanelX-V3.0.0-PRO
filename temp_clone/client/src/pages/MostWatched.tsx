import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Tv, Film, Clapperboard, Eye, Users, Clock, Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MostWatched as MostWatchedType, Stream } from "@shared/schema";

export default function MostWatched() {
  const [contentType, setContentType] = useState<string>("all");

  const { data: mostWatched = [], isLoading, isError } = useQuery<MostWatchedType[]>({
    queryKey: ["/api/most-watched"],
  });

  const { data: streams = [] } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  const getStreamName = (streamId: number) => {
    const stream = streams.find((s) => s.id === streamId);
    return stream?.name || `Stream #${streamId}`;
  };

  const getStreamIcon = (type: string | null) => {
    switch (type) {
      case "live":
        return Tv;
      case "movie":
        return Film;
      case "series":
        return Clapperboard;
      default:
        return Eye;
    }
  };

  const formatWatchTime = (seconds: number | null) => {
    if (!seconds) return "0h";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const filteredData =
    contentType === "all" ? mostWatched : mostWatched.filter((m) => m.streamType === contentType);

  const sortedData = [...filteredData].sort((a, b) => (b.totalViews || 0) - (a.totalViews || 0));

  const totalViews = mostWatched.reduce((sum, m) => sum + (m.totalViews || 0), 0);
  const totalUniqueViewers = mostWatched.reduce((sum, m) => sum + (m.uniqueViewers || 0), 0);
  const totalWatchTime = mostWatched.reduce((sum, m) => sum + (m.totalDuration || 0), 0);

  if (isError) {
    return (
      <Layout title="Most Watched" subtitle="Analytics for most popular content">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load most watched data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Most Watched" subtitle="Analytics for most popular content">
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Total Views</div>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalUniqueViewers.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">Unique Viewers</div>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatWatchTime(totalWatchTime)}</div>
              <div className="text-sm text-muted-foreground">Total Watch Time</div>
            </div>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-secondary/30 border border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{mostWatched.length}</div>
              <div className="text-sm text-muted-foreground">Tracked Streams</div>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={contentType} onValueChange={setContentType} className="mb-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All Content
          </TabsTrigger>
          <TabsTrigger value="live" data-testid="tab-live">
            <Tv className="w-4 h-4 mr-2" /> Live
          </TabsTrigger>
          <TabsTrigger value="movie" data-testid="tab-movie">
            <Film className="w-4 h-4 mr-2" /> Movies
          </TabsTrigger>
          <TabsTrigger value="series" data-testid="tab-series">
            <Clapperboard className="w-4 h-4 mr-2" /> Series
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-3">
          {sortedData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No viewing data available yet.
            </div>
          ) : (
            sortedData.slice(0, 50).map((item, index) => {
              const Icon = getStreamIcon(item.streamType);
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-white/5"
                  data-testid={`most-watched-${item.id}`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-bold text-sm">
                    {index + 1}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{getStreamName(item.streamId)}</div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {(item.totalViews || 0).toLocaleString()} views
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {(item.uniqueViewers || 0).toLocaleString()} unique
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatWatchTime(item.totalDuration)}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant={
                      item.streamType === "live"
                        ? "default"
                        : item.streamType === "movie"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {item.streamType || "unknown"}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      )}
    </Layout>
  );
}
