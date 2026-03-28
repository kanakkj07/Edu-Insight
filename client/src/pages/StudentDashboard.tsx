import { useStudentDashboard, useUpdateAcademic, useSubmitStress, useBenchmark } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Loader2, AlertTriangle, BookOpen, Brain, LogOut, Plus, X, Sun, Moon, TrendingUp, Target, Timer, Smile, Zap, BarChart3, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StressGame } from "@/components/StressGame";
import { WhatIfSimulator } from "@/components/WhatIfSimulator";
import { MoodJournal } from "@/components/MoodJournal";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { NotificationBell } from "@/components/NotificationBell";
import { GoalsPanel } from "@/components/GoalsPanel";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { motion } from "framer-motion";
import { useTheme } from "@/hooks/use-theme";

const academicSchema = z.object({
  cgpas: z.array(z.object({
    semesterNumber: z.coerce.number().min(1),
    cgpa: z.coerce.number().min(0).max(10)
  })).min(1, "At least one semester is required"),
  attendancePercentage: z.coerce.number().min(0).max(100),
  backlogs: z.coerce.number().min(0),
  studyHoursPerDay: z.coerce.number().min(0).max(24),
});

const stressQuestions = [
  { id: "q1", text: "I feel overwhelmed by my workload." },
  { id: "q2", text: "I have trouble sleeping due to stress." },
  { id: "q3", text: "I feel anxious about my academic performance." },
  { id: "q4", text: "I find it hard to relax even when I have free time." },
  { id: "q5", text: "I get irritable or angry easily." },
];

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const { data, isLoading } = useStudentDashboard();
  const updateAcademic = useUpdateAcademic();
  const submitStress = useSubmitStress();
  const benchmark = useBenchmark();
  const { theme, toggleTheme } = useTheme();

  const [gameOpen, setGameOpen] = useState(false);
  const [stressDialogOpen, setStressDialogOpen] = useState(false);
  const [academicDialogOpen, setAcademicDialogOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);

  const academicForm = useForm<z.infer<typeof academicSchema>>({
    resolver: zodResolver(academicSchema),
    values: {
      cgpas: data?.semesterRecords?.length
        ? (data.semesterRecords || []).map((r: any) => ({ semesterNumber: r.semesterNumber, cgpa: Number(r.cgpa) }))
        : [{ semesterNumber: 1, cgpa: data?.academic?.cgpa ? Number(data.academic.cgpa) : 0 }],
      attendancePercentage: data?.academic?.attendancePercentage ? Number(data.academic.attendancePercentage) : 0,
      backlogs: data?.academic?.backlogs ?? 0,
      studyHoursPerDay: data?.academic?.studyHoursPerDay ?? 0,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: academicForm.control,
    name: "cgpas"
  });

  const stressForm = useForm<Record<string, string>>({
    defaultValues: stressQuestions.reduce((acc, q) => ({ ...acc, [q.id]: "3" }), {}),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const riskColor =
    data?.prediction?.riskLevel === "Low" ? "text-green-500" :
    data?.prediction?.riskLevel === "Moderate" ? "text-yellow-500" :
    data?.prediction?.riskLevel === "High" ? "text-orange-500" : "text-red-500";

  const totalStudyMinutes = (data?.studySessions || []).reduce((acc: number, s: any) => acc + s.duration, 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 lg:p-12 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Student Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="flex gap-2 items-center">
          <NotificationBell />
          <Button variant="outline" size="icon" onClick={toggleTheme} className="rounded-full border-white/10 hover:bg-accent">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => logout.mutate()} className="border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="mr-2 h-4 w-4" /> Logout
          </Button>
        </div>
      </header>

      {/* Tabs for organizing content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/80 border border-border">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6">
          {/* Top Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Risk Assessment */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="glass-card h-full border-l-4 border-l-primary relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <AlertTriangle className="w-20 h-20 text-primary" />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Risk Assessment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${riskColor}`}>
                    {data?.prediction?.riskLevel || "N/A"}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Score: {data?.prediction?.riskScore ? (Number(data.prediction.riskScore) * 100).toFixed(0) : 0}%
                  </p>
                  <Progress value={Number(data?.prediction?.riskScore || 0) * 100} className="mt-3 h-1.5" />
                  <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto text-xs text-primary" onClick={() => setSimulatorOpen(true)}>
                    🔮 Try What-If Simulator →
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Academic Status */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="glass-card h-full border-l-4 border-l-secondary relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <BookOpen className="w-20 h-20 text-secondary" />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Academic Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Avg CGPA</span>
                    <span className="font-bold text-lg">{data?.academic?.cgpa ? Number(data.academic.cgpa).toFixed(2) : "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs">Attendance</span>
                    <span className="font-bold text-lg">{data?.academic?.attendancePercentage || 0}%</span>
                  </div>
                  <Button variant="secondary" size="sm" className="w-full mt-1" onClick={() => setAcademicDialogOpen(true)}>
                    Update Records
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Stress Level */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass-card h-full border-l-4 border-l-purple-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Brain className="w-20 h-20 text-purple-500" />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Stress Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {data?.latestStress?.stressScore || 0}<span className="text-sm text-muted-foreground font-normal">/100</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Last assessment</p>
                  <Button className="w-full mt-3 bg-purple-600 hover:bg-purple-700" size="sm" onClick={() => setStressDialogOpen(true)}>
                    Take Assessment
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Study Stats */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <Card className="glass-card h-full border-l-4 border-l-green-500 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Timer className="w-20 h-20 text-green-500" />
                </div>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Study Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {Math.floor(totalStudyMinutes / 60)}<span className="text-sm text-muted-foreground font-normal">h </span>
                    {totalStudyMinutes % 60}<span className="text-sm text-muted-foreground font-normal">m</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{(data?.studySessions || []).length} sessions logged</p>
                  <Button className="w-full mt-3 bg-green-600 hover:bg-green-700" size="sm" onClick={() => setPomodoroOpen(true)}>
                    <Timer className="h-3 w-3 mr-1" /> Start Pomodoro
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* AI Recommendations */}
          {data?.recommendations && data.recommendations.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Card className="glass-card gradient-border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    AI Recommendations
                  </CardTitle>
                  <CardDescription>Personalized insights based on your data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.recommendations.map((rec: string, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + i * 0.1 }}
                        className="p-3 rounded-lg bg-accent/50 text-sm"
                      >
                        {rec}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Quick Actions Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-all border-dashed" onClick={() => setMoodOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <span className="text-2xl">📔</span>
                  <span className="text-sm font-medium">Mood Journal</span>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-all border-dashed" onClick={() => setGoalsOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <span className="text-2xl">🎯</span>
                  <span className="text-sm font-medium">Goals</span>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-all border-dashed" onClick={() => setGameOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <span className="text-2xl">🧘</span>
                  <span className="text-sm font-medium">De-Stress</span>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card className="cursor-pointer hover:bg-accent/50 transition-all border-dashed" onClick={() => setSimulatorOpen(true)}>
                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                  <span className="text-2xl">🔮</span>
                  <span className="text-sm font-medium">What-If</span>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </TabsContent>

        {/* === ANALYTICS TAB === */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Semester Performance Chart */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Semester Performance</CardTitle>
              <CardDescription>CGPA vs stress trends across semesters</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(data?.semesterRecords || []).map((rec: any, i: number) => ({
                  name: `Sem ${rec.semesterNumber}`,
                  cgpa: Number(rec.cgpa) * 10,
                  stress: data?.history?.stress?.[i]?.stressScore || 0
                }))}>
                  <defs>
                    <linearGradient id="colorCgpa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f6851b" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f6851b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorStress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#037dd6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#037dd6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#525252" />
                  <YAxis stroke="#525252" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Area type="monotone" dataKey="cgpa" stroke="#f6851b" fillOpacity={1} fill="url(#colorCgpa)" name="Performance (Scaled)" />
                  <Area type="monotone" dataKey="stress" stroke="#037dd6" fillOpacity={1} fill="url(#colorStress)" name="Stress Score" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Peer Benchmark */}
          {benchmark.data?.available && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-secondary" /> Peer Comparison
                </CardTitle>
                <CardDescription>Anonymized comparison with your class ({benchmark.data.class.totalStudents} students)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  {[
                    { label: "CGPA", yours: benchmark.data.you.cgpa, avg: benchmark.data.class.avgCgpa, max: 10 },
                    { label: "Attendance", yours: benchmark.data.you.attendance, avg: benchmark.data.class.avgAttendance, max: 100, suffix: "%" },
                    { label: "Stress", yours: benchmark.data.you.stress, avg: benchmark.data.class.avgStress, max: 100, invert: true },
                  ].map((item) => (
                    <div key={item.label} className="text-center space-y-2">
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <div className="flex gap-2 justify-center items-end h-24">
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-8 bg-primary/60 rounded-t"
                            style={{ height: `${(item.yours / item.max) * 80}px` }}
                          />
                          <span className="text-[10px] text-muted-foreground">You</span>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div
                            className="w-8 bg-secondary/40 rounded-t"
                            style={{ height: `${(item.avg / item.max) * 80}px` }}
                          />
                          <span className="text-[10px] text-muted-foreground">Avg</span>
                        </div>
                      </div>
                      <div className="text-xs">
                        <span className="text-primary font-bold">{item.yours.toFixed(1)}{item.suffix || ""}</span>
                        <span className="text-muted-foreground"> vs </span>
                        <span className="text-secondary">{item.avg.toFixed(1)}{item.suffix || ""}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mood Trend */}
          {data?.moodEntries && data.moodEntries.length > 0 && (
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smile className="h-5 w-5 text-yellow-500" /> Mood Trend
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[...data.moodEntries].reverse().slice(-14).map((m: any) => ({
                    date: new Date(m.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    mood: m.mood,
                  }))}>
                    <XAxis dataKey="date" stroke="#525252" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 5]} stroke="#525252" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                    <Bar dataKey="mood" fill="#eab308" radius={[4, 4, 0, 0]} name="Mood" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === TOOLS TAB === */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "🔮", title: "What-If Simulator", desc: "Simulate how changes affect your risk", action: () => setSimulatorOpen(true), color: "from-purple-500/20 to-blue-500/20" },
              { icon: "📔", title: "Mood Journal", desc: "Track your daily emotional wellness", action: () => setMoodOpen(true), color: "from-yellow-500/20 to-orange-500/20" },
              { icon: "⏱", title: "Pomodoro Timer", desc: "Focus timer with study tracking", action: () => setPomodoroOpen(true), color: "from-green-500/20 to-emerald-500/20" },
              { icon: "🎯", title: "Goals & Targets", desc: "Set and track your academic goals", action: () => setGoalsOpen(true), color: "from-blue-500/20 to-cyan-500/20" },
              { icon: "🧘", title: "De-Stress Zone", desc: "Breathing exercises for calm", action: () => setGameOpen(true), color: "from-teal-500/20 to-green-500/20" },
              { icon: "📝", title: "Stress Assessment", desc: "Evaluate your current stress level", action: () => setStressDialogOpen(true), color: "from-pink-500/20 to-purple-500/20" },
            ].map((tool, i) => (
              <motion.div key={i} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Card
                  className={`cursor-pointer glass-card hover:shadow-lg transition-all bg-gradient-to-br ${tool.color}`}
                  onClick={tool.action}
                >
                  <CardContent className="p-6 flex items-center gap-4">
                    <span className="text-4xl">{tool.icon}</span>
                    <div>
                      <h3 className="font-bold">{tool.title}</h3>
                      <p className="text-sm text-muted-foreground">{tool.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* === ACHIEVEMENTS TAB === */}
        <TabsContent value="achievements" className="space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" /> Your Achievements
              </CardTitle>
              <CardDescription>{(data?.achievements || []).length} achievements earned</CardDescription>
            </CardHeader>
            <CardContent>
              {(data?.achievements || []).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No achievements yet. Keep using the tools to earn badges!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {(data?.achievements || []).map((a: any) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 text-center"
                    >
                      <span className="text-3xl">{a.icon || "🏆"}</span>
                      <p className="font-bold text-sm mt-2">{a.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Potential achievements */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">Achievements to Unlock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { icon: "🌟", title: "Mood Master", desc: "7-day mood streak" },
                  { icon: "📚", title: "Study Champion", desc: "10+ hours studied" },
                  { icon: "🎓", title: "Knowledge Seeker", desc: "50+ hours studied" },
                  { icon: "🧠", title: "Self-Aware", desc: "First stress assessment" },
                  { icon: "⭐", title: "Rising Star", desc: "CGPA improved 0.5+" },
                ].filter(p => !(data?.achievements || []).find((a: any) => a.title === p.title))
                .map((p, i) => (
                  <div key={i} className="p-3 rounded-lg border border-dashed border-muted text-center opacity-50">
                    <span className="text-2xl grayscale">{p.icon}</span>
                    <p className="text-xs font-medium mt-1">{p.title}</p>
                    <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* === DIALOGS === */}
      <StressGame isOpen={gameOpen} onClose={() => setGameOpen(false)} />
      <WhatIfSimulator
        isOpen={simulatorOpen}
        onClose={() => setSimulatorOpen(false)}
        currentData={{
          attendance: data?.academic?.attendancePercentage ? Number(data.academic.attendancePercentage) : 75,
          cgpa: data?.academic?.cgpa ? Number(data.academic.cgpa) : 7,
          backlogs: data?.academic?.backlogs || 0,
          stressScore: data?.latestStress?.stressScore || 50,
        }}
      />
      <MoodJournal isOpen={moodOpen} onClose={() => setMoodOpen(false)} recentMoods={data?.moodEntries || []} />
      <PomodoroTimer isOpen={pomodoroOpen} onClose={() => setPomodoroOpen(false)} totalMinutes={totalStudyMinutes} />
      <GoalsPanel isOpen={goalsOpen} onClose={() => setGoalsOpen(false)} goals={data?.goals || []} />

      {/* Update Academic Dialog */}
      <Dialog open={academicDialogOpen} onOpenChange={setAcademicDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Academic Records</DialogTitle>
          </DialogHeader>
          <Form {...academicForm}>
            <form onSubmit={academicForm.handleSubmit((data) => {
              updateAcademic.mutate(data, { onSuccess: () => setAcademicDialogOpen(false) });
            })} className="space-y-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b">
                  <FormLabel className="text-base">Semester Records</FormLabel>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex gap-2 items-end">
                      <FormField control={academicForm.control} name={`cgpas.${index}.semesterNumber`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            {index === 0 && <FormLabel className="text-xs">Sem</FormLabel>}
                            <FormControl><Input type="number" placeholder="No." {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField control={academicForm.control} name={`cgpas.${index}.cgpa`}
                        render={({ field }) => (
                          <FormItem className="flex-[3]">
                            {index === 0 && <FormLabel className="text-xs">CGPA (0-10)</FormLabel>}
                            <FormControl><Input type="number" step="0.01" placeholder="CGPA" {...field} /></FormControl>
                          </FormItem>
                        )}
                      />
                      {fields.length > 1 && (
                        <Button type="button" variant="destructive" size="icon" className="mb-[2px] h-9 w-9 shrink-0" onClick={() => remove(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full mt-2"
                    onClick={() => append({ semesterNumber: fields.length > 0 ? Number(fields[fields.length - 1].semesterNumber) + 1 : 1, cgpa: 0 })}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Semester
                  </Button>
                </div>
              </div>
              <FormField control={academicForm.control} name="attendancePercentage"
                render={({ field }) => (
                  <FormItem><FormLabel>Attendance %</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl></FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={academicForm.control} name="backlogs"
                  render={({ field }) => (
                    <FormItem><FormLabel>Backlogs</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )}
                />
                <FormField control={academicForm.control} name="studyHoursPerDay"
                  render={({ field }) => (
                    <FormItem><FormLabel>Study Hrs/Day</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )}
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateAcademic.isPending}>
                {updateAcademic.isPending ? "Updating..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stress Assessment Dialog */}
      <Dialog open={stressDialogOpen} onOpenChange={setStressDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Stress Assessment</DialogTitle>
            <CardDescription>Rate how strongly you agree (1-5)</CardDescription>
          </DialogHeader>
          <Form {...stressForm}>
            <form onSubmit={stressForm.handleSubmit((data) => {
              const formattedData = Object.entries(data).reduce((acc, [k, v]) => ({...acc, [k]: Number(v)}), {});
              submitStress.mutate(formattedData, { onSuccess: () => setStressDialogOpen(false) });
            })} className="space-y-6">
              {stressQuestions.map((q) => (
                <FormField key={q.id} control={stressForm.control} name={q.id}
                  render={({ field }) => (
                    <FormItem className="space-y-3 border-b border-border pb-4 last:border-0">
                      <FormLabel className="text-base">{q.text}</FormLabel>
                      <FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex justify-between">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <FormItem key={val} className="flex flex-col items-center space-y-0 cursor-pointer">
                              <FormControl><RadioGroupItem value={val.toString()} /></FormControl>
                              <Label className="font-normal text-xs text-muted-foreground mt-1">{val}</Label>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Disagree</span><span>Agree</span>
                      </div>
                    </FormItem>
                  )}
                />
              ))}
              <Button type="submit" className="w-full" disabled={submitStress.isPending}>
                {submitStress.isPending ? "Analyzing..." : "Submit Assessment"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
