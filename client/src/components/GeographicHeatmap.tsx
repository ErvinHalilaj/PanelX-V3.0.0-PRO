import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, MapPin, Users, TrendingUp } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { useState, useMemo } from "react";

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Connection {
  id: number;
  username: string;
  streamName: string;
  ip: string;
  country?: string;
  city?: string;
  isp?: string;
  duration: number;
}

interface GeographicHeatmapProps {
  connections: Connection[];
  connected: boolean;
}

// Country coordinates for markers (approximate center points)
const countryCoordinates: Record<string, [number, number]> = {
  "United States": [-95.7129, 37.0902],
  "United Kingdom": [-3.4360, 55.3781],
  "Germany": [10.4515, 51.1657],
  "France": [2.2137, 46.2276],
  "Canada": [-106.3468, 56.1304],
  "Australia": [133.7751, -25.2744],
  "Japan": [138.2529, 36.2048],
  "China": [104.1954, 35.8617],
  "India": [78.9629, 20.5937],
  "Brazil": [-51.9253, -14.2350],
  "Russia": [105.3188, 61.5240],
  "Italy": [12.5674, 41.8719],
  "Spain": [-3.7492, 40.4637],
  "Mexico": [-102.5528, 23.6345],
  "South Korea": [127.7669, 35.9078],
  "Netherlands": [5.2913, 52.1326],
  "Sweden": [18.6435, 60.1282],
  "Norway": [8.4689, 60.4720],
  "Poland": [19.1451, 51.9194],
  "Turkey": [35.2433, 38.9637],
};

export function GeographicHeatmap({ connections, connected }: GeographicHeatmapProps) {
  const [tooltipContent, setTooltipContent] = useState("");

  // Group connections by country
  const connectionsByCountry = useMemo(() => {
    const grouped: Record<string, number> = {};
    connections.forEach(conn => {
      if (conn.country) {
        grouped[conn.country] = (grouped[conn.country] || 0) + 1;
      }
    });
    return grouped;
  }, [connections]);

  // Get top countries
  const topCountries = useMemo(() => {
    return Object.entries(connectionsByCountry)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [connectionsByCountry]);

  // Calculate color intensity based on connection count
  const getCountryColor = (countryName: string) => {
    const count = connectionsByCountry[countryName] || 0;
    if (count === 0) return "rgba(255, 255, 255, 0.05)";
    
    const maxCount = Math.max(...Object.values(connectionsByCountry));
    const intensity = count / maxCount;
    
    // Blue gradient based on intensity
    return `rgba(59, 130, 246, ${0.2 + intensity * 0.6})`;
  };

  // Get total unique countries
  const uniqueCountries = Object.keys(connectionsByCountry).length;
  
  // Calculate most active country
  const mostActiveCountry = topCountries.length > 0 
    ? topCountries[0] 
    : { country: "None", count: 0 };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Countries</p>
                <p className="text-xl font-bold text-white">
                  {uniqueCountries}
                  {connected && <span className="text-xs ml-2 text-green-500 font-normal">LIVE</span>}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Connections</p>
                <p className="text-xl font-bold text-white">{connections.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Top Country</p>
                <p className="text-lg font-bold text-white truncate">
                  {mostActiveCountry.country} ({mostActiveCountry.count})
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* World Map */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Geographic Distribution
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-yellow-500'}`} />
              {connections.length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
              <Globe className="w-12 h-12 mb-2 opacity-20" />
              <p>No active connections to display</p>
            </div>
          ) : (
            <div className="h-[400px] relative">
              <ComposableMap
                projectionConfig={{
                  scale: 147,
                  rotation: [-11, 0, 0]
                }}
                style={{ width: "100%", height: "100%" }}
              >
                <ZoomableGroup center={[0, 20]}>
                  <Geographies geography={geoUrl}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const countryName = geo.properties.name;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={getCountryColor(countryName)}
                            stroke="rgba(255, 255, 255, 0.1)"
                            strokeWidth={0.5}
                            style={{
                              default: { outline: "none" },
                              hover: { 
                                fill: "rgba(59, 130, 246, 0.8)",
                                outline: "none"
                              },
                              pressed: { outline: "none" }
                            }}
                            onMouseEnter={() => {
                              const count = connectionsByCountry[countryName];
                              if (count) {
                                setTooltipContent(`${countryName}: ${count} connection${count > 1 ? 's' : ''}`);
                              }
                            }}
                            onMouseLeave={() => {
                              setTooltipContent("");
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                  
                  {/* Connection Markers */}
                  {Object.entries(connectionsByCountry).map(([country, count]) => {
                    const coordinates = countryCoordinates[country];
                    if (!coordinates) return null;
                    
                    return (
                      <Marker key={country} coordinates={coordinates}>
                        <circle
                          r={Math.min(4 + count * 2, 12)}
                          fill="#10b981"
                          fillOpacity={0.8}
                          stroke="#fff"
                          strokeWidth={1}
                        />
                      </Marker>
                    );
                  })}
                </ZoomableGroup>
              </ComposableMap>
              
              {tooltipContent && (
                <div className="absolute top-4 left-4 bg-black/80 text-white px-3 py-2 rounded-lg text-sm">
                  {tooltipContent}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Countries List */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            Top Countries by Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topCountries.length === 0 ? (
            <div className="text-center text-muted-foreground py-4">
              No data available
            </div>
          ) : (
            <div className="space-y-2">
              {topCountries.map((item, index) => {
                const percentage = (item.count / connections.length) * 100;
                return (
                  <div key={item.country} className="flex items-center gap-3">
                    <div className="w-6 text-center text-muted-foreground text-xs font-medium">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{item.country}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.count} connection{item.count > 1 ? 's' : ''} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
