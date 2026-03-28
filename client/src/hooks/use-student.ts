import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertAcademic, type InsertStress } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useStudentDashboard() {
  return useQuery({
    queryKey: [api.student.getDashboard.path],
    queryFn: async () => {
      const res = await fetch(api.student.getDashboard.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });
}

export function useUpdateAcademic() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Omit<InsertAcademic, "studentId">) => {
      const validated = api.student.updateAcademic.input.parse(data);
      const res = await fetch(api.student.updateAcademic.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update academic records");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.student.getDashboard.path] });
      toast({ title: "Success", description: "Academic records updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useSubmitStress() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (answers: Record<string, number>) => {
      const validated = api.student.submitStress.input.parse({ answers });
      const res = await fetch(api.student.submitStress.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to submit stress assessment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.student.getDashboard.path] });
      toast({ title: "Completed", description: "Your stress analysis is ready" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// F4: What-If Simulator
export function useSimulateRisk() {
  return useMutation({
    mutationFn: async (params: { attendance: number; cgpa: number; backlogs: number; stressScore: number }) => {
      const res = await fetch("/api/student/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Simulation failed");
      return res.json();
    },
  });
}

// F5: Mood Journal
export function useSubmitMood() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { mood: number; note?: string }) => {
      const res = await fetch("/api/student/mood", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save mood");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.student.getDashboard.path] });
      toast({ title: "Mood logged!", description: "Keep tracking for achievements" });
    },
  });
}

// F7: Study Sessions
export function useLogStudySession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { duration: number; subject?: string }) => {
      const res = await fetch("/api/student/study-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log session");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.student.getDashboard.path] });
      toast({ title: "Session logged!", description: "Great focus session!" });
    },
  });
}

// F9: Goals
export function useCreateGoal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { title: string; target?: number; type: string; deadline?: string }) => {
      const res = await fetch("/api/student/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.student.getDashboard.path] });
      toast({ title: "Goal created!", description: "Stay focused on your targets" });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (goalId: number) => {
      const res = await fetch(`/api/student/goals/${goalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete goal");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.student.getDashboard.path] });
    },
  });
}

// F3: Notifications
export function useNotifications() {
  return useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });
}

// F2: Benchmarking
export function useBenchmark() {
  return useQuery({
    queryKey: ["/api/student/benchmark"],
    queryFn: async () => {
      const res = await fetch("/api/student/benchmark", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch benchmark");
      return res.json();
    },
  });
}

// Messaging
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { receiverId: number; content: string }) => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });
}

export function useMessages(partnerId: number | null) {
  return useQuery({
    queryKey: ["/api/messages", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const res = await fetch(`/api/messages/${partnerId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!partnerId,
    refetchInterval: 5000,
  });
}
