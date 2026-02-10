import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertAcademic, type InsertStress } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useStudentDashboard() {
  return useQuery({
    queryKey: [api.student.getDashboard.path],
    queryFn: async () => {
      const res = await fetch(api.student.getDashboard.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return api.student.getDashboard.responses[200].parse(await res.json());
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
      return api.student.updateAcademic.responses[200].parse(await res.json());
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
      return api.student.submitStress.responses[201].parse(await res.json());
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
