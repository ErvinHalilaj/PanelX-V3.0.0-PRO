import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Server, Shield, Globe, Bell, Save, Loader2 } from "lucide-react";
import type { Setting } from "@shared/schema";

type SettingsMap = Record<string, string>;

export default function Settings() {
  const { toast } = useToast();
  
  const { data: settingsData = [], isLoading } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  const settingsMap: SettingsMap = settingsData.reduce((acc, s) => {
    acc[s.settingKey] = s.settingValue || "";
    return acc;
  }, {} as SettingsMap);

  const [generalSettings, setGeneralSettings] = useState({
    panelName: "PanelX",
    panelUrl: "",
    timezone: "UTC",
    dateFormat: "Y-m-d",
    streamTimeout: "30",
  });

  const [securitySettings, setSecuritySettings] = useState({
    maxLoginAttempts: "5",
    lockoutDuration: "30",
    autoBlockEnabled: "true",
    autoBlockThreshold: "10",
    forceHttps: "false",
    allowedAdminIps: "",
  });

  const [streamSettings, setStreamSettings] = useState({
    defaultOutput: "ts",
    bufferSize: "8192",
    connectionTimeout: "30",
    retryAttempts: "3",
    proxyEnabled: "false",
    userAgentCheck: "true",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: "false",
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    adminEmail: "",
  });

  useEffect(() => {
    if (settingsData.length > 0) {
      setGeneralSettings({
        panelName: settingsMap["panel_name"] || "PanelX",
        panelUrl: settingsMap["panel_url"] || "",
        timezone: settingsMap["timezone"] || "UTC",
        dateFormat: settingsMap["date_format"] || "Y-m-d",
        streamTimeout: settingsMap["stream_timeout"] || "30",
      });
      setSecuritySettings({
        maxLoginAttempts: settingsMap["max_login_attempts"] || "5",
        lockoutDuration: settingsMap["lockout_duration"] || "30",
        autoBlockEnabled: settingsMap["auto_block_enabled"] || "true",
        autoBlockThreshold: settingsMap["auto_block_threshold"] || "10",
        forceHttps: settingsMap["force_https"] || "false",
        allowedAdminIps: settingsMap["allowed_admin_ips"] || "",
      });
      setStreamSettings({
        defaultOutput: settingsMap["default_output"] || "ts",
        bufferSize: settingsMap["buffer_size"] || "8192",
        connectionTimeout: settingsMap["connection_timeout"] || "30",
        retryAttempts: settingsMap["retry_attempts"] || "3",
        proxyEnabled: settingsMap["proxy_enabled"] || "false",
        userAgentCheck: settingsMap["user_agent_check"] || "true",
      });
      setNotificationSettings({
        emailEnabled: settingsMap["email_enabled"] || "false",
        smtpHost: settingsMap["smtp_host"] || "",
        smtpPort: settingsMap["smtp_port"] || "587",
        smtpUser: settingsMap["smtp_user"] || "",
        smtpPassword: settingsMap["smtp_password"] || "",
        adminEmail: settingsMap["admin_email"] || "",
      });
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (settings: { key: string; value: string; category: string }[]) => {
      for (const { key, value, category } of settings) {
        const existing = settingsData.find(s => s.settingKey === key);
        if (existing) {
          await apiRequest("PUT", `/api/settings/${key}`, { value });
        } else {
          await apiRequest("POST", "/api/settings", {
            settingKey: key,
            settingValue: value,
            settingType: "text",
            category,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings saved", description: "Your changes have been applied" });
    },
    onError: (err: any) => {
      toast({ title: "Error saving settings", description: err.message, variant: "destructive" });
    },
  });

  const handleSaveGeneral = () => {
    saveMutation.mutate([
      { key: "panel_name", value: generalSettings.panelName, category: "general" },
      { key: "panel_url", value: generalSettings.panelUrl, category: "general" },
      { key: "timezone", value: generalSettings.timezone, category: "general" },
      { key: "date_format", value: generalSettings.dateFormat, category: "general" },
      { key: "stream_timeout", value: generalSettings.streamTimeout, category: "general" },
    ]);
  };

  const handleSaveSecurity = () => {
    saveMutation.mutate([
      { key: "max_login_attempts", value: securitySettings.maxLoginAttempts, category: "security" },
      { key: "lockout_duration", value: securitySettings.lockoutDuration, category: "security" },
      { key: "auto_block_enabled", value: securitySettings.autoBlockEnabled, category: "security" },
      { key: "auto_block_threshold", value: securitySettings.autoBlockThreshold, category: "security" },
      { key: "force_https", value: securitySettings.forceHttps, category: "security" },
      { key: "allowed_admin_ips", value: securitySettings.allowedAdminIps, category: "security" },
    ]);
  };

  const handleSaveStreams = () => {
    saveMutation.mutate([
      { key: "default_output", value: streamSettings.defaultOutput, category: "streaming" },
      { key: "buffer_size", value: streamSettings.bufferSize, category: "streaming" },
      { key: "connection_timeout", value: streamSettings.connectionTimeout, category: "streaming" },
      { key: "retry_attempts", value: streamSettings.retryAttempts, category: "streaming" },
      { key: "proxy_enabled", value: streamSettings.proxyEnabled, category: "streaming" },
      { key: "user_agent_check", value: streamSettings.userAgentCheck, category: "streaming" },
    ]);
  };

  const handleSaveNotifications = () => {
    saveMutation.mutate([
      { key: "email_enabled", value: notificationSettings.emailEnabled, category: "api" },
      { key: "smtp_host", value: notificationSettings.smtpHost, category: "api" },
      { key: "smtp_port", value: notificationSettings.smtpPort, category: "api" },
      { key: "smtp_user", value: notificationSettings.smtpUser, category: "api" },
      { key: "smtp_password", value: notificationSettings.smtpPassword, category: "api" },
      { key: "admin_email", value: notificationSettings.adminEmail, category: "api" },
    ]);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
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
                    onChange={(e) => setGeneralSettings({...generalSettings, streamTimeout: e.target.value})}
                    data-testid="input-stream-timeout"
                  />
                </div>
              </div>
              <Button onClick={handleSaveGeneral} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-general">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
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
                    onChange={(e) => setSecuritySettings({...securitySettings, maxLoginAttempts: e.target.value})}
                    data-testid="input-max-login-attempts"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lockout Duration (minutes)</Label>
                  <Input 
                    type="number"
                    value={securitySettings.lockoutDuration} 
                    onChange={(e) => setSecuritySettings({...securitySettings, lockoutDuration: e.target.value})}
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
                  checked={securitySettings.autoBlockEnabled === "true"}
                  onCheckedChange={(checked) => setSecuritySettings({...securitySettings, autoBlockEnabled: checked ? "true" : "false"})}
                  data-testid="switch-auto-block"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                <div>
                  <Label>Force HTTPS</Label>
                  <p className="text-sm text-muted-foreground">Redirect all traffic to HTTPS</p>
                </div>
                <Switch 
                  checked={securitySettings.forceHttps === "true"}
                  onCheckedChange={(checked) => setSecuritySettings({...securitySettings, forceHttps: checked ? "true" : "false"})}
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
              <Button onClick={handleSaveSecurity} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-security">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
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
                    onChange={(e) => setStreamSettings({...streamSettings, bufferSize: e.target.value})}
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
                    onChange={(e) => setStreamSettings({...streamSettings, connectionTimeout: e.target.value})}
                    data-testid="input-connection-timeout"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retry Attempts</Label>
                  <Input 
                    type="number"
                    value={streamSettings.retryAttempts} 
                    onChange={(e) => setStreamSettings({...streamSettings, retryAttempts: e.target.value})}
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
                  checked={streamSettings.proxyEnabled === "true"}
                  onCheckedChange={(checked) => setStreamSettings({...streamSettings, proxyEnabled: checked ? "true" : "false"})}
                  data-testid="switch-proxy-enabled"
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg">
                <div>
                  <Label>User Agent Validation</Label>
                  <p className="text-sm text-muted-foreground">Check user agent against blocked list</p>
                </div>
                <Switch 
                  checked={streamSettings.userAgentCheck === "true"}
                  onCheckedChange={(checked) => setStreamSettings({...streamSettings, userAgentCheck: checked ? "true" : "false"})}
                  data-testid="switch-user-agent-check"
                />
              </div>
              <Button onClick={handleSaveStreams} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-streams">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
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
                  checked={notificationSettings.emailEnabled === "true"}
                  onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, emailEnabled: checked ? "true" : "false"})}
                  data-testid="switch-email-enabled"
                />
              </div>
              {notificationSettings.emailEnabled === "true" && (
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
                        onChange={(e) => setNotificationSettings({...notificationSettings, smtpPort: e.target.value})}
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
              <Button onClick={handleSaveNotifications} disabled={saveMutation.isPending} className="gap-2" data-testid="button-save-notifications">
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
