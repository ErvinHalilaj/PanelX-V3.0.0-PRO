import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, Key, Copy, Check, AlertTriangle, Loader2, RefreshCw, Smartphone, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/components/AdminAuthProvider";
import type { TwoFactorAuth as TwoFactorAuthType } from "@shared/schema";

export default function TwoFactorAuth() {
  const { user } = useAdminAuth();
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  const { data: twoFactor, isLoading, isError } = useQuery<TwoFactorAuthType | null>({
    queryKey: ["/api/2fa", user?.id],
    enabled: !!user?.id,
  });

  const setupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/2fa/setup"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa"] });
      setSetupDialogOpen(true);
    },
    onError: () => toast({ title: "Failed to setup 2FA", variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: (code: string) => apiRequest("POST", "/api/2fa/verify", { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa"] });
      setSetupDialogOpen(false);
      setVerifyCode("");
      toast({ title: "Two-factor authentication enabled successfully" });
    },
    onError: () => toast({ title: "Invalid verification code", variant: "destructive" }),
  });

  const disableMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/2fa/disable"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa"] });
      toast({ title: "Two-factor authentication disabled" });
    },
    onError: () => toast({ title: "Failed to disable 2FA", variant: "destructive" }),
  });

  const regenerateBackupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/2fa/regenerate-backup"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/2fa"] });
      toast({ title: "Backup codes regenerated" });
    },
    onError: () => toast({ title: "Failed to regenerate backup codes", variant: "destructive" }),
  });

  const copySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
    toast({ title: "Secret copied to clipboard" });
  };

  const backupCodes = (twoFactor?.backupCodes as string[]) || [];

  if (isError) {
    return (
      <Layout title="Two-Factor Authentication" subtitle="Secure your account with 2FA">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load 2FA settings. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Two-Factor Authentication" subtitle="Secure your account with 2FA">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="max-w-2xl">
          <div className="p-6 rounded-lg bg-secondary/30 border border-white/5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Two-Factor Authentication</h3>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
              </div>
              <Badge variant={twoFactor?.enabled ? "default" : "secondary"}>
                {twoFactor?.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {!twoFactor?.enabled ? (
              <div className="space-y-4">
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Two-factor authentication adds an extra layer of security by requiring a code from
                    your authenticator app when signing in.
                  </AlertDescription>
                </Alert>
                <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending} data-testid="button-enable-2fa">
                  {setupMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  <Key className="w-4 h-4 mr-2" /> Enable 2FA
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-500">
                  <Check className="w-5 h-5" />
                  <span>Your account is protected with two-factor authentication</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowBackupCodes(!showBackupCodes)} data-testid="button-show-backup">
                    <Key className="w-4 h-4 mr-2" />
                    {showBackupCodes ? "Hide" : "Show"} Backup Codes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => regenerateBackupMutation.mutate()}
                    disabled={regenerateBackupMutation.isPending}
                    data-testid="button-regenerate-backup"
                  >
                    {regenerateBackupMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Regenerate Codes
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => disableMutation.mutate()}
                    disabled={disableMutation.isPending}
                    data-testid="button-disable-2fa"
                  >
                    {disableMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Disable 2FA
                  </Button>
                </div>
              </div>
            )}
          </div>

          {showBackupCodes && backupCodes.length > 0 && (
            <div className="p-6 rounded-lg bg-secondary/30 border border-white/5">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Key className="w-4 h-4" /> Backup Codes
              </h4>
              <Alert className="mb-4">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  Save these backup codes in a secure place. Each code can only be used once.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="font-mono text-sm p-2 bg-background rounded border border-white/10"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setup Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          {twoFactor && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                </p>
                <div className="bg-white p-4 rounded-lg inline-block mb-4">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=otpauth://totp/PanelX:${user?.username}?secret=${twoFactor.secret}&issuer=PanelX`}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Or enter this code manually:</Label>
                <div className="flex items-center gap-2">
                  <Input value={twoFactor.secret} readOnly className="font-mono" />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copySecret(twoFactor.secret)}
                  >
                    {copiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter verification code:</Label>
                <Input
                  id="verifyCode"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="000000"
                  maxLength={6}
                  className="font-mono text-center text-lg"
                  data-testid="input-verify-code"
                />
              </div>

              <DialogFooter>
                <Button
                  onClick={() => verifyMutation.mutate(verifyCode)}
                  disabled={verifyCode.length !== 6 || verifyMutation.isPending}
                  data-testid="button-verify-2fa"
                >
                  {verifyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Verify and Enable
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
