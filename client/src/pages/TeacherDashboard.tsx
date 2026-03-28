import { useTeacherStudents, useAddStudent, useTeacherBenchmark, useStudentDetail, useCreateIntervention, useSendMessageTeacher } from "@/hooks/use-teacher";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Loader2, UserPlus, Search, LogOut, Sun, Moon, Eye, MessageSquare, ClipboardList, BarChart3, ArrowLeft, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";
import { NotificationBell } from "@/components/NotificationBell";

const inviteSchema = z.object({
  email: z.string().email(),
});

export default function TeacherDashboard() {
  const { user, logout } = useAuth();
  const { data: students, isLoading } = useTeacherStudents();
  const addStudent = useAddStudent();
  const benchmark = useTeacherBenchmark();
  const { theme, toggleTheme } = useTheme();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [messageTarget, setMessageTarget] = useState<{ id: number; name: string } | null>(null);

  const studentDetail = useStudentDetail(selectedStudentId);
  const createIntervention = useCreateIntervention();
  const sendMessage = useSendMessageTeacher();

  const [msgContent, setMsgContent] = useState("");
  const [intType, setIntType] = useState("counseling");
  const [intNotes, setIntNotes] = useState("");

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

  const filteredStudents = students?.filter((s: any) =>
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

  // Student Detail View
  if (selectedStudentId && studentDetail.data) {
    const sd = studentDetail.data;
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => setSelectedStudentId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold">{sd.student.name}</h1>
            <p className="text-sm text-muted-foreground">{sd.student.email}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMessageTarget({ id: sd.student.id, name: sd.student.name }); setMessageOpen(true); }}>
              <MessageSquare className="h-4 w-4 mr-1" /> Message
            </Button>
            <Button variant="outline" size="sm" onClick={() => setInterventionOpen(true)}>
              <ClipboardList className="h-4 w-4 mr-1" /> Log Intervention
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card border-l-4 border-l-primary">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Risk Level</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sd.prediction?.riskLevel || "Unknown"}</div>
              <p className="text-xs text-muted-foreground">Score: {sd.prediction?.riskScore ? (Number(sd.prediction.riskScore) * 100).toFixed(0) : 0}%</p>
              <Progress value={Number(sd.prediction?.riskScore || 0) * 100} className="mt-2 h-1.5" />
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-secondary">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Academic</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between"><span className="text-xs">CGPA</span><span className="font-bold">{sd.academic?.cgpa ? Number(sd.academic.cgpa).toFixed(2) : "N/A"}</span></div>
              <div className="flex justify-between"><span className="text-xs">Attendance</span><span className="font-bold">{sd.academic?.attendancePercentage || 0}%</span></div>
              <div className="flex justify-between"><span className="text-xs">Backlogs</span><span className="font-bold">{sd.academic?.backlogs || 0}</span></div>
            </CardContent>
          </Card>
          <Card className="glass-card border-l-4 border-l-purple-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stress</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sd.latestStress?.stressScore || 0}<span className="text-sm text-muted-foreground font-normal">/100</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Risk Factors */}
        {sd.prediction?.factors && (sd.prediction.factors as string[]).length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Factors</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(sd.prediction.factors as string[]).map((f: string, i: number) => (
                  <Badge key={i} variant="outline" className="bg-destructive/10">{f}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Semester Performance */}
        {sd.semesters && sd.semesters.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Semester Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {sd.semesters.map((s: any) => (
                  <div key={s.id} className="flex-shrink-0 p-3 rounded-lg bg-accent/50 min-w-[80px] text-center">
                    <p className="text-xs text-muted-foreground">Sem {s.semesterNumber}</p>
                    <p className="text-lg font-bold">{Number(s.cgpa).toFixed(1)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Interventions */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Intervention Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(!sd.interventions || sd.interventions.length === 0) ? (
              <p className="text-sm text-muted-foreground text-center py-4">No interventions recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {sd.interventions.map((inv: any) => (
                  <div key={inv.id} className="p-3 rounded-lg bg-accent/30 flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{inv.type.replace("_", " ")}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</span>
                      </div>
                      {inv.notes && <p className="text-sm mt-1">{inv.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Dialog */}
        <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Message {messageTarget?.name}</DialogTitle>
            </DialogHeader>
            <Textarea placeholder="Type your message..." value={msgContent} onChange={(e) => setMsgContent(e.target.value)} rows={4} />
            <Button onClick={() => {
              if (messageTarget && msgContent.trim()) {
                sendMessage.mutate({ receiverId: messageTarget.id, content: msgContent }, {
                  onSuccess: () => { setMsgContent(""); setMessageOpen(false); }
                });
              }
            }} disabled={sendMessage.isPending || !msgContent.trim()}>
              <Send className="h-4 w-4 mr-2" /> {sendMessage.isPending ? "Sending..." : "Send"}
            </Button>
          </DialogContent>
        </Dialog>

        {/* Intervention Dialog */}
        <Dialog open={interventionOpen} onOpenChange={setInterventionOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Log Intervention</DialogTitle>
              <DialogDescription>Record an intervention for {sd.student.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <FormLabel>Type</FormLabel>
                <Select value={intType} onValueChange={setIntType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="counseling">Counseling Session</SelectItem>
                    <SelectItem value="parent_contact">Parent Contact</SelectItem>
                    <SelectItem value="academic_support">Academic Support</SelectItem>
                    <SelectItem value="referral">Referral</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <FormLabel>Notes</FormLabel>
                <Textarea value={intNotes} onChange={(e) => setIntNotes(e.target.value)} placeholder="Details about the intervention..." rows={3} className="mt-1" />
              </div>
              <Button className="w-full" onClick={() => {
                createIntervention.mutate(
                  { studentId: selectedStudentId!, type: intType, notes: intNotes || undefined },
                  { onSuccess: () => { setIntNotes(""); setInterventionOpen(false); } }
                );
              }} disabled={createIntervention.isPending}>
                {createIntervention.isPending ? "Saving..." : "Log Intervention"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Main Teacher Dashboard
  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 space-y-6 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-secondary to-primary">
            Teacher Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Managing {students?.length} students</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <NotificationBell />
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full border-white/10 hover:bg-accent">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => logout.mutate()} className="border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
          <Button onClick={() => setInviteOpen(true)} className="bg-primary hover:bg-primary/90 text-white">
            <UserPlus className="mr-2 h-4 w-4" /> Invite Student
          </Button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="glass-card border-l-4 border-l-red-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">High Risk Students</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{students?.filter((s: any) => s.riskLevel === "High" || s.riskLevel === "Critical").length}</div></CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-yellow-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Moderate Risk</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{students?.filter((s: any) => s.riskLevel === "Moderate").length}</div></CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-green-500">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Low Risk</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{students?.filter((s: any) => s.riskLevel === "Low").length}</div></CardContent>
        </Card>
        {benchmark.data && (
          <Card className="glass-card border-l-4 border-l-blue-500">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Class Avg CGPA</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{benchmark.data.avgCgpa?.toFixed(2) || "N/A"}</div></CardContent>
          </Card>
        )}
      </div>

      {/* Class Benchmark */}
      {benchmark.data && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-secondary" /> Class Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Avg CGPA</p>
                <p className="text-2xl font-bold text-primary">{benchmark.data.avgCgpa?.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-2xl font-bold text-secondary">{benchmark.data.avgAttendance?.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Stress</p>
                <p className="text-2xl font-bold text-purple-500">{benchmark.data.avgStress?.toFixed(0)}/100</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Table */}
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
                  <TableHead className="text-right">Actions</TableHead>
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
                  filteredStudents?.map((student: any) => (
                    <TableRow key={student.id} className="hover:bg-white/5 border-white/10 transition-colors">
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
                            <div className="h-full bg-secondary" style={{ width: `${(student.riskScore || 0) * 100}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{((student.riskScore || 0) * 100).toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedStudentId(student.id)} title="View Details">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setMessageTarget({ id: student.id, name: student.name }); setMessageOpen(true); }} title="Send Message">
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite Student</DialogTitle>
            <DialogDescription>Enter the student's email. They will be able to register using this email.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => {
              addStudent.mutate(data.email, { onSuccess: () => { setInviteOpen(false); form.reset(); }});
            })} className="space-y-4">
              <FormField control={form.control} name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl><Input placeholder="student@university.edu" {...field} /></FormControl>
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

      {/* Message Dialog (from table) */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Message {messageTarget?.name}</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Type your message..." value={msgContent} onChange={(e) => setMsgContent(e.target.value)} rows={4} />
          <Button onClick={() => {
            if (messageTarget && msgContent.trim()) {
              sendMessage.mutate({ receiverId: messageTarget.id, content: msgContent }, {
                onSuccess: () => { setMsgContent(""); setMessageOpen(false); }
              });
            }
          }} disabled={sendMessage.isPending || !msgContent.trim()}>
            <Send className="h-4 w-4 mr-2" /> {sendMessage.isPending ? "Sending..." : "Send Message"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
