import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Search, TrendingUp, TrendingDown, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import type { CreditTransaction, User } from "@shared/schema";

export default function CreditTransactions() {
  const [searchTerm, setSearchTerm] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");

  const { data: transactions = [], isLoading } = useQuery<CreditTransaction[]>({
    queryKey: ["/api/credit-transactions"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const getUserName = (userId: number | null) => {
    if (!userId) return "System";
    const user = users.find(u => u.id === userId);
    return user?.username || `User #${userId}`;
  };

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserName(tx.userId).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesReason = reasonFilter === "all" || tx.reason === reasonFilter;
    
    return matchesSearch && matchesReason;
  });

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case "line_create":
        return <Badge className="bg-blue-600 text-white">Line Create</Badge>;
      case "line_extend":
        return <Badge className="bg-purple-600 text-white">Line Extend</Badge>;
      case "admin_add":
        return <Badge className="bg-green-600 text-white">Admin Add</Badge>;
      case "admin_remove":
        return <Badge variant="destructive">Admin Remove</Badge>;
      default:
        return <Badge variant="secondary">{reason}</Badge>;
    }
  };

  const totalAdded = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
  const totalSpent = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const uniqueReasons = Array.from(new Set(transactions.map(t => t.reason)));

  return (
    <Layout 
      title="Credit Transactions"
      actions={
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-[250px]"
              data-testid="input-search-transactions"
            />
          </div>
          <Select value={reasonFilter} onValueChange={setReasonFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-reason-filter">
              <SelectValue placeholder="Filter by reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reasons</SelectItem>
              {uniqueReasons.map(reason => (
                <SelectItem key={reason} value={reason}>{reason}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/10">
              <CreditCard className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Transactions</p>
              <p className="text-lg font-bold">{transactions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-500/10">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Credits Added</p>
              <p className="text-lg font-bold text-green-500">+{totalAdded}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10">
              <TrendingDown className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Credits Spent</p>
              <p className="text-lg font-bold text-red-500">-{totalSpent}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-white/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/10">
              <DollarSign className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Change</p>
              <p className={`text-lg font-bold ${totalAdded - totalSpent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {totalAdded - totalSpent >= 0 ? '+' : ''}{totalAdded - totalSpent}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-white/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading transactions...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No transactions found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {tx.createdAt ? format(new Date(tx.createdAt), "MMM dd, HH:mm") : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{getUserName(tx.userId)}</TableCell>
                    <TableCell>
                      <span className={`font-bold ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : ''}{tx.amount}
                      </span>
                    </TableCell>
                    <TableCell>{getReasonBadge(tx.reason)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {tx.referenceId ? `#${tx.referenceId}` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
