import { Layout } from "@/components/Layout";
import { Copy, Check, Server, Link2, Download, Tv } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied!", description: "URL copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8" data-testid="button-copy">
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

export default function ApiInfo() {
  const baseUrl = window.location.origin;

  const endpoints = [
    {
      title: "Player API (Authentication)",
      description: "Xtream Codes compatible API for IPTV apps",
      url: `${baseUrl}/player_api.php?username=USERNAME&password=PASSWORD`,
      icon: Server,
    },
    {
      title: "Get Live Categories",
      description: "Fetch all live TV categories",
      url: `${baseUrl}/player_api.php?username=USERNAME&password=PASSWORD&action=get_live_categories`,
      icon: Tv,
    },
    {
      title: "Get Live Streams",
      description: "Fetch all live channels",
      url: `${baseUrl}/player_api.php?username=USERNAME&password=PASSWORD&action=get_live_streams`,
      icon: Tv,
    },
    {
      title: "M3U Playlist",
      description: "Download M3U playlist for VLC, IPTV Smarters, etc.",
      url: `${baseUrl}/get.php?username=USERNAME&password=PASSWORD&type=m3u_plus&output=ts`,
      icon: Download,
    },
    {
      title: "Stream URL Format",
      description: "Direct stream access URL",
      url: `${baseUrl}/live/USERNAME/PASSWORD/STREAM_ID.ts`,
      icon: Link2,
    },
  ];

  return (
    <Layout title="API Information">
      <div className="space-y-6">
        <Card className="bg-card/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Xtream Codes API Compatibility
            </CardTitle>
            <CardDescription>
              This panel is compatible with Xtream Codes API. Use the following endpoints to connect IPTV applications like IPTV Smarters, Tivimate, GSE IPTV, etc.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-background/50 p-4 rounded-lg border border-white/5 space-y-2">
              <p className="text-sm text-muted-foreground">Server URL:</p>
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-md">
                <code className="text-emerald-400 text-sm" data-testid="text-server-url">{baseUrl}</code>
                <CopyButton text={baseUrl} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {endpoints.map((endpoint, idx) => (
            <Card key={idx} className="bg-card/50 border-white/10" data-testid={`card-endpoint-${idx}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <endpoint.icon className="w-4 h-4 text-primary" />
                  {endpoint.title}
                </CardTitle>
                <CardDescription className="text-sm">{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between bg-white/5 p-3 rounded-md overflow-hidden">
                  <code className="text-xs text-muted-foreground truncate flex-1" title={endpoint.url}>
                    {endpoint.url}
                  </code>
                  <CopyButton text={endpoint.url} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-card/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Quick Setup Guide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="space-y-2">
              <h4 className="font-medium text-white">For IPTV Smarters / Tivimate:</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Select "Xtream Codes API" as the connection type</li>
                <li>Enter the Server URL: <code className="text-emerald-400">{baseUrl}</code></li>
                <li>Enter Username and Password from your Line</li>
                <li>Port: <code className="text-emerald-400">5000</code></li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-white">For VLC / Other M3U Players:</h4>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li>Download the M3U playlist from the URL above</li>
                <li>Open VLC and go to Media {">"} Open Network Stream</li>
                <li>Paste the M3U URL and click Play</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
