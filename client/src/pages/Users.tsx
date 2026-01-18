import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useUsers, useCreateUser, useDeleteUser, useAddCredits, useUpdateUser } from "@/hooks/use-users";
import { Plus, Trash2, CreditCard, UserCog, Shield, ShieldCheck, MoreVertical, Edit2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { insertUserSchema, type InsertUser } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function UserForm({ onSubmit, isLoading }: { onSubmit: (data: InsertUser) => void; isLoading: boolean }) {
  const form = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      role: "reseller",
      credits: 0,
      enabled: true,
    },
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" {...form.register("username")} placeholder="reseller1" data-testid="input-username" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" {...form.register("password")} placeholder="Password" data-testid="input-password" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select defaultValue="reseller" onValueChange={(v) => form.setValue("role", v)}>
            <SelectTrigger data-testid="select-role">
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits">Initial Credits</Label>
          <Input id="credits" type="number" {...form.register("credits", { valueAsNumber: true })} defaultValue={0} data-testid="input-credits" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Input {...form.register("notes")} placeholder="Optional notes..." data-testid="input-notes" />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-submit">
          {isLoading ? "Creating..." : "Create User"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AddCreditsDialog({ user, onClose }: { user: any; onClose: () => void }) {
  const [amount, setAmount] = useState(10);
  const addCredits = useAddCredits();

  const handleSubmit = async () => {
    try {
      await addCredits.mutateAsync({ id: user.id, amount, reason: "admin_add" });
      toast({ title: "Success", description: `Added ${amount} credits to ${user.username}` });
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to add credits", variant: "destructive" });
    }
  };

  return (
    <DialogContent className="sm:max-w-[400px] bg-card border-white/10 text-white">
      <DialogHeader>
        <DialogTitle>Add Credits to {user.username}</DialogTitle>
      </DialogHeader>
      <div className="py-4 space-y-4">
        <div className="space-y-2">
          <Label>Current Credits: {user.credits || 0}</Label>
          <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} data-testid="input-add-credits" />
        </div>
        <div className="flex gap-2">
          {[10, 50, 100, 500].map((n) => (
            <Button key={n} variant="outline" size="sm" onClick={() => setAmount(n)} data-testid={`button-quick-${n}`}>
              +{n}
            </Button>
          ))}
        </div>
      </div>
      <DialogFooter>
        <Button onClick={handleSubmit} disabled={addCredits.isPending} className="btn-primary" data-testid="button-add-credits">
          {addCredits.isPending ? "Adding..." : `Add ${amount} Credits`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function Users() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const deleteUser = useDeleteUser();

  const handleCreate = async (data: InsertUser) => {
    try {
      await createUser.mutateAsync(data);
      toast({ title: "Success", description: "User created successfully" });
      setIsCreateOpen(false);
    } catch {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this user permanently?")) {
      await deleteUser.mutateAsync(id);
      toast({ title: "Deleted", description: "User removed" });
    }
  };

  return (
    <Layout
      title="Manage Users"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="button-create-user">
              <Plus className="w-4 h-4" /> Create User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] bg-card border-white/10 text-white">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <UserForm onSubmit={handleCreate} isLoading={createUser.isPending} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="bg-card/40 border border-white/5 rounded-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading users...</div>
        ) : users?.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <UserCog className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-white">No users found</h3>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Credits</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users?.map((user) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors group" data-testid={`row-user-${user.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        {user.role === "admin" ? (
                          <ShieldCheck className="w-5 h-5 text-primary" />
                        ) : (
                          <Shield className="w-5 h-5 text-blue-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white" data-testid={`text-username-${user.id}`}>{user.username}</p>
                        <p className="text-xs text-muted-foreground">{user.notes || "No notes"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={user.role === "admin" ? "default" : "secondary"} data-testid={`badge-role-${user.id}`}>
                      {user.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <span className="font-medium text-white" data-testid={`text-credits-${user.id}`}>{user.credits || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.enabled !== false ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-500">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-500">Disabled</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Dialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-actions-${user.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-white/10">
                          <DialogTrigger asChild>
                            <DropdownMenuItem onClick={() => setSelectedUser(user)} data-testid={`menu-add-credits-${user.id}`}>
                              <CreditCard className="w-4 h-4 mr-2" /> Add Credits
                            </DropdownMenuItem>
                          </DialogTrigger>
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(user.id)} data-testid={`menu-delete-${user.id}`}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {selectedUser?.id === user.id && <AddCreditsDialog user={selectedUser} onClose={() => setSelectedUser(null)} />}
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
