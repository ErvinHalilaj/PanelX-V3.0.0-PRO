import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Lock, Plus, Trash2, Loader2, RefreshCw, CheckCircle, AlertCircle, Clock, FileText, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface SslCertificate {
  id: number;
  domain: string;
  status: string;
  issuedAt: string | null;
  expiresAt: string | null;
  renewalEmail: string | null;
  autoRenew: boolean;
  lastRenewalAttempt: string | null;
  renewalError: string | null;
  certificatePath: string | null;
  privateKeyPath: string | null;
  createdAt: string;
}

export default function SslCertificates() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingCert, setViewingCert] = useState<SslCertificate | null>(null);
  const [showInstallScript, setShowInstallScript] = useState(false);

  const { data: certificates = [], isLoading } = useQuery<SslCertificate[]>({
    queryKey: ["/api/ssl-certificates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: { domain: string; renewalEmail?: string; autoRenew?: boolean }) =>
      apiRequest("POST", "/api/ssl-certificates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssl-certificates"] });
      setDialogOpen(false);
      toast({ title: "Certificate record created. Run the install script to issue the certificate." });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to create certificate", variant: "destructive" }),
  });

  const renewMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ssl-certificates/${id}/renew`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssl-certificates"] });
      toast({ title: "Certificate renewal initiated" });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to renew certificate", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/ssl-certificates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ssl-certificates"] });
      toast({ title: "Certificate deleted" });
    },
    onError: () => toast({ title: "Failed to delete certificate", variant: "destructive" }),
  });

  const { data: installScript } = useQuery<{ script: string }>({
    queryKey: ["/api/ssl-certificates/install-script"],
    enabled: showInstallScript,
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      domain: formData.get("domain") as string,
      renewalEmail: formData.get("renewalEmail") as string || undefined,
      autoRenew: formData.get("autoRenew") === "on",
    });
  };

  const getStatusBadge = (cert: SslCertificate) => {
    switch (cert.status) {
      case "active":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case "expired":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Expired</Badge>;
      case "pending":
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary">{cert.status}</Badge>;
    }
  };

  const getDaysUntilExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (isLoading) {
    return (
      <Layout title="SSL Certificates" subtitle="Manage SSL/TLS certificates">
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="SSL Certificates"
      subtitle="Manage Let's Encrypt SSL certificates for your domains"
    >
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowInstallScript(true)} data-testid="button-install-script">
            <Download className="w-4 h-4 mr-2" />
            Install Script
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-certificate">
                <Plus className="w-4 h-4 mr-2" />
                Add Domain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add SSL Certificate</DialogTitle>
                <DialogDescription>Create a Let's Encrypt certificate for your domain</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domain Name</Label>
                  <Input id="domain" name="domain" required placeholder="example.com" data-testid="input-domain" />
                  <p className="text-xs text-muted-foreground">Enter the domain without http:// or https://</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renewalEmail">Renewal Email (optional)</Label>
                  <Input id="renewalEmail" name="renewalEmail" type="email" placeholder="admin@example.com" />
                  <p className="text-xs text-muted-foreground">You'll receive renewal notifications at this email</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoRenew">Auto-Renew</Label>
                  <Switch id="autoRenew" name="autoRenew" defaultChecked />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Certificate
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Dialog open={showInstallScript} onOpenChange={setShowInstallScript}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Certbot Install Script</DialogTitle>
              <DialogDescription>Run this script on your server to install certbot and request certificates</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Run this script as root on your Ubuntu/Debian server. Make sure your domain's DNS points to the server.
                </AlertDescription>
              </Alert>
              <div className="bg-secondary/30 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm font-mono whitespace-pre-wrap">{installScript?.script || "Loading..."}</pre>
              </div>
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(installScript?.script || "")}>
                Copy to Clipboard
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {certificates.length === 0 ? (
          <Alert>
            <Lock className="w-4 h-4" />
            <AlertDescription>No SSL certificates configured. Add a domain to get started with HTTPS.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certificates.map((cert) => {
              const daysLeft = getDaysUntilExpiry(cert.expiresAt);
              return (
                <Card key={cert.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Lock className="w-4 h-4 text-primary" />
                        {cert.domain}
                      </CardTitle>
                      {getStatusBadge(cert)}
                    </div>
                    {cert.autoRenew && (
                      <CardDescription className="flex items-center gap-1">
                        <RefreshCw className="w-3 h-3" />
                        Auto-renewal enabled
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {cert.expiresAt && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Expires: </span>
                        <span className={daysLeft !== null && daysLeft < 30 ? "text-destructive font-medium" : ""}>
                          {new Date(cert.expiresAt).toLocaleDateString()}
                          {daysLeft !== null && ` (${daysLeft} days)`}
                        </span>
                      </div>
                    )}
                    {cert.renewalError && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription className="text-xs">{cert.renewalError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingCert(cert)}
                        data-testid={`button-view-cert-${cert.id}`}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      {cert.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => renewMutation.mutate(cert.id)}
                          disabled={renewMutation.isPending}
                          data-testid={`button-renew-${cert.id}`}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Renew
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(cert.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-cert-${cert.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!viewingCert} onOpenChange={() => setViewingCert(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Certificate Details</DialogTitle>
              <DialogDescription>{viewingCert?.domain}</DialogDescription>
            </DialogHeader>
            {viewingCert && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {getStatusBadge(viewingCert)}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Auto-Renew</p>
                    <p>{viewingCert.autoRenew ? "Enabled" : "Disabled"}</p>
                  </div>
                  {viewingCert.issuedAt && (
                    <div>
                      <p className="text-muted-foreground">Issued</p>
                      <p>{new Date(viewingCert.issuedAt).toLocaleString()}</p>
                    </div>
                  )}
                  {viewingCert.expiresAt && (
                    <div>
                      <p className="text-muted-foreground">Expires</p>
                      <p>{new Date(viewingCert.expiresAt).toLocaleString()}</p>
                    </div>
                  )}
                  {viewingCert.renewalEmail && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Renewal Email</p>
                      <p>{viewingCert.renewalEmail}</p>
                    </div>
                  )}
                  {viewingCert.certificatePath && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Certificate Path</p>
                      <p className="font-mono text-xs">{viewingCert.certificatePath}</p>
                    </div>
                  )}
                  {viewingCert.privateKeyPath && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Private Key Path</p>
                      <p className="font-mono text-xs">{viewingCert.privateKeyPath}</p>
                    </div>
                  )}
                  {viewingCert.lastRenewalAttempt && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Last Renewal Attempt</p>
                      <p>{new Date(viewingCert.lastRenewalAttempt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
                {viewingCert.renewalError && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{viewingCert.renewalError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
