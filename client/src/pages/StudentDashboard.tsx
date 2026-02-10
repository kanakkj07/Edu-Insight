import { useStudentDashboard, useUpdateAcademic, useSubmitStress } from "@/hooks/use-student";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Loader2, TrendingUp, AlertTriangle, BookOpen, Brain, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { StressGame } from "@/components/StressGame";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

const academicSchema = z.object({
  cgpa: z.coerce.number().min(0).max(10),
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
  const [gameOpen, setGameOpen] = useState(false);
  const [stressDialogOpen, setStressDialogOpen] = useState(false);
  const [academicDialogOpen, setAcademicDialogOpen] = useState(false);

  const academicForm = useForm<z.infer<typeof academicSchema>>({
    resolver: zodResolver(academicSchema),
  });

  const stressForm = useForm({
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

  return (
    <div className="min-h-screen bg-background p-6 md:p-12 space-y-8 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-12">
        <div>
          <h1 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Student Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">Welcome back, {user?.name}</p>
        </div>
        <Button variant="outline" onClick={() => logout.mutate()} className="border-destructive/50 hover:bg-destructive/10 hover:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Risk Assessment Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="glass-card h-full border-l-4 border-l-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <AlertTriangle className="w-24 h-24 text-primary" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Risk Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-4xl font-bold ${riskColor}`}>
                {data?.prediction?.riskLevel || "N/A"}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Risk Score: {data?.prediction?.riskScore ? (Number(data.prediction.riskScore) * 100).toFixed(0) : 0}%
              </p>
              <Progress value={Number(data?.prediction?.riskScore || 0) * 100} className="mt-4 h-2" />
            </CardContent>
          </Card>
        </motion.div>

        {/* Academic Overview */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="glass-card h-full border-l-4 border-l-secondary relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
              <BookOpen className="w-24 h-24 text-secondary" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Academic Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm">CGPA</span>
                <span className="font-bold text-xl">{data?.academic?.cgpa || "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Attendance</span>
                <span className="font-bold text-xl">{data?.academic?.attendancePercentage || 0}%</span>
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full mt-2" 
                onClick={() => setAcademicDialogOpen(true)}
              >
                Update Records
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stress Level */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="glass-card h-full border-l-4 border-l-purple-500 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
              <Brain className="w-24 h-24 text-purple-500" />
            </div>
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Stress Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-white">
                {data?.latestStress?.stressScore || 0}<span className="text-sm text-muted-foreground font-normal">/100</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Last assessment score</p>
              <Button 
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700" 
                size="sm"
                onClick={() => setStressDialogOpen(true)}
              >
                Take Assessment
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="glass-card h-full flex flex-col justify-center items-center text-center p-6 border-dashed border-2 border-white/10 bg-transparent shadow-none hover:bg-white/5 transition-colors cursor-pointer" onClick={() => setGameOpen(true)}>
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 flex items-center justify-center mb-4 shadow-lg shadow-green-500/20">
              <Brain className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-bold text-lg">De-Stress Zone</h3>
            <p className="text-sm text-muted-foreground mt-2">Feeling overwhelmed? Take a 2-minute breathing break.</p>
          </Card>
        </motion.div>
      </div>

      {/* Analytics Charts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="glass-card p-6">
          <CardHeader>
            <CardTitle>Performance Trends</CardTitle>
            <CardDescription>Your academic performance vs stress levels over time</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.history?.academic.map((rec, i) => ({
                name: `Sem ${i+1}`,
                cgpa: Number(rec.cgpa) * 10, // Scale to 100 for visual comparison
                stress: data.history.stress[i]?.stressScore || 0
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
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="cgpa" stroke="#f6851b" fillOpacity={1} fill="url(#colorCgpa)" name="Performance (Scaled)" />
                <Area type="monotone" dataKey="stress" stroke="#037dd6" fillOpacity={1} fill="url(#colorStress)" name="Stress Score" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stress Game Dialog */}
      <StressGame isOpen={gameOpen} onClose={() => setGameOpen(false)} />

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
              <FormField
                control={academicForm.control}
                name="cgpa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current CGPA (0-10)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={academicForm.control}
                name="attendancePercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attendance %</FormLabel>
                    <FormControl><Input type="number" step="1" {...field} /></FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={academicForm.control}
                  name="backlogs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backlogs</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={academicForm.control}
                  name="studyHoursPerDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Study Hrs/Day</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                    </FormItem>
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
            <CardDescription>Rate how strongly you agree with the following statements (1-5)</CardDescription>
          </DialogHeader>
          <Form {...stressForm}>
            <form onSubmit={stressForm.handleSubmit((data) => {
              const formattedData = Object.entries(data).reduce((acc, [k, v]) => ({...acc, [k]: Number(v)}), {});
              submitStress.mutate(formattedData, { onSuccess: () => setStressDialogOpen(false) });
            })} className="space-y-6">
              {stressQuestions.map((q) => (
                <FormField
                  key={q.id}
                  control={stressForm.control}
                  name={q.id}
                  render={({ field }) => (
                    <FormItem className="space-y-3 border-b border-border pb-4 last:border-0">
                      <FormLabel className="text-base">{q.text}</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex justify-between"
                        >
                          {[1, 2, 3, 4, 5].map((val) => (
                            <FormItem key={val} className="flex flex-col items-center space-y-0 cursor-pointer">
                              <FormControl>
                                <RadioGroupItem value={val.toString()} />
                              </FormControl>
                              <Label className="font-normal text-xs text-muted-foreground mt-1">{val}</Label>
                            </FormItem>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Disagree</span>
                        <span>Agree</span>
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
