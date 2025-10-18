import { motion } from "motion/react";
import { useEffect, useState } from "react";

type Bubble = {
  id: number;
  x: number;
  y: number;
};

export default function BubbleField({ isRecording }: { isRecording: boolean }) {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  const mapDistance = (x: number, y: number) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = centerX - x;
    const dy = centerY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
    const t = 1 - dist / maxDist; // Closer to center → t ~ 1
    return t;
  };

  useEffect(() => {
    if (!isRecording) {
      setBubbles([]);
      return;
    }

    const interval = setInterval(() => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      const bubble: Bubble = { id: Date.now(), x, y };
      setBubbles((prev) => [...prev, bubble]);

      // Remove after max 3s
      setTimeout(() => {
        setBubbles((prev) => prev.filter((b) => b.id !== bubble.id));
      }, 3000);
    }, 200); // spawn every 200ms

    return () => clearInterval(interval);
  }, [isRecording]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {bubbles.map((bubble) => {
        const t = mapDistance(bubble.x, bubble.y);
        const size = 10 + t * 6; // 10px → 40px
        const speed = 1 + t * 2; // slower far, faster near
        const shade = Math.floor(150 + t * 105); // 150→255
        const opacity = 0.3 + t * 0.7; // 0.3 → 1

        return (
          <motion.div
            key={bubble.id}
            initial={{ left: bubble.x, top: bubble.y, opacity: 0 }}
            animate={{
              left: "45%",
              top: "45%",
              opacity: opacity,
              scale: size / 20,
            }}
            transition={{
              duration: 3 / speed,
              ease: "easeInOut",
            }}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              backgroundColor: `rgb(${shade},${shade},${shade})`,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </div>
  );
}
