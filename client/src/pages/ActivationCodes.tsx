import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Copy, Check, Gift, Calendar, Users, Package, Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ActivationCode, Bouquet } from "@shared/schema";

export default function ActivationCodes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showUsed, setShowUsed] = useState(false);

  const { data: codes = [], isLoading, isError } = useQuery<ActivationCode[]>({
    queryKey: ["/api/activation-codes"],
  });

  const { data: bouquets = [] } = useQuery<Bouquet[]>({
    queryKey: ["/api/bouquets"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/activation-codes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activation-codes"] });
      setDialogOpen(false);
      toast({ title: "Activation code created successfully" });
    },
    onError: () => toast({ title: "Failed to create code", variant: "destructive" }),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/activation-codes/bulk", data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/activation-codes"] });
      setBulkDialogOpen(false);
      toast({ title: `Created ${result.count} activation codes successfully` });
    },
    onError: () => toast({ title: "Failed to create codes", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/activation-codes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activation-codes"] });
      toast({ title: "Activation code deleted" });
    },
    onError: () => toast({ title: "Failed to delete code", variant: "destructive" }),
  });

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: "Code copied to clipboard" });
  };

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedBouquets = bouquets
      .filter((_, i) => formData.get(`bouquet-${i}`) === "on")
      .map((b) => b.id);
    
    createMutation.mutate({
      code: formData.get("code") as string,
      durationDays: parseInt(formData.get("durationDays") as string) || 30,
      maxConnections: parseInt(formData.get("maxConnections") as string) || 1,
      bouquetIds: selectedBouquets,
      maxUses: parseInt(formData.get("maxUses") as string) || 1,
      expiresAt: formData.get("expiresAt") || null,
    });
  };

  const handleBulkCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedBouquets = bouquets
      .filter((_, i) => formData.get(`bulk-bouquet-${i}`) === "on")
      .map((b) => b.id);
    
    bulkCreateMutation.mutate({
      count: parseInt(formData.get("count") as string) || 10,
      durationDays: parseInt(formData.get("durationDays") as string) || 30,
      maxConnections: parseInt(formData.get("maxConnections") as string) || 1,
      bouquetIds: selectedBouquets,
      maxUses: parseInt(formData.get("maxUses") as string) || 1,
      expiresAt: formData.get("expiresAt") || null,
      prefix: formData.get("prefix") as string || "",
    });
  };

  const filteredCodes = showUsed ? codes : codes.filter((c) => !c.usedBy);

  if (isError) {
    return (
      <Layout title="Activation Codes" subtitle="Manage promotional and activation codes">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            Failed to load activation codes. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </Layout>
    );
  }

  return (
    <Layout title="Activation Codes" subtitle="Manage promotional and activation codes">
      <div className="flex gap-2 mb-6">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-code">
              <Plus className="w-4 h-4 mr-2" /> Create Code
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Activation Code</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code (leave blank to auto-generate)</Label>
                <Input id="code" name="code" placeholder="WELCOME2024" data-testid="input-code" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="durationDays">Duration (days)</Label>
                  <Input id="durationDays" name="durationDays" type="number" defaultValue={30} data-testid="input-duration" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxConnections">Max Connections</Label>
                  <Input id="maxConnections" name="maxConnections" type="number" defaultValue={1} data-testid="input-connections" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxUses">Max Uses</Label>
                  <Input id="maxUses" name="maxUses" type="number" defaultValue={1} data-testid="input-max-uses" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input id="expiresAt" name="expiresAt" type="datetime-local" data-testid="input-expires" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bouquets</Label>
                <div className="p-3 border border-white/10 rounded-md bg-background/50 max-h-32 overflow-y-auto">
                  {bouquets.map((bouquet, i) => (
                    <div key={bouquet.id} className="flex items-center gap-2 py-1">
                      <Checkbox id={`bouquet-${i}`} name={`bouquet-${i}`} />
                      <Label htmlFor={`bouquet-${i}`} className="text-sm">{bouquet.bouquetName}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-code">
                  {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Code
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" data-testid="button-bulk-create">
              <Gift className="w-4 h-4 mr-2" /> Bulk Generate
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Generate Codes</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleBulkCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="count">Number of Codes</Label>
                  <Input id="count" name="count" type="number" defaultValue={10} data-testid="input-bulk-count" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefix">Prefix (optional)</Label>
                  <Input id="prefix" name="prefix" placeholder="PROMO" data-testid="input-prefix" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="durationDays">Duration (days)</Label>
                  <Input id="durationDays" name="durationDays" type="number" defaultValue={30} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxConnections">Max Connections</Label>
                  <Input id="maxConnections" name="maxConnections" type="number" defaultValue={1} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxUses">Max Uses per Code</Label>
                  <Input id="maxUses" name="maxUses" type="number" defaultValue={1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Expires At</Label>
                  <Input id="expiresAt" name="expiresAt" type="datetime-local" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Bouquets</Label>
                <div className="p-3 border border-white/10 rounded-md bg-background/50 max-h-32 overflow-y-auto">
                  {bouquets.map((bouquet, i) => (
                    <div key={bouquet.id} className="flex items-center gap-2 py-1">
                      <Checkbox id={`bulk-bouquet-${i}`} name={`bulk-bouquet-${i}`} />
                      <Label htmlFor={`bulk-bouquet-${i}`} className="text-sm">{bouquet.bouquetName}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={bulkCreateMutation.isPending} data-testid="button-submit-bulk">
                  {bulkCreateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate Codes
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Button variant="ghost" onClick={() => setShowUsed(!showUsed)} data-testid="button-toggle-used">
          {showUsed ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
          {showUsed ? "Hide Used" : "Show Used"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredCodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No activation codes found. Create one to get started.
            </div>
          ) : (
            filteredCodes.map((code) => (
              <div
                key={code.id}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-white/5"
                data-testid={`code-item-${code.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-lg font-bold">{code.code}</code>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => copyCode(code.code)}
                        data-testid={`button-copy-${code.id}`}
                      >
                        {copiedCode === code.code ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {code.durationDays} days
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {code.maxConnections} conn
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {(code.bouquets as number[])?.length || 0} bouquets
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={code.usedBy ? "secondary" : "default"}>
                    {code.usedBy ? "Used" : "Available"}
                  </Badge>
                  {code.expiresAt && (
                    <Badge variant="outline">
                      Expires {format(new Date(code.expiresAt), "MMM d")}
                    </Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(code.id)}
                    data-testid={`button-delete-${code.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Layout>
  );
}
