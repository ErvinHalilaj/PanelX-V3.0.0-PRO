import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tv, Search, Clock, Calendar, Radio } from "lucide-react";
import { format } from "date-fns";
import type { EpgData } from "@shared/schema";

export default function EpgDataViewer() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: epgData = [], isLoading } = useQuery<EpgData[]>({
    queryKey: ["/api/epg-data/all"],
  });

  const filteredData = epgData.filter(item => 
    item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.channelId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const uniqueChannels = Array.from(new Set(epgData.map(e => e.channelId)));
  const now = new Date();
  const currentPrograms = epgData.filter(e => 
    new Date(e.startTime) <= now && new Date(e.endTime) >= now
  );
  const upcomingPrograms = epgData.filter(e => new Date(e.startTime) > now);

  const isCurrentlyAiring = (startTime: Date | string, endTime: Date | string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return start <= now && end >= now;
  };

  return (
    <Layout 
      title="EPG Data Viewer"
      actions={
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search programs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-[300px]"
            data-testid="input-search-epg"
          />
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <Tv className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Programs</p>
              <p className="text-lg font-bold">{epgData.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
              <Radio className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Channels</p>
              <p className="text-lg font-bold">{uniqueChannels.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
              <Clock className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Now Playing</p>
              <p className="text-lg font-bold">{currentPrograms.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10">
              <Calendar className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Upcoming</p>
              <p className="text-lg font-bold">{upcomingPrograms.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tv className="w-5 h-5" />
            Program Guide
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading EPG data...</div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {epgData.length === 0 ? "No EPG data available. Add EPG sources to populate." : "No matching programs found"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow 
                    key={item.id} 
                    data-testid={`row-epg-${item.id}`}
                    className={isCurrentlyAiring(item.startTime, item.endTime) ? "bg-green-500/10" : ""}
                  >
                    <TableCell className="font-mono text-sm">{item.channelId}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.title}
                        {isCurrentlyAiring(item.startTime, item.endTime) && (
                          <Badge className="bg-red-600 text-white text-xs">LIVE</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.startTime), "MMM dd, HH:mm")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(item.endTime), "HH:mm")}
                    </TableCell>
                    <TableCell>
                      {item.category ? <Badge variant="outline">{item.category}</Badge> : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.lang || "-"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground" title={item.description || ""}>
                      {item.description || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
