import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitMood } from "@/hooks/use-student";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  recentMoods?: { mood: number; note?: string | null; createdAt: string | null }[];
}

const moodEmojis = [
  { value: 1, emoji: "😢", label: "Terrible" },
  { value: 2, emoji: "😟", label: "Bad" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "😊", label: "Good" },
  { value: 5, emoji: "🤩", label: "Amazing" },
];

export function MoodJournal({ isOpen, onClose, recentMoods = [] }: Props) {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const submitMood = useSubmitMood();

  const handleSubmit = () => {
    if (!selectedMood) return;
    submitMood.mutate(
      { mood: selectedMood, note: note || undefined },
      {
        onSuccess: () => {
          setSelectedMood(null);
          setNote("");
          onClose();
        },
      }
    );
  };

  // Build a simple heatmap from last 30 days
  const last30 = [...Array(30)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const dateStr = d.toISOString().split("T")[0];
    const entry = recentMoods.find((m) =>
      m.createdAt && m.createdAt.toString().startsWith(dateStr)
    );
    return { date: dateStr, mood: entry?.mood, day: d.getDate() };
  });

  const moodColor = (mood?: number) => {
    if (!mood) return "bg-muted/30";
    if (mood === 1) return "bg-red-500/60";
    if (mood === 2) return "bg-orange-500/60";
    if (mood === 3) return "bg-yellow-500/60";
    if (mood === 4) return "bg-green-500/60";
    return "bg-emerald-400/80";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">📔 Mood Journal</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">How are you feeling today?</p>

        <div className="flex justify-between py-4">
          {moodEmojis.map((m) => (
            <motion.button
              key={m.value}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setSelectedMood(m.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all cursor-pointer ${
                selectedMood === m.value
                  ? "bg-primary/20 ring-2 ring-primary"
                  : "hover:bg-accent"
              }`}
            >
              <span className="text-3xl">{m.emoji}</span>
              <span className="text-xs text-muted-foreground">{m.label}</span>
            </motion.button>
          ))}
        </div>

        <Textarea
          placeholder="Add a note about your day (optional)..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="resize-none"
          rows={3}
        />

        <Button onClick={handleSubmit} className="w-full" disabled={!selectedMood || submitMood.isPending}>
          {submitMood.isPending ? "Saving..." : "Log Mood"}
        </Button>

        {/* Mood heatmap */}
        {recentMoods.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Last 30 Days</p>
            <div className="grid grid-cols-10 gap-1">
              {last30.map((d, i) => (
                <div
                  key={i}
                  className={`w-full aspect-square rounded-sm ${moodColor(d.mood)} transition-all hover:ring-1 hover:ring-primary`}
                  title={`${d.date}: ${d.mood ? moodEmojis[d.mood - 1]?.label : "No entry"}`}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <span>😢</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((m) => (
                  <div key={m} className={`w-3 h-3 rounded-sm ${moodColor(m)}`} />
                ))}
              </div>
              <span>🤩</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
