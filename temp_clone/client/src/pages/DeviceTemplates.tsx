import { useQuery, useMutation } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Smartphone, Plus, Trash2, Copy, Edit2 } from "lucide-react";
import { useState } from "react";
import type { DeviceTemplate } from "@shared/schema";

const defaultFormData = {
  deviceKey: "",
  deviceName: "",
  headerTemplate: "#EXTM3U",
  lineTemplate: '#EXTINF:-1 tvg-id="{epg_channel_id}" tvg-name="{stream_name}" tvg-logo="{stream_icon}" group-title="{category_name}",{stream_name}\n{server}/live/{username}/{password}/{stream_id}.{extension}',
  footerTemplate: "",
  fileExtension: "m3u",
  defaultOutput: "ts",
};

export default function DeviceTemplates() {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DeviceTemplate | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  const { data: templates = [], isLoading } = useQuery<DeviceTemplate[]>({
    queryKey: ["/api/device-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiRequest("POST", "/api/device-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-templates"] });
      setIsOpen(false);
      setFormData(defaultFormData);
      toast({ title: "Device template created successfully" });
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof formData }) => apiRequest("PUT", `/api/device-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-templates"] });
      setIsOpen(false);
      setEditingTemplate(null);
      setFormData(defaultFormData);
      toast({ title: "Template updated successfully" });
    },
    onError: () => toast({ title: "Failed to update template", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/device-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/device-templates"] });
      toast({ title: "Template deleted" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (template: DeviceTemplate) => {
    setEditingTemplate(template);
    setFormData({
      deviceKey: template.deviceKey,
      deviceName: template.deviceName,
      headerTemplate: template.headerTemplate || "#EXTM3U",
      lineTemplate: template.lineTemplate || "",
      footerTemplate: template.footerTemplate || "",
      fileExtension: template.fileExtension || "m3u",
      defaultOutput: template.defaultOutput || "ts",
    });
    setIsOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setEditingTemplate(null);
      setFormData(defaultFormData);
    }
  };

  const copyPlaylistUrl = (template: DeviceTemplate) => {
    const url = `${window.location.origin}/playlist/${template.deviceKey}/USERNAME/PASSWORD`;
    navigator.clipboard.writeText(url);
    toast({ title: "Playlist URL copied to clipboard" });
  };

  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 ml-64 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Smartphone className="w-8 h-8 text-primary" />
              Device Templates
            </h1>
            <p className="text-muted-foreground mt-1">Customize playlist formats for different devices</p>
          </div>
          <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-template">
                <Plus className="w-4 h-4" /> Add Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingTemplate ? "Edit Device Template" : "Add Device Template"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Device Key</Label>
                    <Input value={formData.deviceKey} onChange={(e) => setFormData({ ...formData, deviceKey: e.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="my_device" required data-testid="input-device-key" />
                    <p className="text-xs text-muted-foreground">Lowercase, no spaces</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Device Name</Label>
                    <Input value={formData.deviceName} onChange={(e) => setFormData({ ...formData, deviceName: e.target.value })} placeholder="My IPTV Device" required data-testid="input-device-name" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Header Template</Label>
                  <Textarea value={formData.headerTemplate} onChange={(e) => setFormData({ ...formData, headerTemplate: e.target.value })} rows={2} data-testid="input-header" />
                </div>
                <div className="space-y-2">
                  <Label>Line Template</Label>
                  <Textarea value={formData.lineTemplate} onChange={(e) => setFormData({ ...formData, lineTemplate: e.target.value })} rows={3} data-testid="input-line-template" />
                  <p className="text-xs text-muted-foreground">
                    Variables: {'{stream_id}'}, {'{stream_name}'}, {'{stream_icon}'}, {'{epg_channel_id}'}, {'{category_name}'}, {'{username}'}, {'{password}'}, {'{server}'}, {'{extension}'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>File Extension</Label>
                    <Input value={formData.fileExtension} onChange={(e) => setFormData({ ...formData, fileExtension: e.target.value })} placeholder="m3u" data-testid="input-file-extension" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Output</Label>
                    <Input value={formData.defaultOutput} onChange={(e) => setFormData({ ...formData, defaultOutput: e.target.value })} placeholder="ts" data-testid="input-default-output" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-template">
                  {(createMutation.isPending || updateMutation.isPending) ? "Saving..." : (editingTemplate ? "Save Changes" : "Create Template")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardHeader>
            <CardTitle>Device Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10">Loading...</div>
            ) : templates.length === 0 ? (
              <div className="text-center py-10">
                <Smartphone className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No device templates configured</p>
                <p className="text-sm text-muted-foreground mt-1">Add templates for different IPTV devices</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Extension</TableHead>
                    <TableHead>Output</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                      <TableCell className="font-medium">{template.deviceName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">{template.deviceKey}</Badge>
                      </TableCell>
                      <TableCell>.{template.fileExtension}</TableCell>
                      <TableCell className="text-muted-foreground">{template.defaultOutput}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(template)} data-testid={`button-edit-template-${template.id}`}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => copyPlaylistUrl(template)} data-testid={`button-copy-url-${template.id}`}>
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(template.id)} className="text-destructive" data-testid={`button-delete-template-${template.id}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
