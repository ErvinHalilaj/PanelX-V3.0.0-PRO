import { useState } from 'react';
import {
  useSessions,
  useDestroySession,
  useGenerate2FA,
  useEnable2FA,
  useDisable2FA,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Key, Smartphone, Trash2, Copy, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';

export default function Security() {
  const { toast } = useToast();
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false);
  const [twoFASetup, setTwoFASetup] = useState<any>(null);
  const [twoFAToken, setTwoFAToken] = useState('');
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyExpiry, setApiKeyExpiry] = useState('30');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  // Fetch data
  const sessions = useSessions();
  const apiKeys = useApiKeys();

  // Mutations
  const destroySession = useDestroySession();
  const generate2FA = useGenerate2FA();
  const enable2FA = useEnable2FA();
  const disable2FA = useDisable2FA();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const handleGenerate2FA = async () => {
    try {
      const result = await generate2FA.mutateAsync();
      setTwoFASetup(result);
      
      // Generate QR code image
      const qrDataUrl = await QRCode.toDataURL(result.qrCodeUrl);
      setQrCodeUrl(qrDataUrl);
      
      toast({ title: 'Success', description: '2FA secret generated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to generate 2FA secret', variant: 'destructive' });
    }
  };

  const handleEnable2FA = async () => {
    try {
      await enable2FA.mutateAsync(twoFAToken);
      toast({ title: 'Success', description: '2FA enabled successfully' });
      setTwoFADialogOpen(false);
      setTwoFASetup(null);
      setTwoFAToken('');
    } catch (error) {
      toast({ title: 'Error', description: 'Invalid token', variant: 'destructive' });
    }
  };

  const handleDisable2FA = async () => {
    try {
      await disable2FA.mutateAsync();
      toast({ title: 'Success', description: '2FA disabled successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to disable 2FA', variant: 'destructive' });
    }
  };

  const handleDestroySession = async (sessionId: string) => {
    try {
      await destroySession.mutateAsync(sessionId);
      toast({ title: 'Success', description: 'Session terminated' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to terminate session', variant: 'destructive' });
    }
  };

  const handleCreateApiKey = async () => {
    try {
      const result = await createApiKey.mutateAsync({
        name: apiKeyName,
        permissions: ['*'],
        expiresInDays: Number(apiKeyExpiry),
      });
      setNewApiKey(result.key);
      toast({ title: 'Success', description: 'API key created' });
      setApiKeyName('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create API key', variant: 'destructive' });
    }
  };

  const handleRevokeApiKey = async (keyId: string) => {
    try {
      await revokeApiKey.mutateAsync(keyId);
      toast({ title: 'Success', description: 'API key revoked' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to revoke API key', variant: 'destructive' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Settings</h1>
        <p className="text-muted-foreground">Manage your authentication and security preferences</p>
      </div>

      <Tabs defaultValue="2fa">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="2fa">Two-Factor Auth</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        {/* 2FA Tab */}
        <TabsContent value="2fa" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security to your account with 2FA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">2FA Status</h3>
                  <p className="text-sm text-muted-foreground">
                    Two-factor authentication is currently disabled
                  </p>
                </div>
                <Dialog open={twoFADialogOpen} onOpenChange={setTwoFADialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={handleGenerate2FA}>
                      <Shield className="w-4 h-4 mr-2" />
                      Enable 2FA
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
                      <DialogDescription>
                        Scan the QR code with your authenticator app and enter the code to enable 2FA
                      </DialogDescription>
                    </DialogHeader>
                    {twoFASetup && (
                      <div className="space-y-4">
                        {/* QR Code */}
                        {qrCodeUrl && (
                          <div className="flex flex-col items-center space-y-2">
                            <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                            <p className="text-sm text-muted-foreground">
                              Scan this QR code with Google Authenticator, Authy, or similar
                            </p>
                          </div>
                        )}

                        {/* Manual Entry */}
                        <div className="space-y-2">
                          <Label>Or enter this code manually:</Label>
                          <div className="flex items-center gap-2">
                            <Input value={twoFASetup.secret} readOnly />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(twoFASetup.secret)}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Backup Codes */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Backup Codes</Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowBackupCodes(!showBackupCodes)}
                            >
                              {showBackupCodes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          </div>
                          {showBackupCodes && (
                            <div className="p-4 bg-muted rounded-lg">
                              <div className="grid grid-cols-2 gap-2">
                                {twoFASetup.backupCodes.map((code: string, index: number) => (
                                  <div key={index} className="font-mono text-sm">
                                    {code}
                                  </div>
                                ))}
                              </div>
                              <p className="text-sm text-muted-foreground mt-2">
                                <AlertTriangle className="w-4 h-4 inline mr-1" />
                                Save these codes in a safe place. Each can only be used once.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Verification */}
                        <div className="space-y-2">
                          <Label>Enter 6-digit code to verify:</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder="000000"
                              value={twoFAToken}
                              onChange={(e) => setTwoFAToken(e.target.value)}
                              maxLength={6}
                            />
                            <Button onClick={handleEnable2FA} disabled={twoFAToken.length !== 6}>
                              Verify & Enable
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>Manage your active login sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.data && sessions.data.length > 0 ? (
                <div className="space-y-3">
                  {sessions.data.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{session.ipAddress}</h3>
                          <Badge variant="secondary">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{session.userAgent}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Last active: {new Date(session.lastActive).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDestroySession(session.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Terminate
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No active sessions</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="w-5 h-5" />
                    API Keys
                  </CardTitle>
                  <CardDescription>Manage your API keys for programmatic access</CardDescription>
                </div>
                <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Key className="w-4 h-4 mr-2" />
                      Create API Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New API Key</DialogTitle>
                      <DialogDescription>
                        Generate a new API key for programmatic access to your account
                      </DialogDescription>
                    </DialogHeader>
                    {newApiKey ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <Label>Your new API key:</Label>
                          <div className="flex items-center gap-2 mt-2">
                            <Input value={newApiKey} readOnly className="font-mono text-sm" />
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(newApiKey)}>
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            <AlertTriangle className="w-4 h-4 inline mr-1" />
                            Copy this key now. You won't be able to see it again!
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            setNewApiKey(null);
                            setApiKeyDialogOpen(false);
                          }}
                          className="w-full"
                        >
                          Done
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Key Name</Label>
                          <Input
                            placeholder="My API Key"
                            value={apiKeyName}
                            onChange={(e) => setApiKeyName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Expiration</Label>
                          <Select value={apiKeyExpiry} onValueChange={setApiKeyExpiry}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="7">7 days</SelectItem>
                              <SelectItem value="30">30 days</SelectItem>
                              <SelectItem value="90">90 days</SelectItem>
                              <SelectItem value="365">1 year</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleCreateApiKey} className="w-full" disabled={!apiKeyName}>
                          Generate Key
                        </Button>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {apiKeys.data && apiKeys.data.length > 0 ? (
                <div className="space-y-3">
                  {apiKeys.data.map((key) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <h3 className="font-semibold">{key.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Created: {new Date(key.createdAt).toLocaleDateString()}
                        </p>
                        {key.lastUsed && (
                          <p className="text-xs text-muted-foreground">
                            Last used: {new Date(key.lastUsed).toLocaleDateString()}
                          </p>
                        )}
                        {key.expiresAt && (
                          <p className="text-xs text-muted-foreground">
                            Expires: {new Date(key.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeApiKey(key.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No API keys created yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
