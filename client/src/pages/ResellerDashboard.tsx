import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, addDays } from "date-fns";
import {
  Users,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  Clock,
  CheckCircle,
  AlertCircle,
  Key,
  Copy,
  RefreshCw,
  TrendingUp,
  Calendar,
  Activity,
  MessageSquare
} from "lucide-react";
import type { Line, Package, Ticket, InsertLine, InsertTicket } from "@shared/schema";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";

function StatCard({ title, value, icon: Icon, trend, trendLabel }: { 
  title: string; 
  value: string | number; 
  icon: React.ComponentType<{ className?: string }>;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {trend !== undefined && (
              <p className={`text-xs mt-1 ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                {trend >= 0 ? "+" : ""}{trend}% {trendLabel}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateLineDialog({ packages, resellerId }: { packages: Package[]; resellerId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [maxConnections, setMaxConnections] = useState(1);

  const createLine = useMutation({
    mutationFn: async (data: Partial<InsertLine>) => {
      const response = await apiRequest("POST", "/api/lines", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({ title: "Success", description: "Line created successfully" });
      setIsOpen(false);
      setUsername("");
      setPassword("");
      setSelectedPackage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create line", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pkg = packages.find(p => p.id.toString() === selectedPackage);
    if (!pkg) {
      toast({ title: "Error", description: "Please select a package", variant: "destructive" });
      return;
    }

    const expDate = addDays(new Date(), pkg.durationDays);
    createLine.mutate({
      username,
      password,
      memberId: resellerId,
      packageId: pkg.id,
      expDate: expDate,
      maxConnections,
      bouquets: pkg.bouquets || [],
      enabled: true,
      isTrial: pkg.isTrial || false,
    });
  };

  const generateCredentials = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const user = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    const pass = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setUsername(user);
    setPassword(pass);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-create-line">
          <Plus className="w-4 h-4" /> Create Line
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Line</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                required
                data-testid="input-line-username"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                data-testid="input-line-password"
              />
            </div>
            <Button type="button" variant="outline" className="mt-8" onClick={generateCredentials}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Package</Label>
            <Select value={selectedPackage} onValueChange={setSelectedPackage}>
              <SelectTrigger data-testid="select-package">
                <SelectValue placeholder="Select package" />
              </SelectTrigger>
              <SelectContent>
                {packages.filter(p => p.enabled).map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id.toString()}>
                    {pkg.packageName} - {pkg.durationDays} days ({pkg.credits} credits)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxConnections">Max Connections</Label>
            <Input
              id="maxConnections"
              type="number"
              min={1}
              max={10}
              value={maxConnections}
              onChange={(e) => setMaxConnections(parseInt(e.target.value))}
              data-testid="input-max-connections"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createLine.isPending} className="w-full" data-testid="button-submit-line">
              {createLine.isPending ? "Creating..." : "Create Line"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LineRow({ line, onRenew, onDelete }: { line: Line; onRenew: (id: number) => void; onDelete: (id: number) => void }) {
  const isExpired = line.expDate ? new Date(line.expDate) < new Date() : false;
  const expiresIn = line.expDate ? formatDistanceToNow(new Date(line.expDate), { addSuffix: true }) : "Never";

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Username: ${line.username}\nPassword: ${line.password}`);
    toast({ title: "Copied", description: "Credentials copied to clipboard" });
  };

  return (
    <Card className="mb-2">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${isExpired ? "bg-red-500" : line.enabled ? "bg-green-500" : "bg-gray-500"}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{line.username}</span>
                <Button variant="ghost" size="icon" onClick={copyCredentials} className="h-6 w-6">
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {isExpired ? "Expired" : `Expires ${expiresIn}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isExpired ? "destructive" : line.enabled ? "default" : "secondary"}>
              {isExpired ? "Expired" : line.enabled ? "Active" : "Disabled"}
            </Badge>
            {line.isTrial && <Badge variant="outline">Trial</Badge>}
            <span className="text-sm text-muted-foreground">{line.maxConnections} conn</span>
            
            <Button variant="outline" size="sm" onClick={() => onRenew(line.id)} data-testid={`button-renew-line-${line.id}`}>
              <RefreshCw className="w-4 h-4 mr-1" /> Renew
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(line.id)} className="text-red-400" data-testid={`button-delete-line-${line.id}`}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateTicketDialog({ resellerId }: { resellerId: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");

  const createTicket = useMutation({
    mutationFn: async (data: Partial<InsertTicket>) => {
      const response = await apiRequest("POST", "/api/tickets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({ title: "Success", description: "Ticket submitted" });
      setIsOpen(false);
      setSubject("");
      setMessage("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit ticket", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTicket.mutate({
      subject,
      category,
      priority: "normal",
      status: "open",
      userId: resellerId,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-create-ticket">
          <MessageSquare className="w-4 h-4" /> New Ticket
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit Support Ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description"
              required
              data-testid="input-ticket-subject"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="technical">Technical</SelectItem>
                <SelectItem value="account">Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your issue..."
              rows={4}
              data-testid="input-ticket-message"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createTicket.isPending} className="w-full">
              {createTicket.isPending ? "Submitting..." : "Submit Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ResellerDashboard() {
  const resellerId = 1;

  const { data: lines = [] } = useQuery<Line[]>({
    queryKey: ["/api/lines", { ownerId: resellerId }],
    queryFn: async () => {
      const res = await fetch(`/api/lines?ownerId=${resellerId}`);
      return res.json();
    }
  });

  const { data: packages = [] } = useQuery<Package[]>({
    queryKey: ["/api/packages"]
  });

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets", { userId: resellerId }],
    queryFn: async () => {
      const res = await fetch(`/api/tickets?userId=${resellerId}`);
      return res.json();
    }
  });

  const deleteLine = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/lines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lines"] });
      toast({ title: "Deleted", description: "Line removed" });
    }
  });

  const activeLines = lines.filter(l => l.enabled && (!l.expDate || new Date(l.expDate) > new Date())).length;
  const expiredLines = lines.filter(l => l.expDate && new Date(l.expDate) < new Date()).length;
  const openTickets = tickets.filter(t => t.status === "open" || t.status === "pending").length;

  const chartData = [
    { name: "Week 1", lines: 5, credits: 50 },
    { name: "Week 2", lines: 8, credits: 80 },
    { name: "Week 3", lines: 12, credits: 120 },
    { name: "Week 4", lines: 15, credits: 150 },
  ];

  return (
    <Layout 
      title="Reseller Dashboard"
      actions={
        <div className="flex gap-2">
          <CreateTicketDialog resellerId={resellerId} />
          <CreateLineDialog packages={packages} resellerId={resellerId} />
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Lines" 
            value={lines.length} 
            icon={Users}
            trend={12}
            trendLabel="this month"
          />
          <StatCard 
            title="Active Lines" 
            value={activeLines} 
            icon={CheckCircle}
          />
          <StatCard 
            title="Expired Lines" 
            value={expiredLines} 
            icon={AlertCircle}
          />
          <StatCard 
            title="Available Credits" 
            value="500" 
            icon={CreditCard}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" /> Activity Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorLines" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="lines" 
                      stroke="hsl(var(--primary))" 
                      fillOpacity={1} 
                      fill="url(#colorLines)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> Recent Tickets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tickets yet</p>
              ) : (
                tickets.slice(0, 3).map((ticket) => (
                  <div key={ticket.id} className="p-3 rounded-lg bg-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{ticket.subject}</span>
                      <Badge variant={ticket.status === "open" ? "default" : ticket.status === "pending" ? "secondary" : "outline"}>
                        {ticket.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ticket.createdAt ? format(new Date(ticket.createdAt), "PPp") : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" /> My Lines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lines.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No lines created yet</p>
                <p className="text-sm text-muted-foreground">Click "Create Line" to add your first subscription</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lines.map((line) => (
                  <LineRow 
                    key={line.id} 
                    line={line} 
                    onRenew={(id) => toast({ title: "Renew", description: `Renewing line ${id}` })}
                    onDelete={(id) => {
                      if (confirm("Delete this line?")) {
                        deleteLine.mutate(id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
