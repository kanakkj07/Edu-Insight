import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertStudent } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useTeacherStudents() {
  return useQuery({
    queryKey: [api.teacher.listStudents.path],
    queryFn: async () => {
      const res = await fetch(api.teacher.listStudents.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return res.json();
    },
  });
}

export function useAddStudent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (email: string) => {
      const payload = { email };
      const validated = api.teacher.addStudent.input.parse(payload);
      const res = await fetch(api.teacher.addStudent.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.teacher.addStudent.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to add student");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.teacher.listStudents.path] });
      toast({ title: "Success", description: "Student invitation sent" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useTeacherBenchmark() {
  return useQuery({
    queryKey: ["/api/teacher/benchmark"],
    queryFn: async () => {
      const res = await fetch("/api/teacher/benchmark", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch benchmark");
      return res.json();
    },
  });
}

export function useStudentDetail(studentId: number | null) {
  return useQuery({
    queryKey: ["/api/teacher/students", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const res = await fetch(`/api/teacher/students/${studentId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch student detail");
      return res.json();
    },
    enabled: !!studentId,
  });
}

export function useCreateIntervention() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { studentId: number; type: string; notes?: string }) => {
      const res = await fetch("/api/teacher/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to log intervention");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teacher/students", vars.studentId] });
      toast({ title: "Intervention logged", description: "Record saved successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useSendMessageTeacher() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      toast({ title: "Message sent" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
