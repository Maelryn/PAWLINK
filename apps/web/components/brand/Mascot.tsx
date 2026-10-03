"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/* "Miel", the PawLink cat (from the brand lockup). Peeks up, breathes, blinks, tilts its head.
   Eye positions are in % of the image so the eyelids line up at any size. */
const EYES = [
  { x: 44.6, y: 57.9, w: 15, h: 14 },
  { x: 88.1, y: 48.9, w: 13, h: 13 },
];

export function Mascot({ size = 140, className, peek = false, delay = 0 }: { size?: number; className?: string; peek?: boolean; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("relative select-none", className)}
      style={{ width: size, height: size * (178 / 168) }}
      initial={peek ? { y: "70%", opacity: 0 } : { scale: 0.6, opacity: 0 }}
      animate={peek ? { y: "0%", opacity: 1 } : { scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 160, damping: 13, delay }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformOrigin: "50% 90%" }}
        animate={reduce ? undefined : { y: [0, -3, 0], rotate: [0, -3, 0, 2, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: delay + 0.8 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mascot-cat.png" alt="" draggable={false} className="h-full w-full drop-shadow-[0_12px_18px_rgba(200,100,20,0.28)]" />
        {!reduce &&
          EYES.map((e, i) => (
            <motion.span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${e.x - e.w / 2}%`,
                top: `${e.y - e.h / 2}%`,
                width: `${e.w}%`,
                height: `${e.h}%`,
                background: "radial-gradient(circle at 50% 30%, #ffc072, #f39a3c)",
                transformOrigin: "50% 0%",
              }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: [0, 0, 1, 0, 0] }}
              transition={{ duration: 4.2, times: [0, 0.9, 0.94, 0.98, 1], repeat: Infinity, delay: delay + 1.2 }}
            />
          ))}
      </motion.div>
    </motion.div>
  );
}
