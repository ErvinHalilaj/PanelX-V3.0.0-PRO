import { useState } from 'react';
import {
  useBrandingConfig,
  useUpdateBrandingConfig,
  useThemes,
  useCustomPages,
  useCreateCustomPage,
  useUpdateCustomPage,
  useDeleteCustomPage,
} from '@/hooks/use-branding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Palette, Image, FileText, Settings, Eye, Edit, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Branding() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<number>(1);
  const [pageDialogOpen, setPageDialogOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  
  const [newPage, setNewPage] = useState({
    slug: '',
    title: '',
    content: '',
    published: false,
  });

  // Fetch data
  const brandingConfig = useBrandingConfig(selectedUserId);
  const themes = useThemes();
  const customPages = useCustomPages(selectedUserId);

  // Mutations
  const updateBranding = useUpdateBrandingConfig();
  const createCustomPage = useCreateCustomPage();
  const updateCustomPage = useUpdateCustomPage();
  const deleteCustomPage = useDeleteCustomPage();

  const handleUpdateBranding = async (updates: any) => {
    try {
      await updateBranding.mutateAsync({ userId: selectedUserId, updates });
      toast({ title: 'Success', description: 'Branding updated successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update branding', variant: 'destructive' });
    }
  };

  const handleCreatePage = async () => {
    try {
      await createCustomPage.mutateAsync({ ...newPage, userId: selectedUserId });
      toast({ title: 'Success', description: 'Custom page created' });
      setPageDialogOpen(false);
      setNewPage({ slug: '', title: '', content: '', published: false });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create page', variant: 'destructive' });
    }
  };

  const handleUpdatePage = async (id: string, updates: any) => {
    try {
      await updateCustomPage.mutateAsync({ id, updates });
      toast({ title: 'Success', description: 'Page updated' });
      setEditingPage(null);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update page', variant: 'destructive' });
    }
  };

  const handleDeletePage = async (id: string) => {
    try {
      await deleteCustomPage.mutateAsync({ id, userId: selectedUserId });
      toast({ title: 'Success', description: 'Page deleted' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete page', variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Palette className="h-8 w-8" />
            Branding & Customization
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize logos, colors, themes, and create custom pages
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
        <Label>User ID:</Label>
        <Input
          type="number"
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(Number(e.target.value))}
          className="max-w-xs"
        />
      </div>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          <TabsTrigger value="pages">Custom Pages</TabsTrigger>
          <TabsTrigger value="portal">Portal Settings</TabsTrigger>
        </TabsList>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Brand Identity</CardTitle>
              <CardDescription>Configure your company logo, colors, and visual identity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Company Name</Label>
                <Input
                  value={brandingConfig.data?.companyName || ''}
                  onChange={(e) => handleUpdateBranding({ companyName: e.target.value })}
                  placeholder="My Company"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={brandingConfig.data?.primaryColor || '#3b82f6'}
                      onChange={(e) => handleUpdateBranding({ primaryColor: e.target.value })}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      value={brandingConfig.data?.primaryColor || '#3b82f6'}
                      onChange={(e) => handleUpdateBranding({ primaryColor: e.target.value })}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div>
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={brandingConfig.data?.secondaryColor || '#6366f1'}
                      onChange={(e) => handleUpdateBranding({ secondaryColor: e.target.value })}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      value={brandingConfig.data?.secondaryColor || '#6366f1'}
                      onChange={(e) => handleUpdateBranding({ secondaryColor: e.target.value })}
                      placeholder="#6366f1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={brandingConfig.data?.accentColor || '#8b5cf6'}
                      onChange={(e) => handleUpdateBranding({ accentColor: e.target.value })}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      value={brandingConfig.data?.accentColor || '#8b5cf6'}
                      onChange={(e) => handleUpdateBranding({ accentColor: e.target.value })}
                      placeholder="#8b5cf6"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Logo URL</Label>
                <Input
                  value={brandingConfig.data?.logo || ''}
                  onChange={(e) => handleUpdateBranding({ logo: e.target.value })}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div>
                <Label>Favicon URL</Label>
                <Input
                  value={brandingConfig.data?.favicon || ''}
                  onChange={(e) => handleUpdateBranding({ favicon: e.target.value })}
                  placeholder="https://example.com/favicon.ico"
                />
              </div>

              <div>
                <Label>Login Background Image</Label>
                <Input
                  value={brandingConfig.data?.loginBackgroundImage || ''}
                  onChange={(e) => handleUpdateBranding({ loginBackgroundImage: e.target.value })}
                  placeholder="https://example.com/background.jpg"
                />
              </div>

              <div>
                <Label>Custom CSS</Label>
                <textarea
                  value={brandingConfig.data?.customCss || ''}
                  onChange={(e) => handleUpdateBranding({ customCss: e.target.value })}
                  placeholder=".custom-class { color: red; }"
                  className="w-full h-32 p-2 border rounded"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Themes Tab */}
        <TabsContent value="themes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Themes</CardTitle>
              <CardDescription>Choose from pre-built themes or create your own</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {themes.data?.map((theme) => (
                  <div key={theme.id} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{theme.name}</h3>
                      {theme.isDark && <Badge>Dark</Badge>}
                    </div>
                    <div className="flex gap-2">
                      <div
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: theme.colors.primary }}
                        title="Primary"
                      />
                      <div
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: theme.colors.secondary }}
                        title="Secondary"
                      />
                      <div
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: theme.colors.accent }}
                        title="Accent"
                      />
                    </div>
                    <Button size="sm" className="w-full">Apply</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Pages Tab */}
        <TabsContent value="pages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom Pages</CardTitle>
              <CardDescription>Create custom pages for your portal (Terms, Privacy, etc.)</CardDescription>
              <Dialog open={pageDialogOpen} onOpenChange={setPageDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    New Page
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Custom Page</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Slug</Label>
                      <Input
                        value={newPage.slug}
                        onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                        placeholder="terms-of-service"
                      />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input
                        value={newPage.title}
                        onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                        placeholder="Terms of Service"
                      />
                    </div>
                    <div>
                      <Label>Content (Markdown supported)</Label>
                      <textarea
                        value={newPage.content}
                        onChange={(e) => setNewPage({ ...newPage, content: e.target.value })}
                        placeholder="# Terms of Service&#10;&#10;Your content here..."
                        className="w-full h-64 p-2 border rounded font-mono text-sm"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={newPage.published}
                          onCheckedChange={(checked) => setNewPage({ ...newPage, published: checked })}
                        />
                        <Label>Published</Label>
                      </div>
                      <Button onClick={handleCreatePage}>Create Page</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {customPages.data?.map((page) => (
                  <div key={page.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="font-medium">{page.title}</span>
                        <Badge variant={page.published ? 'default' : 'secondary'}>
                          {page.published ? 'Published' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        /{page.slug}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated: {new Date(page.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Delete this page?')) {
                            handleDeletePage(page.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!customPages.data?.length && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No custom pages yet. Create one to get started.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Portal Settings Tab */}
        <TabsContent value="portal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Portal Settings</CardTitle>
              <CardDescription>Configure portal behavior and branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show "Powered By"</Label>
                  <p className="text-sm text-muted-foreground">
                    Display "Powered by PanelX" in the footer
                  </p>
                </div>
                <Switch
                  checked={brandingConfig.data?.portalSettings?.showPoweredBy ?? true}
                  onCheckedChange={(checked) =>
                    handleUpdateBranding({
                      portalSettings: {
                        ...brandingConfig.data?.portalSettings,
                        showPoweredBy: checked,
                      },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Hide Admin Branding</Label>
                  <p className="text-sm text-muted-foreground">
                    Remove all references to admin panel branding
                  </p>
                </div>
                <Switch
                  checked={brandingConfig.data?.portalSettings?.hideAdminBranding ?? false}
                  onCheckedChange={(checked) =>
                    handleUpdateBranding({
                      portalSettings: {
                        ...brandingConfig.data?.portalSettings,
                        hideAdminBranding: checked,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label>Custom Domain</Label>
                <Input
                  value={brandingConfig.data?.portalSettings?.customDomain || ''}
                  onChange={(e) =>
                    handleUpdateBranding({
                      portalSettings: {
                        ...brandingConfig.data?.portalSettings,
                        customDomain: e.target.value,
                      },
                    })
                  }
                  placeholder="portal.example.com"
                />
              </div>

              <div>
                <Label>Custom Footer Text</Label>
                <Input
                  value={brandingConfig.data?.portalSettings?.customFooterText || ''}
                  onChange={(e) =>
                    handleUpdateBranding({
                      portalSettings: {
                        ...brandingConfig.data?.portalSettings,
                        customFooterText: e.target.value,
                      },
                    })
                  }
                  placeholder="© 2024 Your Company. All rights reserved."
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-4">Player Features</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Custom Player Logo</Label>
                    <Switch
                      checked={brandingConfig.data?.features?.customPlayerLogo ?? false}
                      onCheckedChange={(checked) =>
                        handleUpdateBranding({
                          features: {
                            ...brandingConfig.data?.features,
                            customPlayerLogo: checked,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Custom Splash Screen</Label>
                    <Switch
                      checked={brandingConfig.data?.features?.customSplashScreen ?? false}
                      onCheckedChange={(checked) =>
                        handleUpdateBranding({
                          features: {
                            ...brandingConfig.data?.features,
                            customSplashScreen: checked,
                          },
                        })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Custom Loading Screen</Label>
                    <Switch
                      checked={brandingConfig.data?.features?.customLoadingScreen ?? false}
                      onCheckedChange={(checked) =>
                        handleUpdateBranding({
                          features: {
                            ...brandingConfig.data?.features,
                            customLoadingScreen: checked,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
