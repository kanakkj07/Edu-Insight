import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateGoal, useDeleteGoal } from "@/hooks/use-student";
import { Target, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface Goal {
  id: number;
  title: string;
  target: string | null;
  current: string | null;
  type: string;
  isCompleted: boolean | null;
  deadline: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  goals: Goal[];
}

export function GoalsPanel({ isOpen, onClose, goals = [] }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [type, setType] = useState("custom");
  const createGoal = useCreateGoal();
  const deleteGoal = useDeleteGoal();

  const handleCreate = () => {
    createGoal.mutate(
      { title, target: target ? parseFloat(target) : undefined, type },
      {
        onSuccess: () => {
          setTitle("");
          setTarget("");
          setType("custom");
          setShowForm(false);
        },
      }
    );
  };

  const typeLabel = (t: string) => {
    switch (t) {
      case "cgpa": return "📊 CGPA";
      case "attendance": return "📅 Attendance";
      case "study_hours": return "📚 Study Hours";
      case "stress_reduction": return "🧘 Stress";
      default: return "🎯 Custom";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" /> Goals & Targets
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {goals.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-6">No goals yet. Create your first goal!</p>
          )}

          {goals.map((goal) => {
            const current = parseFloat(goal.current || "0");
            const targetVal = parseFloat(goal.target || "100");
            const pct = targetVal > 0 ? Math.min((current / targetVal) * 100, 100) : 0;

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-lg border ${goal.isCompleted ? "bg-green-500/10 border-green-500/20" : "bg-card border-border"}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {goal.isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      <span className="text-sm font-medium">{goal.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{typeLabel(goal.type)}</span>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    onClick={() => deleteGoal.mutate(goal.id)}
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground" />
                  </Button>
                </div>
                {goal.target && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{current}</span>
                      <span>{targetVal}</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {showForm ? (
          <div className="space-y-3 pt-3 border-t border-border">
            <Input placeholder="Goal title..." value={title} onChange={(e) => setTitle(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cgpa">CGPA</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="study_hours">Study Hours</SelectItem>
                    <SelectItem value="stress_reduction">Stress Reduction</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Target</Label>
                <Input type="number" placeholder="e.g., 8.5" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1" disabled={!title || createGoal.isPending}>
                {createGoal.isPending ? "Creating..." : "Create Goal"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Add Goal
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
