import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Plus, Trash2, Edit2, Loader2, DollarSign, Clock, Users, Package } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface ShopProduct {
  id: number;
  name: string;
  description: string | null;
  productType: string;
  durationDays: number | null;
  maxConnections: number | null;
  bouquetIds: number[];
  price: string;
  currency: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Bouquet {
  id: number;
  name: string;
}

export default function ShopProducts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [selectedBouquets, setSelectedBouquets] = useState<number[]>([]);

  const { data: products = [], isLoading } = useQuery<ShopProduct[]>({
    queryKey: ["/api/shop/products"],
  });

  const { data: bouquets = [] } = useQuery<Bouquet[]>({
    queryKey: ["/api/bouquets"],
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<ShopProduct>) => apiRequest("POST", "/api/shop/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/products"] });
      closeDialog();
      toast({ title: "Product created successfully" });
    },
    onError: () => toast({ title: "Failed to create product", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ShopProduct> }) =>
      apiRequest("PUT", `/api/shop/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/products"] });
      closeDialog();
      toast({ title: "Product updated successfully" });
    },
    onError: () => toast({ title: "Failed to update product", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/shop/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/products"] });
      toast({ title: "Product deleted" });
    },
    onError: () => toast({ title: "Failed to delete product", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      name: formData.get("name") as string,
      description: formData.get("description") as string || null,
      productType: formData.get("productType") as string,
      durationDays: parseInt(formData.get("durationDays") as string) || null,
      maxConnections: parseInt(formData.get("maxConnections") as string) || null,
      bouquetIds: selectedBouquets,
      price: formData.get("price") as string,
      currency: formData.get("currency") as string,
      enabled: formData.get("enabled") === "on",
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
    };

    if (editingProduct) {
      updateMutation.mutate({ id: editingProduct.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (product: ShopProduct) => {
    setEditingProduct(product);
    setSelectedBouquets(product.bouquetIds || []);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingProduct(null);
    setSelectedBouquets([]);
  };

  const openCreateDialog = () => {
    setEditingProduct(null);
    setSelectedBouquets([]);
    setDialogOpen(true);
  };

  const toggleBouquet = (id: number) => {
    setSelectedBouquets(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  if (isLoading) {
    return (
      <Layout title="Shop Products" subtitle="Manage subscription products">
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Shop Products"
      subtitle="Manage subscription products for the customer storefront"
    >
      <div className="space-y-6">
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog} data-testid="button-add-product">
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? "Edit Product" : "Create Product"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" name="name" required defaultValue={editingProduct?.name} placeholder="e.g., 30 Day Premium" data-testid="input-product-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    name="description"
                    className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background"
                    defaultValue={editingProduct?.description || ""}
                    placeholder="Product description for customers"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Product Type</Label>
                    <Select name="productType" defaultValue={editingProduct?.productType || "subscription"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subscription">Subscription</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                        <SelectItem value="upgrade">Upgrade</SelectItem>
                        <SelectItem value="credits">Credits</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="durationDays">Duration (days)</Label>
                    <Input id="durationDays" name="durationDays" type="number" min="1" defaultValue={editingProduct?.durationDays || 30} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">Price</Label>
                    <Input id="price" name="price" type="number" step="0.01" min="0" required defaultValue={editingProduct?.price || ""} placeholder="9.99" data-testid="input-price" />
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select name="currency" defaultValue={editingProduct?.currency || "USD"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="maxConnections">Max Connections</Label>
                    <Input id="maxConnections" name="maxConnections" type="number" min="1" defaultValue={editingProduct?.maxConnections || 1} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sortOrder">Sort Order</Label>
                    <Input id="sortOrder" name="sortOrder" type="number" defaultValue={editingProduct?.sortOrder || 0} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Included Bouquets</Label>
                  <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                    {bouquets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No bouquets available</p>
                    ) : (
                      bouquets.map((bouquet) => (
                        <div key={bouquet.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`bouquet-${bouquet.id}`}
                            checked={selectedBouquets.includes(bouquet.id)}
                            onChange={() => toggleBouquet(bouquet.id)}
                            className="rounded"
                          />
                          <label htmlFor={`bouquet-${bouquet.id}`} className="text-sm">{bouquet.name}</label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="enabled">Enabled</Label>
                  <Switch id="enabled" name="enabled" defaultChecked={editingProduct?.enabled ?? true} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingProduct ? "Update" : "Create"} Product
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {products.length === 0 ? (
          <Alert>
            <Package className="w-4 h-4" />
            <AlertDescription>No products yet. Create your first product to start selling subscriptions.</AlertDescription>
          </Alert>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <Card key={product.id} className={!product.enabled ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <Badge variant={product.enabled ? "default" : "secondary"}>
                      {product.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                  <CardDescription>{product.description || "No description"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-2xl font-bold">
                    <DollarSign className="w-5 h-5 text-primary" />
                    {product.price} {product.currency}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {product.durationDays} days
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {product.maxConnections} connection{product.maxConnections !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">{product.productType}</Badge>
                </CardContent>
                <CardFooter className="gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(product)} data-testid={`button-edit-product-${product.id}`}>
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(product.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-product-${product.id}`}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
