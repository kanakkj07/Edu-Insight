import { useTeacherStudents, useAddStudent } from "@/hooks/use-teacher";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Loader2, UserPlus, Search, LogOut, GraduationCap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";

const inviteSchema = z.object({
  email: z.string().email(),
});

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const { data: students, isLoading } = useTeacherStudents();
  const addStudent = useAddStudent();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "" },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const filteredStudents = students?.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskBadge = (level?: string) => {
    switch(level) {
      case "Critical": return <Badge variant="destructive" className="bg-red-900/50 text-red-200 border-red-800">Critical</Badge>;
      case "High": return <Badge className="bg-orange-900/50 text-orange-200 border-orange-800 hover:bg-orange-900/60">High</Badge>;
      case "Moderate": return <Badge className="bg-yellow-900/50 text-yellow-200 border-yellow-800 hover:bg-yellow-900/60">Moderate</Badge>;
      case "Low": return <Badge className="bg-green-900/50 text-green-200 border-green-800 hover:bg-green-900/60">Low</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">
            Teacher Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Managing {students?.length} students</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
           <Button variant="outline" onClick={() => logout.mutate()} className="border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="bg-primary hover:bg-primary/90 text-white">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Student
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="glass-card border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High Risk Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students?.filter(s => s.riskLevel === "High" || s.riskLevel === "Critical").length}</div>
          </CardContent>
        </Card>
         <Card className="glass-card border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Moderate Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students?.filter(s => s.riskLevel === "Moderate").length}</div>
          </CardContent>
        </Card>
         <Card className="glass-card border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students?.filter(s => s.riskLevel === "Low").length}</div>
          </CardContent>
        </Card>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Student Overview</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search students..." 
                  className="pl-8 bg-black/20 border-white/10" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-white/5 border-white/10">
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead className="text-right">Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents?.length === 0 ? (
                   <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No students found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents?.map((student) => (
                    <TableRow key={student.id} className="hover:bg-white/5 border-white/10 cursor-pointer transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">
                            {student.name.charAt(0)}
                          </div>
                          {student.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{student.email}</TableCell>
                      <TableCell>{getRiskBadge(student.riskLevel)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-secondary/20 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-secondary" 
                              style={{ width: `${(student.riskScore || 0) * 100}%` }} 
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{((student.riskScore || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {student.lastUpdated ? new Date(student.lastUpdated).toLocaleDateString() : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Student</DialogTitle>
            <DialogDescription>
              Enter the student's email. They will be able to register using this email.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
              addStudent.mutate(data.email, { onSuccess: () => {
                setInviteOpen(false); 
                form.reset();
              }});
            })} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input placeholder="student@university.edu" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={addStudent.isPending}>
                {addStudent.isPending ? "Sending Invitation..." : "Send Invitation"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
