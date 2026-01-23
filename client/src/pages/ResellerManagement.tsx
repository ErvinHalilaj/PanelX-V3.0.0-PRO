import { useState } from 'react';
import {
  useResellers,
  useCreateReseller,
  useResellerStats,
  useAddCredits,
  useDeductCredits,
  useTransferCredits,
  useCreditPackages,
  usePurchasePackage,
  useResellerHierarchy,
} from '@/hooks/use-resellers';
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
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  CreditCard,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCcw,
  UserPlus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ResellerManagement() {
  const { toast } = useToast();
  const [selectedResellerId, setSelectedResellerId] = useState<number>(1); // Default to admin
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  // Form states
  const [newReseller, setNewReseller] = useState({
    username: '',
    email: '',
    password: '',
    initialCredits: 100,
    maxCredits: 10000,
  });
  const [creditAmount, setCreditAmount] = useState(0);
  const [creditReason, setCreditReason] = useState('');
  const [transferAmount, setTransferAmount] = useState(0);
  const [transferToResellerId, setTransferToResellerId] = useState<number>(0);

  // Fetch data
  const resellers = useResellers();
  const stats = useResellerStats(selectedResellerId);
  const hierarchy = useResellerHierarchy(selectedResellerId);
  const packages = useCreditPackages();

  // Mutations
  const createReseller = useCreateReseller();
  const addCredits = useAddCredits();
  const deductCredits = useDeductCredits();
  const transferCredits = useTransferCredits();
  const purchasePackage = usePurchasePackage();

  const handleCreateReseller = async () => {
    try {
      await createReseller.mutateAsync(newReseller);
      toast({ title: 'Success', description: 'Reseller created successfully' });
      setCreateDialogOpen(false);
      setNewReseller({
        username: '',
        email: '',
        password: '',
        initialCredits: 100,
        maxCredits: 10000,
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create reseller', variant: 'destructive' });
    }
  };

  const handleAddCredits = async () => {
    try {
      await addCredits.mutateAsync({
        id: selectedResellerId,
        amount: creditAmount,
        reason: creditReason || 'Manual credit addition',
      });
      toast({ title: 'Success', description: `Added ${creditAmount} credits` });
      setCreditDialogOpen(false);
      setCreditAmount(0);
      setCreditReason('');
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add credits', variant: 'destructive' });
    }
  };

  const handleDeductCredits = async () => {
    try {
      await deductCredits.mutateAsync({
        id: selectedResellerId,
        amount: creditAmount,
        reason: creditReason || 'Manual credit deduction',
      });
      toast({ title: 'Success', description: `Deducted ${creditAmount} credits` });
      setCreditDialogOpen(false);
      setCreditAmount(0);
      setCreditReason('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to deduct credits', variant: 'destructive' });
    }
  };

  const handleTransferCredits = async () => {
    try {
      await transferCredits.mutateAsync({
        fromResellerId: selectedResellerId,
        toResellerId: transferToResellerId,
        amount: transferAmount,
        reason: 'Credit transfer',
      });
      toast({ title: 'Success', description: `Transferred ${transferAmount} credits` });
      setTransferDialogOpen(false);
      setTransferAmount(0);
      setTransferToResellerId(0);
    } catch (error: any) {
      toast({ title: 'Error', description: error.response?.data?.message || 'Failed to transfer credits', variant: 'destructive' });
    }
  };

  const handlePurchasePackage = async (packageId: string) => {
    try {
      const paymentRef = `PAY_${Date.now()}`;
      await purchasePackage.mutateAsync({
        resellerId: selectedResellerId,
        packageId,
        paymentReference: paymentRef,
      });
      toast({ title: 'Success', description: 'Package purchased successfully' });
      setPackageDialogOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to purchase package', variant: 'destructive' });
    }
  };

  const selectedReseller = resellers.data?.find(r => r.id === selectedResellerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reseller Management</h1>
          <p className="text-muted-foreground">Manage reseller accounts, credits, and operations</p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="w-4 h-4 mr-2" />
              Create Reseller
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Reseller</DialogTitle>
              <DialogDescription>Add a new reseller account to the system</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  placeholder="reseller1"
                  value={newReseller.username}
                  onChange={(e) => setNewReseller({ ...newReseller, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="reseller@example.com"
                  value={newReseller.email}
                  onChange={(e) => setNewReseller({ ...newReseller, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={newReseller.password}
                  onChange={(e) => setNewReseller({ ...newReseller, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Initial Credits</Label>
                  <Input
                    type="number"
                    value={newReseller.initialCredits}
                    onChange={(e) => setNewReseller({ ...newReseller, initialCredits: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Credits</Label>
                  <Input
                    type="number"
                    value={newReseller.maxCredits}
                    onChange={(e) => setNewReseller({ ...newReseller, maxCredits: Number(e.target.value) })}
                  />
                </div>
              </div>
              <Button onClick={handleCreateReseller} className="w-full" disabled={!newReseller.username || !newReseller.password}>
                Create Reseller
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reseller Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Reseller</CardTitle>
          <CardDescription>Choose a reseller to manage</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedResellerId.toString()} onValueChange={(v) => setSelectedResellerId(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resellers.data?.map((reseller) => (
                <SelectItem key={reseller.id} value={reseller.id.toString()}>
                  {reseller.username} - {reseller.credits} credits
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="hierarchy">Hierarchy</TabsTrigger>
          <TabsTrigger value="packages">Packages</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-4">
          {stats.data && selectedReseller && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.data.creditsRemaining}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.data.creditsUsed} used / {selectedReseller.maxCredits} max
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.data.totalUsers}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.data.activeUsers} active
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Lines</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.data.totalLines}</div>
                    <p className="text-xs text-muted-foreground">
                      {stats.data.activeLines} active
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${stats.data.revenue}</div>
                    <p className="text-xs text-muted-foreground">Total revenue</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest transactions and operations</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.data.recentActivity.length > 0 ? (
                    <div className="space-y-3">
                      {stats.data.recentActivity.map((activity, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className={`w-2 h-2 rounded-full ${activity.type === 'credit_add' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <div className="flex-1">
                            <p className="font-medium">{activity.description}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(activity.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <Badge variant={activity.type === 'credit_add' ? 'default' : 'secondary'}>
                            {activity.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No recent activity</p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Credits Tab */}
        <TabsContent value="credits" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Add Credits */}
            <Dialog open={creditDialogOpen && creditAmount > 0} onOpenChange={(open) => {
              setCreditDialogOpen(open);
              if (!open) setCreditAmount(0);
            }}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpCircle className="w-5 h-5 text-green-500" />
                      Add Credits
                    </CardTitle>
                    <CardDescription>Increase reseller credit balance</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => setCreditDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Credits
                    </Button>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Credits</DialogTitle>
                  <DialogDescription>Add credits to {selectedReseller?.username}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={creditAmount || ''}
                      onChange={(e) => setCreditAmount(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Reason (optional)</Label>
                    <Input
                      placeholder="Manual credit addition"
                      value={creditReason}
                      onChange={(e) => setCreditReason(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleAddCredits} className="w-full" disabled={!creditAmount || creditAmount <= 0}>
                    Add {creditAmount} Credits
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Deduct Credits */}
            <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setCreditDialogOpen(true); setCreditAmount(-100); }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownCircle className="w-5 h-5 text-red-500" />
                  Deduct Credits
                </CardTitle>
                <CardDescription>Decrease reseller credit balance</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="w-full">
                  <ArrowDownCircle className="w-4 h-4 mr-2" />
                  Deduct Credits
                </Button>
              </CardContent>
            </Card>

            {/* Transfer Credits */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
              <DialogTrigger asChild>
                <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCcw className="w-5 h-5 text-blue-500" />
                      Transfer Credits
                    </CardTitle>
                    <CardDescription>Transfer credits to another reseller</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" className="w-full">
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Transfer Credits
                    </Button>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transfer Credits</DialogTitle>
                  <DialogDescription>Transfer credits from {selectedReseller?.username} to another reseller</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>To Reseller</Label>
                    <Select value={transferToResellerId.toString()} onValueChange={(v) => setTransferToResellerId(Number(v))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select reseller" />
                      </SelectTrigger>
                      <SelectContent>
                        {resellers.data?.filter(r => r.id !== selectedResellerId).map((reseller) => (
                          <SelectItem key={reseller.id} value={reseller.id.toString()}>
                            {reseller.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      placeholder="100"
                      value={transferAmount || ''}
                      onChange={(e) => setTransferAmount(Number(e.target.value))}
                    />
                  </div>
                  <Button onClick={handleTransferCredits} className="w-full" disabled={!transferAmount || !transferToResellerId || transferAmount <= 0}>
                    Transfer {transferAmount} Credits
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Current Balance */}
          {selectedReseller && (
            <Card>
              <CardHeader>
                <CardTitle>Current Balance</CardTitle>
                <CardDescription>Credit balance for {selectedReseller.username}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-3xl font-bold">{selectedReseller.credits} credits</p>
                    <p className="text-sm text-muted-foreground">
                      Maximum: {selectedReseller.maxCredits} credits
                    </p>
                  </div>
                  <CreditCard className="w-12 h-12 text-muted-foreground" />
                </div>
                <div className="mt-4">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${(selectedReseller.credits / selectedReseller.maxCredits) * 100}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Hierarchy Tab */}
        <TabsContent value="hierarchy" className="space-y-4">
          {hierarchy.data && (
            <div className="space-y-4">
              {/* Parent */}
              {hierarchy.data.parent && (
                <Card>
                  <CardHeader>
                    <CardTitle>Parent Reseller</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-semibold">{hierarchy.data.parent.username}</p>
                        <p className="text-sm text-muted-foreground">{hierarchy.data.parent.email}</p>
                      </div>
                      <Badge>{hierarchy.data.parent.credits} credits</Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Children */}
              <Card>
                <CardHeader>
                  <CardTitle>Sub-Resellers ({hierarchy.data.children.length})</CardTitle>
                  <CardDescription>Resellers created by {selectedReseller?.username}</CardDescription>
                </CardHeader>
                <CardContent>
                  {hierarchy.data.children.length > 0 ? (
                    <div className="space-y-2">
                      {hierarchy.data.children.map((child) => (
                        <div key={child.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-semibold">{child.username}</p>
                            <p className="text-sm text-muted-foreground">{child.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{child.credits} credits</Badge>
                            <Badge variant={child.status === 'active' ? 'default' : 'secondary'}>
                              {child.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">No sub-resellers yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Packages Tab */}
        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Credit Packages</CardTitle>
              <CardDescription>Purchase credit packages for {selectedReseller?.username}</CardDescription>
            </CardHeader>
            <CardContent>
              {packages.data && packages.data.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.data.map((pkg) => (
                    <Card key={pkg.id} className="border-2">
                      <CardHeader>
                        <CardTitle>{pkg.name}</CardTitle>
                        <CardDescription>{pkg.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div>
                            <p className="text-3xl font-bold">{pkg.credits}</p>
                            <p className="text-sm text-muted-foreground">credits</p>
                          </div>
                          <div>
                            <p className="text-2xl font-bold text-primary">${pkg.price}</p>
                            <p className="text-xs text-muted-foreground">
                              ${(pkg.price / pkg.credits).toFixed(3)} per credit
                            </p>
                          </div>
                          <Button onClick={() => handlePurchasePackage(pkg.id)} className="w-full">
                            Purchase Package
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No packages available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
