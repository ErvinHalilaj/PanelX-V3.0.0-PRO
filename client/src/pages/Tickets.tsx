import { useState } from "react";
import { Layout } from "@/components/Layout";
import { useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket, useTicketReplies, useCreateTicketReply } from "@/hooks/use-tickets";
import { Plus, Trash2, MessageSquare, AlertCircle, Clock, CheckCircle, XCircle, Send, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { Ticket, InsertTicket, InsertTicketReply } from "@shared/schema";

function TicketForm({ onSubmit, isLoading }: { onSubmit: (data: InsertTicket) => void, isLoading: boolean }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("normal");
  const [category, setCategory] = useState("general");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;
    onSubmit({ 
      subject, 
      priority, 
      category,
      status: "open"
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input 
          id="subject" 
          value={subject} 
          onChange={(e) => setSubject(e.target.value)} 
          placeholder="Brief description of your issue"
          data-testid="input-ticket-subject"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger data-testid="select-priority">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="billing">Billing</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="account">Account</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isLoading} className="w-full btn-primary" data-testid="button-submit-ticket">
          {isLoading ? "Creating..." : "Create Ticket"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TicketDetails({ ticket, onClose }: { ticket: Ticket, onClose: () => void }) {
  const { data: replies, isLoading: repliesLoading } = useTicketReplies(ticket.id);
  const createReply = useCreateTicketReply();
  const updateTicket = useUpdateTicket();
  const [replyMessage, setReplyMessage] = useState("");

  const handleSendReply = async () => {
    if (!replyMessage.trim()) return;
    try {
      await createReply.mutateAsync({
        ticketId: ticket.id,
        message: replyMessage,
        isAdminReply: true
      });
      setReplyMessage("");
      toast({ title: "Reply sent" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to send reply", variant: "destructive" });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateTicket.mutateAsync({ id: ticket.id, status: newStatus });
      toast({ title: "Status updated" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{ticket.subject}</h3>
          <p className="text-sm text-muted-foreground">
            Ticket #{ticket.id} • Created {ticket.createdAt ? format(new Date(ticket.createdAt), "PPp") : "N/A"}
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={ticket.status || "open"} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-32" data-testid="select-ticket-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Badge variant={ticket.priority === "urgent" ? "destructive" : ticket.priority === "high" ? "default" : "secondary"}>
          {ticket.priority}
        </Badge>
        <Badge variant="outline">{ticket.category}</Badge>
      </div>

      <div className="border-t border-white/10 pt-4">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Messages
        </h4>
        
        {repliesLoading ? (
          <p className="text-muted-foreground text-sm">Loading messages...</p>
        ) : replies?.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet</p>
        ) : (
          <div className="space-y-3">
            {replies?.map((reply) => (
              <div 
                key={reply.id} 
                className={`p-3 rounded-lg ${reply.isAdminReply ? "bg-blue-500/10 ml-4" : "bg-white/5 mr-4"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={reply.isAdminReply ? "default" : "secondary"} className="text-xs">
                    {reply.isAdminReply ? "Admin" : "User"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {reply.createdAt ? format(new Date(reply.createdAt), "PPp") : ""}
                  </span>
                </div>
                <p className="text-sm">{reply.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {ticket.status !== "closed" && (
        <div className="border-t border-white/10 pt-4">
          <div className="flex gap-2">
            <Textarea
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Type your reply..."
              className="flex-1"
              rows={2}
              data-testid="input-reply-message"
            />
            <Button 
              onClick={handleSendReply} 
              disabled={createReply.isPending || !replyMessage.trim()}
              data-testid="button-send-reply"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Tickets() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: tickets, isLoading } = useTickets(undefined, statusFilter === "all" ? undefined : statusFilter);
  const createTicket = useCreateTicket();
  const deleteTicket = useDeleteTicket();

  const handleCreate = async (data: InsertTicket) => {
    try {
      await createTicket.mutateAsync(data);
      toast({ title: "Success", description: "Ticket created" });
      setIsCreateOpen(false);
    } catch (error) {
      toast({ title: "Error", description: "Failed to create ticket", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this ticket?")) {
      await deleteTicket.mutateAsync(id);
      toast({ title: "Deleted", description: "Ticket removed" });
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case "open": return <AlertCircle className="w-4 h-4 text-green-500" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "closed": return <CheckCircle className="w-4 h-4 text-gray-500" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const openCount = tickets?.filter(t => t.status === "open").length || 0;
  const pendingCount = tickets?.filter(t => t.status === "pending").length || 0;

  return (
    <Layout 
      title="Support Tickets"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="btn-primary gap-2" data-testid="button-new-ticket">
              <Plus className="w-4 h-4" /> New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <TicketForm onSubmit={handleCreate} isLoading={createTicket.isPending} />
          </DialogContent>
        </Dialog>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-green-500/10 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open</p>
                  <p className="text-2xl font-bold text-green-500">{openCount}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-yellow-500">{pendingCount}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gray-500/10 border-gray-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{tickets?.length || 0}</p>
                </div>
                <MessageSquare className="w-8 h-8 text-gray-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-2">
          <Button 
            variant={statusFilter === "all" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("all")}
          >
            All
          </Button>
          <Button 
            variant={statusFilter === "open" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("open")}
          >
            Open
          </Button>
          <Button 
            variant={statusFilter === "pending" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("pending")}
          >
            Pending
          </Button>
          <Button 
            variant={statusFilter === "closed" ? "default" : "outline"} 
            size="sm"
            onClick={() => setStatusFilter("closed")}
          >
            Closed
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
        ) : tickets?.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No tickets found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {tickets?.map((ticket) => (
              <Card 
                key={ticket.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedTicket(ticket)}
                data-testid={`ticket-${ticket.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(ticket.status)}
                      <div>
                        <h4 className="font-medium">{ticket.subject}</h4>
                        <p className="text-sm text-muted-foreground">
                          #{ticket.id} • {ticket.createdAt ? format(new Date(ticket.createdAt), "PP") : "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ticket.priority === "urgent" ? "destructive" : ticket.priority === "high" ? "default" : "secondary"}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline">{ticket.category}</Badge>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); handleDelete(ticket.id); }}
                        data-testid={`button-delete-ticket-${ticket.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
            </DialogHeader>
            {selectedTicket && (
              <TicketDetails ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
