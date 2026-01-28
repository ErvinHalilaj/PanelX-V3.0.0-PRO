import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Calendar, Tv, Link2, RefreshCw, Plus, Trash2, Loader2, Check, X, Search, Download, Upload, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

interface EpgSource {
  id: number;
  name: string;
  url: string;
  enabled: boolean;
  lastUpdate: string | null;
  channelCount: number;
}

interface EpgMapping {
  id: number;
  streamId: number;
  epgChannelId: string;
  matchType: string;
  matchConfidence: number;
  createdAt: string;
  updatedAt: string | null;
}

interface EpgStats {
  totalSources: number;
  enabledSources: number;
  totalMappings: number;
  totalStreams: number;
  mappedStreams: number;
  unmappedStreams: number;
  totalPrograms: number;
}

interface EpgProgram {
  id: number;
  channelId: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  category: string;
}

interface Stream {
  id: number;
  name: string;
}

export default function EpgManager() {
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [newMapping, setNewMapping] = useState({
    streamId: 0,
    epgChannelId: "",
    matchType: "manual",
    matchConfidence: 100,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<EpgStats>({
    queryKey: ["/api/epg/stats"],
  });

  const { data: sources = [], isLoading: sourcesLoading } = useQuery<EpgSource[]>({
    queryKey: ["/api/epg-sources"],
  });

  const { data: mappings = [] } = useQuery<EpgMapping[]>({
    queryKey: ["/api/epg/mappings"],
  });

  const { data: streams = [] } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  const { data: previewPrograms = [], isLoading: previewLoading } = useQuery<EpgProgram[]>({
    queryKey: ["/api/epg/preview", selectedChannelId],
    enabled: !!selectedChannelId && previewDialogOpen,
  });

  const autoMapMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/epg/auto-map"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg/mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/epg/stats"] });
      toast({ title: `Auto-mapped ${data.mapped} streams` });
    },
    onError: () => toast({ title: "Auto-map failed", variant: "destructive" }),
  });

  const importEpgMutation = useMutation({
    mutationFn: (sourceId: number) => apiRequest("POST", `/api/epg/import/${sourceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg-sources"] });
      toast({ title: "EPG import initiated" });
    },
    onError: () => toast({ title: "Import failed", variant: "destructive" }),
  });

  const createMappingMutation = useMutation({
    mutationFn: (data: typeof newMapping) => apiRequest("POST", "/api/epg/mappings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg/mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/epg/stats"] });
      setMappingDialogOpen(false);
      setNewMapping({ streamId: 0, epgChannelId: "", matchType: "manual", matchConfidence: 100 });
      toast({ title: "Mapping created" });
    },
    onError: () => toast({ title: "Failed to create mapping", variant: "destructive" }),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/epg/mappings/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/epg/mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/epg/stats"] });
      toast({ title: "Mapping deleted" });
    },
    onError: () => toast({ title: "Failed to delete mapping", variant: "destructive" }),
  });

  if (statsLoading || sourcesLoading) {
    return (
      <Layout title="EPG Manager" subtitle="Manage Electronic Program Guide">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="EPG Manager" subtitle="Manage Electronic Program Guide">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">EPG Manager</h1>
            <p className="text-muted-foreground">Manage Electronic Program Guide sources and channel mappings</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => autoMapMutation.mutate()}
              disabled={autoMapMutation.isPending}
              data-testid="button-auto-map"
            >
              {autoMapMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
              Auto-Map Channels
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card data-testid="card-sources">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">EPG Sources</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-source-count">{stats?.totalSources || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.enabledSources || 0} enabled
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-programs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Programs</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-program-count">{stats?.totalPrograms || 0}</div>
              <p className="text-xs text-muted-foreground">
                In database
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-mapped">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Mapped Streams</CardTitle>
              <Check className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-mapped-count">{stats?.mappedStreams || 0}</div>
              <p className="text-xs text-muted-foreground">
                of {stats?.totalStreams || 0} total streams
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-unmapped">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Unmapped Streams</CardTitle>
              <X className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-unmapped-count">{stats?.unmappedStreams || 0}</div>
              <p className="text-xs text-muted-foreground">
                Need mapping
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sources" className="space-y-4">
          <TabsList data-testid="tabs-list">
            <TabsTrigger value="sources" data-testid="tab-sources">EPG Sources</TabsTrigger>
            <TabsTrigger value="mappings" data-testid="tab-mappings">Channel Mappings</TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>EPG Sources</CardTitle>
                <CardDescription>XMLTV sources for program guide data</CardDescription>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No EPG sources configured. Add sources in the EPG Sources section.</p>
                ) : (
                  <div className="space-y-4">
                    {sources.map((source) => (
                      <div key={source.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`source-${source.id}`}>
                        <div className="flex items-center gap-4">
                          <Badge variant={source.enabled ? "default" : "secondary"}>
                            {source.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-sm text-muted-foreground truncate max-w-md">{source.url}</p>
                            <p className="text-xs text-muted-foreground">
                              Last updated: {source.lastUpdate ? new Date(source.lastUpdate).toLocaleString() : "Never"}
                              {source.channelCount > 0 && ` | ${source.channelCount} channels`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedChannelId(source.name);
                              setPreviewDialogOpen(true);
                            }}
                            data-testid={`button-preview-${source.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" /> Preview
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => importEpgMutation.mutate(source.id)}
                            disabled={importEpgMutation.isPending}
                            data-testid={`button-import-${source.id}`}
                          >
                            <RefreshCw className={`w-4 h-4 mr-1 ${importEpgMutation.isPending ? "animate-spin" : ""}`} />
                            Import
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <div>
                  <CardTitle>Channel Mappings</CardTitle>
                  <CardDescription>Map streams to EPG channel IDs</CardDescription>
                </div>
                <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-mapping">
                      <Plus className="w-4 h-4 mr-2" /> Add Mapping
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Channel Mapping</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Stream</Label>
                        <Select
                          value={newMapping.streamId.toString()}
                          onValueChange={(v) => setNewMapping({ ...newMapping, streamId: Number(v) })}
                        >
                          <SelectTrigger data-testid="select-stream">
                            <SelectValue placeholder="Select stream" />
                          </SelectTrigger>
                          <SelectContent>
                            {streams.map((stream) => (
                              <SelectItem key={stream.id} value={stream.id.toString()}>
                                {stream.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>EPG Channel ID</Label>
                        <Input
                          value={newMapping.epgChannelId}
                          onChange={(e) => setNewMapping({ ...newMapping, epgChannelId: e.target.value })}
                          placeholder="e.g., bbc.one.uk"
                          data-testid="input-channel-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Match Type</Label>
                        <Select value={newMapping.matchType} onValueChange={(v) => setNewMapping({ ...newMapping, matchType: v })}>
                          <SelectTrigger data-testid="select-match-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="auto">Auto</SelectItem>
                            <SelectItem value="regex">Regex</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setMappingDialogOpen(false)} data-testid="button-cancel">
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createMappingMutation.mutate(newMapping)}
                        disabled={!newMapping.streamId || !newMapping.epgChannelId || createMappingMutation.isPending}
                        data-testid="button-save-mapping"
                      >
                        {createMappingMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Create Mapping
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {mappings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No channel mappings configured. Use Auto-Map or add mappings manually.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Stream ID</th>
                          <th className="text-left p-2">EPG Channel</th>
                          <th className="text-left p-2">Match Type</th>
                          <th className="text-left p-2">Confidence</th>
                          <th className="text-left p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappings.map((mapping) => (
                          <tr key={mapping.id} className="border-b" data-testid={`row-mapping-${mapping.id}`}>
                            <td className="p-2">{mapping.streamId}</td>
                            <td className="p-2">{mapping.epgChannelId}</td>
                            <td className="p-2">
                              <Badge variant={mapping.matchType === "manual" ? "default" : "secondary"}>
                                {mapping.matchType}
                              </Badge>
                            </td>
                            <td className="p-2">{mapping.matchConfidence}%</td>
                            <td className="p-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => deleteMappingMutation.mutate(mapping.id)}
                                disabled={deleteMappingMutation.isPending}
                                data-testid={`button-delete-${mapping.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>EPG Preview: {selectedChannelId}</DialogTitle>
            </DialogHeader>
            <div className="max-h-96 overflow-y-auto">
              {previewLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : previewPrograms.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No programs found for today</p>
              ) : (
                <div className="space-y-2">
                  {previewPrograms.map((program) => (
                    <div key={program.id} className="p-3 border rounded-lg" data-testid={`program-${program.id}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {new Date(program.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - 
                          {new Date(program.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {program.category && <Badge variant="outline">{program.category}</Badge>}
                      </div>
                      <p className="font-medium">{program.title}</p>
                      {program.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{program.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
