import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { User, Tv, Calendar, Wifi, Copy, ExternalLink, Download, Clock, Shield } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import type { Line } from "@shared/schema";

export default function ClientPortal() {
  const { toast } = useToast();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [lineData, setLineData] = useState<Line | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/player_api.php?username=${loginData.username}&password=${loginData.password}`);
      const data = await res.json();
      
      if (data.user_info) {
        setLineData({
          id: 0,
          username: data.user_info.username,
          password: loginData.password,
          expDate: data.user_info.exp_date ? new Date(parseInt(data.user_info.exp_date) * 1000) : null,
          maxConnections: parseInt(data.user_info.max_connections) || 1,
          enabled: data.user_info.status === "Active",
          isTrial: data.user_info.is_trial === "1",
          createdAt: data.user_info.created_at ? new Date(parseInt(data.user_info.created_at) * 1000) : null,
          memberId: null,
          adminNotes: null,
          resellerNotes: null,
          bouquets: [],
          allowedOutputs: data.user_info.allowed_output_formats || [],
          lastActivity: null,
          forcedCountry: null,
          allowedIps: [],
          lockedDeviceId: null,
          lockedMac: null,
          allowedCountries: [],
        } as Line);
        setIsLoggedIn(true);
      } else {
        toast({ title: "Login Failed", description: "Invalid username or password", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not connect to server", variant: "destructive" });
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const getPlaylistUrl = (type: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/get.php?username=${loginData.username}&password=${loginData.password}&type=${type}&output=ts`;
  };

  const daysRemaining = lineData?.expDate ? differenceInDays(new Date(lineData.expDate), new Date()) : null;

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-card/80 backdrop-blur-xl border-border/50">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Client Portal</CardTitle>
            <CardDescription>Sign in to view your subscription</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input 
                  value={loginData.username}
                  onChange={(e) => setLoginData({...loginData, username: e.target.value})}
                  placeholder="Your username"
                  required
                  data-testid="input-portal-username"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input 
                  type="password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                  placeholder="Your password"
                  required
                  data-testid="input-portal-password"
                />
              </div>
              <Button type="submit" className="w-full" data-testid="button-portal-login">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Welcome, {lineData?.username}</h1>
            <p className="text-muted-foreground">Manage your subscription and settings</p>
          </div>
          <Button variant="outline" onClick={() => { setIsLoggedIn(false); setLineData(null); }} data-testid="button-logout">
            Sign Out
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={lineData?.enabled ? "default" : "destructive"}>
                    {lineData?.enabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Connections</p>
                  <p className="text-xl font-bold text-white">{lineData?.maxConnections}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <p className="text-sm font-medium text-white">
                    {lineData?.expDate ? format(new Date(lineData.expDate), 'MMM d, yyyy') : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${daysRemaining && daysRemaining < 7 ? 'bg-red-500/10' : 'bg-purple-500/10'}`}>
                  <Clock className={`w-5 h-5 ${daysRemaining && daysRemaining < 7 ? 'text-red-500' : 'text-purple-500'}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days Left</p>
                  <p className="text-xl font-bold text-white">{daysRemaining ?? '∞'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="playlists" className="space-y-4">
          <TabsList className="bg-card/50">
            <TabsTrigger value="playlists" className="gap-2"><Tv className="w-4 h-4" /> Playlists</TabsTrigger>
            <TabsTrigger value="account" className="gap-2"><User className="w-4 h-4" /> Account</TabsTrigger>
          </TabsList>

          <TabsContent value="playlists">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Your Playlist Links</CardTitle>
                <CardDescription>Use these links in your IPTV player application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-background/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">M3U Plus Playlist</p>
                      <p className="text-sm text-muted-foreground">For most IPTV players (Smarters, TiviMate)</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(getPlaylistUrl('m3u_plus'), 'M3U Plus URL')} data-testid="button-copy-m3u">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <a href={getPlaylistUrl('m3u_plus')} target="_blank" rel="noopener noreferrer" data-testid="link-m3u">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </div>
                  <code className="block text-xs bg-background p-2 rounded overflow-x-auto text-muted-foreground">
                    {getPlaylistUrl('m3u_plus')}
                  </code>
                </div>

                <div className="p-4 bg-background/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">Xtream Codes API</p>
                      <p className="text-sm text-muted-foreground">For apps with Xtream API support</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${window.location.origin}`, 'Server URL')} data-testid="button-copy-server">
                      <Copy className="w-4 h-4 mr-2" /> Copy Server
                    </Button>
                  </div>
                  <div className="grid gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">Server URL:</span>
                      <span className="font-mono text-white">{window.location.origin}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">Username:</span>
                      <span className="font-mono text-white">{loginData.username}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded">
                      <span className="text-muted-foreground">Password:</span>
                      <span className="font-mono text-white">{loginData.password}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-background/50 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">EPG (TV Guide)</p>
                      <p className="text-sm text-muted-foreground">Electronic Program Guide URL</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(`${window.location.origin}/xmltv.php?username=${loginData.username}&password=${loginData.password}`, 'EPG URL')} data-testid="button-copy-epg">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <code className="block text-xs bg-background p-2 rounded overflow-x-auto text-muted-foreground">
                    {`${window.location.origin}/xmltv.php?username=${loginData.username}&password=${loginData.password}`}
                  </code>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
                <CardDescription>Your subscription information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Username</p>
                      <p className="font-medium text-white">{lineData?.username}</p>
                    </div>
                    <div className="p-4 bg-background/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Account Type</p>
                      <p className="font-medium text-white">{lineData?.isTrial ? 'Trial' : 'Premium'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-background/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Created</p>
                      <p className="font-medium text-white">
                        {lineData?.createdAt ? format(new Date(lineData.createdAt), 'PPP') : '-'}
                      </p>
                    </div>
                    <div className="p-4 bg-background/50 rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Expiration</p>
                      <p className="font-medium text-white">
                        {lineData?.expDate ? format(new Date(lineData.expDate), 'PPP') : 'Never'}
                      </p>
                    </div>
                  </div>
                  <div className="p-4 bg-background/50 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Allowed Output Formats</p>
                    <div className="flex gap-2 mt-2">
                      {(lineData?.allowedOutputs || ['m3u8', 'ts']).map((format) => (
                        <Badge key={format} variant="secondary">{format.toUpperCase()}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
