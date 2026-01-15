import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Server, Shield, Globe, Bell, Database, Save } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  
  const [generalSettings, setGeneralSettings] = useState({
    panelName: "PanelX",
    panelUrl: "",
    timezone: "UTC",
    dateFormat: "Y-m-d",
    streamTimeout: 30,
  });

  const [securitySettings, setSecuritySettings] = useState({
    maxLoginAttempts: 5,
    lockoutDuration: 30,
    autoBlockEnabled: true,
    autoBlockThreshold: 10,
    forceHttps: false,
    allowedAdminIps: "",
  });

  const [streamSettings, setStreamSettings] = useState({
    defaultOutput: "ts",
    bufferSize: 8192,
    connectionTimeout: 30,
    retryAttempts: 3,
    proxyEnabled: false,
    userAgentCheck: true,
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: false,
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPassword: "",
    adminEmail: "",
  });

  const handleSave = (section: string) => {
    toast({ title: `${section} settings saved`, description: "Your changes have been applied" });
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure your PanelX installation</p>
        </div>

        <Tabs defaultValue="general" className="space-y-4">
          <TabsList className="bg-card/50">
            <TabsTrigger value="general" className="gap-2"><Server className="w-4 h-4" /> General</TabsTrigger>
            <TabsTrigger value="security" className="gap-2"><Shield className="w-4 h-4" /> Security</TabsTrigger>
            <TabsTrigger value="streams" className="gap-2"><Globe className="w-4 h-4" /> Streams</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Basic panel configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Panel Name</Label>
                    <Input 
                      value={generalSettings.panelName} 
                      onChange={(e) => setGeneralSettings({...generalSettings, panelName: e.target.value})}
                      data-testid="input-panel-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Panel URL</Label>
                    <Input 
                      value={generalSettings.panelUrl} 
                      onChange={(e) => setGeneralSettings({...generalSettings, panelUrl: e.target.value})}
                      placeholder="https://your-panel.com"
                      data-testid="input-panel-url"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select value={generalSettings.timezone} onValueChange={(val) => setGeneralSettings({...generalSettings, timezone: val})}>
                      <SelectTrigger data-testid="select-timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stream Timeout (seconds)</Label>
                    <Input 
                      type="number"
                      value={generalSettings.streamTimeout} 
                      onChange={(e) => setGeneralSettings({...generalSettings, streamTimeout: parseInt(e.target.value) || 30})}
                      data-testid="input-stream-timeout"
                    />
                  </div>
                </div>
                <Button onClick={() => handleSave("General")} className="gap-2" data-testid="button-save-general">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Configure security and access control</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Max Login Attempts</Label>
                    <Input 
                      type="number"
                      value={securitySettings.maxLoginAttempts} 
                      onChange={(e) => setSecuritySettings({...securitySettings, maxLoginAttempts: parseInt(e.target.value) || 5})}
                      data-testid="input-max-login-attempts"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lockout Duration (minutes)</Label>
                    <Input 
                      type="number"
                      value={securitySettings.lockoutDuration} 
                      onChange={(e) => setSecuritySettings({...securitySettings, lockoutDuration: parseInt(e.target.value) || 30})}
                      data-testid="input-lockout-duration"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                  <div>
                    <Label>Auto-Block Suspicious IPs</Label>
                    <p className="text-sm text-muted-foreground">Automatically block IPs after failed attempts</p>
                  </div>
                  <Switch 
                    checked={securitySettings.autoBlockEnabled}
                    onCheckedChange={(checked) => setSecuritySettings({...securitySettings, autoBlockEnabled: checked})}
                    data-testid="switch-auto-block"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                  <div>
                    <Label>Force HTTPS</Label>
                    <p className="text-sm text-muted-foreground">Redirect all traffic to HTTPS</p>
                  </div>
                  <Switch 
                    checked={securitySettings.forceHttps}
                    onCheckedChange={(checked) => setSecuritySettings({...securitySettings, forceHttps: checked})}
                    data-testid="switch-force-https"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Allowed Admin IPs</Label>
                  <Textarea 
                    value={securitySettings.allowedAdminIps}
                    onChange={(e) => setSecuritySettings({...securitySettings, allowedAdminIps: e.target.value})}
                    placeholder="One IP per line (leave empty to allow all)"
                    rows={3}
                    data-testid="input-allowed-admin-ips"
                  />
                </div>
                <Button onClick={() => handleSave("Security")} className="gap-2" data-testid="button-save-security">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="streams">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Stream Settings</CardTitle>
                <CardDescription>Configure stream behavior and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default Output Format</Label>
                    <Select value={streamSettings.defaultOutput} onValueChange={(val) => setStreamSettings({...streamSettings, defaultOutput: val})}>
                      <SelectTrigger data-testid="select-default-output">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ts">TS (MPEG-TS)</SelectItem>
                        <SelectItem value="m3u8">M3U8 (HLS)</SelectItem>
                        <SelectItem value="rtmp">RTMP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Buffer Size (bytes)</Label>
                    <Input 
                      type="number"
                      value={streamSettings.bufferSize} 
                      onChange={(e) => setStreamSettings({...streamSettings, bufferSize: parseInt(e.target.value) || 8192})}
                      data-testid="input-buffer-size"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Connection Timeout (seconds)</Label>
                    <Input 
                      type="number"
                      value={streamSettings.connectionTimeout} 
                      onChange={(e) => setStreamSettings({...streamSettings, connectionTimeout: parseInt(e.target.value) || 30})}
                      data-testid="input-connection-timeout"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Retry Attempts</Label>
                    <Input 
                      type="number"
                      value={streamSettings.retryAttempts} 
                      onChange={(e) => setStreamSettings({...streamSettings, retryAttempts: parseInt(e.target.value) || 3})}
                      data-testid="input-retry-attempts"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                  <div>
                    <Label>Enable Stream Proxy</Label>
                    <p className="text-sm text-muted-foreground">Route streams through proxy servers</p>
                  </div>
                  <Switch 
                    checked={streamSettings.proxyEnabled}
                    onCheckedChange={(checked) => setStreamSettings({...streamSettings, proxyEnabled: checked})}
                    data-testid="switch-proxy-enabled"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                  <div>
                    <Label>User Agent Validation</Label>
                    <p className="text-sm text-muted-foreground">Check user agent against blocked list</p>
                  </div>
                  <Switch 
                    checked={streamSettings.userAgentCheck}
                    onCheckedChange={(checked) => setStreamSettings({...streamSettings, userAgentCheck: checked})}
                    data-testid="switch-user-agent-check"
                  />
                </div>
                <Button onClick={() => handleSave("Stream")} className="gap-2" data-testid="button-save-streams">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
                <CardDescription>Configure email and alert notifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                  <div>
                    <Label>Enable Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send alerts via email</p>
                  </div>
                  <Switch 
                    checked={notificationSettings.emailEnabled}
                    onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, emailEnabled: checked})}
                    data-testid="switch-email-enabled"
                  />
                </div>
                {notificationSettings.emailEnabled && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Host</Label>
                        <Input 
                          value={notificationSettings.smtpHost}
                          onChange={(e) => setNotificationSettings({...notificationSettings, smtpHost: e.target.value})}
                          placeholder="smtp.example.com"
                          data-testid="input-smtp-host"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Port</Label>
                        <Input 
                          type="number"
                          value={notificationSettings.smtpPort}
                          onChange={(e) => setNotificationSettings({...notificationSettings, smtpPort: parseInt(e.target.value) || 587})}
                          data-testid="input-smtp-port"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>SMTP Username</Label>
                        <Input 
                          value={notificationSettings.smtpUser}
                          onChange={(e) => setNotificationSettings({...notificationSettings, smtpUser: e.target.value})}
                          data-testid="input-smtp-user"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>SMTP Password</Label>
                        <Input 
                          type="password"
                          value={notificationSettings.smtpPassword}
                          onChange={(e) => setNotificationSettings({...notificationSettings, smtpPassword: e.target.value})}
                          data-testid="input-smtp-password"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Admin Email</Label>
                      <Input 
                        type="email"
                        value={notificationSettings.adminEmail}
                        onChange={(e) => setNotificationSettings({...notificationSettings, adminEmail: e.target.value})}
                        placeholder="admin@example.com"
                        data-testid="input-admin-email"
                      />
                    </div>
                  </>
                )}
                <Button onClick={() => handleSave("Notification")} className="gap-2" data-testid="button-save-notifications">
                  <Save className="w-4 h-4" /> Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
