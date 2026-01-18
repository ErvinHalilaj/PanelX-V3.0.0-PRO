import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileOutput, Plus, Pencil, Trash2, Save } from "lucide-react";
import type { AccessOutput } from "@shared/schema";

export default function AccessOutputs() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOutput, setEditingOutput] = useState<AccessOutput | null>(null);
  const [formData, setFormData] = useState({
    outputName: "",
    outputKey: "",
    outputExt: "",
    enabled: true,
  });

  const { data: outputs = [], isLoading } = useQuery<AccessOutput[]>({
    queryKey: ["/api/access-outputs"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/access-outputs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-outputs"] });
      toast({ title: "Output type created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof formData> }) =>
      apiRequest("PUT", `/api/access-outputs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-outputs"] });
      toast({ title: "Output type updated successfully" });
      setEditingOutput(null);
      setIsDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/access-outputs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/access-outputs"] });
      toast({ title: "Output type deleted successfully" });
    },
  });

  const resetForm = () => {
    setFormData({ outputName: "", outputKey: "", outputExt: "", enabled: true });
    setEditingOutput(null);
  };

  const handleEdit = (output: AccessOutput) => {
    setEditingOutput(output);
    setFormData({
      outputName: output.outputName,
      outputKey: output.outputKey,
      outputExt: output.outputExt || "",
      enabled: output.enabled ?? true,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingOutput) {
      updateMutation.mutate({ id: editingOutput.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div className="p-6">Loading output types...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileOutput className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Access Outputs</h1>
            <p className="text-muted-foreground">Manage output formats (HLS, MPEGTS, RTMP)</p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-output">
              <Plus className="h-4 w-4 mr-2" />
              Add Output Type
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingOutput ? "Edit Output Type" : "Add Output Type"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  data-testid="input-output-name"
                  value={formData.outputName}
                  onChange={(e) => setFormData({ ...formData, outputName: e.target.value })}
                  placeholder="e.g., HLS, MPEGTS, RTMP"
                />
              </div>
              <div>
                <Label>Key</Label>
                <Input
                  data-testid="input-output-key"
                  value={formData.outputKey}
                  onChange={(e) => setFormData({ ...formData, outputKey: e.target.value })}
                  placeholder="e.g., m3u8, ts, rtmp"
                />
              </div>
              <div>
                <Label>Extension</Label>
                <Input
                  data-testid="input-output-ext"
                  value={formData.outputExt}
                  onChange={(e) => setFormData({ ...formData, outputExt: e.target.value })}
                  placeholder="e.g., m3u8, ts (leave empty for RTMP)"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  data-testid="switch-output-enabled"
                />
                <Label htmlFor="enabled">Enabled</Label>
              </div>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="w-full" data-testid="button-save-output">
                <Save className="h-4 w-4 mr-2" />
                {editingOutput ? "Update" : "Create"} Output Type
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Output Types ({outputs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Extension</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outputs.map((output) => (
                <TableRow key={output.id} data-testid={`output-row-${output.id}`}>
                  <TableCell className="font-medium">{output.outputName}</TableCell>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded">{output.outputKey}</code>
                  </TableCell>
                  <TableCell>
                    {output.outputExt ? (
                      <code className="bg-muted px-2 py-1 rounded">.{output.outputExt}</code>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={output.enabled ? "default" : "secondary"}>
                      {output.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEdit(output)} data-testid={`button-edit-${output.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(output.id)} data-testid={`button-delete-${output.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {outputs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No output types defined. Add HLS, MPEGTS, or RTMP output types.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
