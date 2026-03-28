import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSimulateRisk } from "@/hooks/use-student";
import { Loader2, TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentData?: { attendance: number; cgpa: number; backlogs: number; stressScore: number };
}

export function WhatIfSimulator({ isOpen, onClose, currentData }: Props) {
  const [attendance, setAttendance] = useState(currentData?.attendance || 75);
  const [cgpa, setCgpa] = useState(currentData?.cgpa || 7);
  const [backlogs, setBacklogs] = useState(currentData?.backlogs || 0);
  const [stressScore, setStressScore] = useState(currentData?.stressScore || 50);
  const simulate = useSimulateRisk();

  const handleSimulate = () => {
    simulate.mutate({ attendance, cgpa, backlogs, stressScore });
  };

  const riskColor = (level: string) => {
    if (level === "Low") return "text-green-400";
    if (level === "Moderate") return "text-yellow-400";
    if (level === "High") return "text-orange-400";
    return "text-red-400";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">🔮 What-If Risk Simulator</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Adjust the sliders to see how changes would affect your risk score.</p>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Attendance</span>
              <span className="font-bold text-primary">{attendance}%</span>
            </div>
            <Slider value={[attendance]} onValueChange={([v]) => setAttendance(v)} min={0} max={100} step={1} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>CGPA</span>
              <span className="font-bold text-primary">{cgpa.toFixed(1)}</span>
            </div>
            <Slider value={[cgpa]} onValueChange={([v]) => setCgpa(v)} min={0} max={10} step={0.1} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Backlogs</span>
              <span className="font-bold text-primary">{backlogs}</span>
            </div>
            <Slider value={[backlogs]} onValueChange={([v]) => setBacklogs(v)} min={0} max={10} step={1} />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Stress Score</span>
              <span className="font-bold text-primary">{stressScore}/100</span>
            </div>
            <Slider value={[stressScore]} onValueChange={([v]) => setStressScore(v)} min={0} max={100} step={1} />
          </div>
        </div>

        <Button onClick={handleSimulate} className="w-full" disabled={simulate.isPending}>
          {simulate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Simulate Risk
        </Button>

        {simulate.data && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="mt-4 glass-card border-l-4" style={{ borderLeftColor: simulate.data.riskLevel === "Low" ? "#22c55e" : simulate.data.riskLevel === "Moderate" ? "#eab308" : simulate.data.riskLevel === "High" ? "#f97316" : "#ef4444" }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Projected Risk</p>
                    <p className={`text-3xl font-bold ${riskColor(simulate.data.riskLevel)}`}>
                      {simulate.data.riskLevel}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Score</p>
                    <p className="text-2xl font-bold">{(simulate.data.riskScore * 100).toFixed(0)}%</p>
                  </div>
                </div>
                {simulate.data.factors?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">Contributing Factors:</p>
                    <div className="flex flex-wrap gap-1">
                      {simulate.data.factors.map((f: string, i: number) => (
                        <span key={i} className="text-xs bg-destructive/20 text-destructive-foreground px-2 py-0.5 rounded">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
