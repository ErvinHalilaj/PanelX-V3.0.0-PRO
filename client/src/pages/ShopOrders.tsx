import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CreditCard, Loader2, CheckCircle, XCircle, Clock, AlertCircle, Plus, Settings, Trash2, Eye, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";

interface ShopOrder {
  id: number;
  orderNumber: string;
  customerEmail: string;
  customerName: string | null;
  productId: number;
  quantity: number;
  totalAmount: string;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  lineId: number | null;
  notes: string | null;
  createdAt: string;
  paidAt: string | null;
  fulfilledAt: string | null;
}

interface PaymentMethod {
  id: number;
  name: string;
  methodType: string;
  enabled: boolean;
  config: Record<string, unknown>;
  instructions: string | null;
  sortOrder: number;
}

interface ShopProduct {
  id: number;
  name: string;
  price: string;
  currency: string;
}

export default function ShopOrders() {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
  const [viewingOrder, setViewingOrder] = useState<ShopOrder | null>(null);

  const { data: orders = [], isLoading: ordersLoading } = useQuery<ShopOrder[]>({
    queryKey: ["/api/shop/orders"],
  });

  const { data: paymentMethods = [], isLoading: paymentsLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/shop/admin/payment-methods"],
  });

  const { data: products = [] } = useQuery<ShopProduct[]>({
    queryKey: ["/api/shop/products"],
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status: string } }) =>
      apiRequest("PUT", `/api/shop/orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/orders"] });
      toast({ title: "Order updated" });
    },
    onError: () => toast({ title: "Failed to update order", variant: "destructive" }),
  });

  const fulfillOrderMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/shop/orders/${id}/fulfill`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/orders"] });
      setViewingOrder(null);
      toast({ title: "Order fulfilled! Line created successfully." });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to fulfill order", variant: "destructive" }),
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: Partial<PaymentMethod>) => apiRequest("POST", "/api/shop/payment-methods", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/admin/payment-methods"] });
      setPaymentDialogOpen(false);
      toast({ title: "Payment method created" });
    },
    onError: () => toast({ title: "Failed to create payment method", variant: "destructive" }),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PaymentMethod> }) =>
      apiRequest("PUT", `/api/shop/payment-methods/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/admin/payment-methods"] });
      setPaymentDialogOpen(false);
      setEditingPayment(null);
      toast({ title: "Payment method updated" });
    },
    onError: () => toast({ title: "Failed to update payment method", variant: "destructive" }),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/shop/payment-methods/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shop/admin/payment-methods"] });
      toast({ title: "Payment method deleted" });
    },
    onError: () => toast({ title: "Failed to delete payment method", variant: "destructive" }),
  });

  const handlePaymentSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get("name") as string,
      methodType: formData.get("methodType") as string,
      enabled: formData.get("enabled") === "on",
      instructions: formData.get("instructions") as string || null,
      sortOrder: parseInt(formData.get("sortOrder") as string) || 0,
      config: {},
    };

    if (editingPayment) {
      updatePaymentMutation.mutate({ id: editingPayment.id, data });
    } else {
      createPaymentMutation.mutate(data);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />Paid</Badge>;
      case "fulfilled":
        return <Badge className="bg-blue-600"><CheckCircle className="w-3 h-3 mr-1" />Fulfilled</Badge>;
      case "cancelled":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>;
      case "refunded":
        return <Badge variant="secondary"><AlertCircle className="w-3 h-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getProductName = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product?.name || `Product #${productId}`;
  };

  const openPaymentDialog = (method?: PaymentMethod) => {
    setEditingPayment(method || null);
    setPaymentDialogOpen(true);
  };

  return (
    <Layout
      title="Shop Orders"
      subtitle="Manage customer orders and payment methods"
    >
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payment Methods</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          {ordersLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : orders.length === 0 ? (
            <Alert>
              <Receipt className="w-4 h-4" />
              <AlertDescription>No orders yet. Orders will appear here when customers make purchases.</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary/30">
                  <tr>
                    <th className="px-4 py-3 text-left">Order #</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Product</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-t border-secondary/30">
                      <td className="px-4 py-3 font-mono text-xs">{order.orderNumber}</td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{order.customerName || "Guest"}</p>
                          <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">{getProductName(order.productId)}</td>
                      <td className="px-4 py-3 font-medium">{order.totalAmount} {order.currency}</td>
                      <td className="px-4 py-3">{getStatusBadge(order.status)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewingOrder(order)} data-testid={`button-view-order-${order.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {order.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateOrderMutation.mutate({ id: order.id, data: { status: "paid" } })}
                              data-testid={`button-mark-paid-${order.id}`}
                            >
                              Mark Paid
                            </Button>
                          )}
                          {order.status === "paid" && !order.lineId && (
                            <Button
                              size="sm"
                              onClick={() => fulfillOrderMutation.mutate(order.id)}
                              disabled={fulfillOrderMutation.isPending}
                              data-testid={`button-fulfill-${order.id}`}
                            >
                              Fulfill
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Dialog open={!!viewingOrder} onOpenChange={() => setViewingOrder(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Order Details</DialogTitle>
                <DialogDescription>Order #{viewingOrder?.orderNumber}</DialogDescription>
              </DialogHeader>
              {viewingOrder && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium">{viewingOrder.customerName || "Guest"}</p>
                      <p>{viewingOrder.customerEmail}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Product</p>
                      <p className="font-medium">{getProductName(viewingOrder.productId)}</p>
                      <p>Qty: {viewingOrder.quantity}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Amount</p>
                      <p className="font-medium text-lg">{viewingOrder.totalAmount} {viewingOrder.currency}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      {getStatusBadge(viewingOrder.status)}
                    </div>
                    {viewingOrder.paymentMethod && (
                      <div>
                        <p className="text-muted-foreground">Payment Method</p>
                        <p>{viewingOrder.paymentMethod}</p>
                      </div>
                    )}
                    {viewingOrder.paymentReference && (
                      <div>
                        <p className="text-muted-foreground">Reference</p>
                        <p className="font-mono text-xs">{viewingOrder.paymentReference}</p>
                      </div>
                    )}
                    {viewingOrder.lineId && (
                      <div>
                        <p className="text-muted-foreground">Line ID</p>
                        <p className="font-mono">{viewingOrder.lineId}</p>
                      </div>
                    )}
                  </div>
                  {viewingOrder.notes && (
                    <div>
                      <p className="text-muted-foreground text-sm">Notes</p>
                      <p className="text-sm">{viewingOrder.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    {viewingOrder.status === "pending" && (
                      <Button onClick={() => { updateOrderMutation.mutate({ id: viewingOrder.id, data: { status: "paid" } }); setViewingOrder(null); }}>
                        Mark as Paid
                      </Button>
                    )}
                    {viewingOrder.status === "paid" && !viewingOrder.lineId && (
                      <Button onClick={() => fulfillOrderMutation.mutate(viewingOrder.id)} disabled={fulfillOrderMutation.isPending}>
                        {fulfillOrderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Fulfill Order
                      </Button>
                    )}
                    {viewingOrder.status === "pending" && (
                      <Button variant="destructive" onClick={() => { updateOrderMutation.mutate({ id: viewingOrder.id, data: { status: "cancelled" } }); setViewingOrder(null); }}>
                        Cancel Order
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openPaymentDialog()} data-testid="button-add-payment">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Payment Method
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPayment ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input id="name" name="name" required defaultValue={editingPayment?.name} placeholder="e.g., Credit Card" data-testid="input-payment-name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Type</Label>
                    <Select name="methodType" defaultValue={editingPayment?.methodType || "stripe"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stripe">Stripe</SelectItem>
                        <SelectItem value="paypal">PayPal</SelectItem>
                        <SelectItem value="crypto">Cryptocurrency</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instructions">Customer Instructions</Label>
                    <textarea
                      id="instructions"
                      name="instructions"
                      className="w-full h-20 px-3 py-2 text-sm rounded-md border border-input bg-background"
                      defaultValue={editingPayment?.instructions || ""}
                      placeholder="Instructions shown to customers during checkout"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sortOrder">Sort Order</Label>
                      <Input id="sortOrder" name="sortOrder" type="number" defaultValue={editingPayment?.sortOrder || 0} />
                    </div>
                    <div className="flex items-center justify-between pt-6">
                      <Label htmlFor="enabled">Enabled</Label>
                      <Switch id="enabled" name="enabled" defaultChecked={editingPayment?.enabled ?? true} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createPaymentMutation.isPending || updatePaymentMutation.isPending}>
                      {(createPaymentMutation.isPending || updatePaymentMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {editingPayment ? "Update" : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {paymentsLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : paymentMethods.length === 0 ? (
            <Alert>
              <CreditCard className="w-4 h-4" />
              <AlertDescription>No payment methods configured. Add at least one payment method to accept orders.</AlertDescription>
            </Alert>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentMethods.map((method) => (
                <Card key={method.id} className={!method.enabled ? "opacity-60" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CreditCard className="w-4 h-4" />
                        {method.name}
                      </CardTitle>
                      <Badge variant={method.enabled ? "default" : "secondary"}>
                        {method.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                    <CardDescription className="capitalize">{method.methodType.replace("_", " ")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {method.instructions && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{method.instructions}</p>
                    )}
                  </CardContent>
                  <div className="px-6 pb-4 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openPaymentDialog(method)} data-testid={`button-edit-payment-${method.id}`}>
                      <Settings className="w-4 h-4 mr-1" />
                      Configure
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deletePaymentMutation.mutate(method.id)}
                      disabled={deletePaymentMutation.isPending}
                      data-testid={`button-delete-payment-${method.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Layout>
  );
}
