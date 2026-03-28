import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogStudySession } from "@/hooks/use-student";
import { Play, Pause, RotateCcw, Check } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  totalMinutes?: number;
}

export function PomodoroTimer({ isOpen, onClose, totalMinutes = 0 }: Props) {
  const [duration, setDuration] = useState(25); // default 25 min
  const [timeLeft, setTimeLeft] = useState(25 * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [subject, setSubject] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logSession = useLogStudySession();

  useEffect(() => {
    if (!isOpen) {
      resetTimer();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            setIsRunning(false);
            setIsCompleted(true);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const resetTimer = () => {
    setIsRunning(false);
    setIsCompleted(false);
    setTimeLeft(duration * 60);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  const handleComplete = () => {
    logSession.mutate(
      { duration, subject: subject || undefined },
      {
        onSuccess: () => {
          resetTimer();
          onClose();
        },
      }
    );
  };

  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">⏱ Pomodoro Timer</DialogTitle>
        </DialogHeader>

        {!isRunning && !isCompleted && timeLeft === duration * 60 && (
          <div className="space-y-3 mb-4">
            <div>
              <Label className="text-sm">Duration (minutes)</Label>
              <div className="flex gap-2 mt-1">
                {[15, 25, 45, 60].map((d) => (
                  <Button
                    key={d}
                    variant={duration === d ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setDuration(d); setTimeLeft(d * 60); }}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-sm">Subject (optional)</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Mathematics"
                className="mt-1"
              />
            </div>
          </div>
        )}

        {/* Circular timer */}
        <div className="flex flex-col items-center py-6">
          <div className="relative w-48 h-48">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              <motion.circle
                cx="100" cy="100" r="90" fill="none"
                stroke={isCompleted ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                initial={false}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.5 }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold font-display">{formatTime(timeLeft)}</span>
              <span className="text-xs text-muted-foreground mt-1">
                {isCompleted ? "Done! 🎉" : isRunning ? "Focus..." : "Ready"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-center">
          {!isCompleted ? (
            <>
              <Button
                size="lg"
                onClick={() => setIsRunning(!isRunning)}
                className="w-32"
              >
                {isRunning ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {isRunning ? "Pause" : "Start"}
              </Button>
              <Button size="lg" variant="outline" onClick={resetTimer}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button size="lg" onClick={handleComplete} className="w-full bg-green-600 hover:bg-green-700" disabled={logSession.isPending}>
              <Check className="h-4 w-4 mr-2" />
              {logSession.isPending ? "Logging..." : "Log Session"}
            </Button>
          )}
        </div>

        <div className="text-center mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Total study time: <span className="font-bold text-foreground">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
