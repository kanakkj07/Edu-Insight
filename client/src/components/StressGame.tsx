import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface StressGameProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StressGame({ isOpen, onClose }: StressGameProps) {
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActive(true);
      const interval = setInterval(() => {
        setPhase((prev) => {
          if (prev === "inhale") return "hold";
          if (prev === "hold") return "exhale";
          return "inhale";
        });
      }, 4000);
      return () => clearInterval(interval);
    } else {
      setActive(false);
      setPhase("inhale");
    }
  }, [isOpen]);

  const getText = () => {
    if (phase === "inhale") return "Breathe In...";
    if (phase === "hold") return "Hold...";
    return "Breathe Out...";
  };

  const getScale = () => {
    if (phase === "inhale") return 1.5;
    if (phase === "hold") return 1.5;
    return 1.0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card/95 border-primary/20 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-2xl text-foreground">
            Box Breathing
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-12 space-y-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              animate={{
                scale: getScale(),
                opacity: 0.8,
              }}
              transition={{ duration: 4, ease: "easeInOut" }}
              className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-secondary blur-xl absolute"
            />
            <motion.div
              animate={{
                scale: getScale(),
              }}
              transition={{ duration: 4, ease: "easeInOut" }}
              className="w-32 h-32 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center z-10 shadow-2xl shadow-primary/30"
            >
            </motion.div>
          </AnimatePresence>
          <motion.p
            key={`text-${phase}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-xl font-medium text-primary-foreground/90 z-20 absolute"
          >
             {/* Center text manually if needed, but flex handles it */}
          </motion.p>
           <h3 className="text-2xl font-bold mt-32 z-20">{getText()}</h3>
        </div>
        <div className="flex justify-center">
          <Button onClick={onClose} variant="secondary" className="w-full">
            I feel better
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
