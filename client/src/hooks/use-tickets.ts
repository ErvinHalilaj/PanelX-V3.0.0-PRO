import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Ticket, TicketReply, InsertTicket, InsertTicketReply } from "@shared/schema";

export function useTickets(userId?: number, status?: string) {
  const params = new URLSearchParams();
  if (userId) params.append("userId", userId.toString());
  if (status) params.append("status", status);
  const queryString = params.toString();
  const path = queryString ? `/api/tickets?${queryString}` : "/api/tickets";
  
  return useQuery<Ticket[]>({
    queryKey: ["/api/tickets", userId, status],
    queryFn: () => fetch(path).then(r => r.json()),
  });
}

export function useTicket(id: number) {
  return useQuery<Ticket>({
    queryKey: ["/api/tickets", id],
    queryFn: () => fetch(`/api/tickets/${id}`).then(r => r.json()),
    enabled: !!id,
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InsertTicket) => apiRequest("POST", "/api/tickets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Partial<InsertTicket>) =>
      apiRequest("PUT", `/api/tickets/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tickets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });
}

export function useTicketReplies(ticketId: number) {
  return useQuery<TicketReply[]>({
    queryKey: ["/api/tickets", ticketId, "replies"],
    queryFn: () => fetch(`/api/tickets/${ticketId}/replies`).then(r => r.json()),
    enabled: !!ticketId,
  });
}

export function useCreateTicketReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, ...data }: { ticketId: number } & Partial<InsertTicketReply>) =>
      apiRequest("POST", `/api/tickets/${ticketId}/replies`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets", variables.ticketId, "replies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
    },
  });
}
