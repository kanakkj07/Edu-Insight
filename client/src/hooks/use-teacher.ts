import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type InsertStudent } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useTeacherStudents() {
  return useQuery({
    queryKey: [api.teacher.listStudents.path],
    queryFn: async () => {
      const res = await fetch(api.teacher.listStudents.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch students");
      return api.teacher.listStudents.responses[200].parse(await res.json());
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
      return api.teacher.addStudent.responses[201].parse(await res.json());
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
