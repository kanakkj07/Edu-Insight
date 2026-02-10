import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

type Role = "student" | "teacher";

interface ProtectedRouteProps {
  component: React.ComponentType;
  role?: Role;
}

export function ProtectedRoute({ component: Component, role }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (role && user.role !== role) {
    return <Redirect to={user.role === "student" ? "/student-dashboard" : "/teacher-dashboard"} />;
  }

  return <Component />;
}
