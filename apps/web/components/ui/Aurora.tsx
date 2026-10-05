"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/* Living background: big soft color blobs drifting slowly (transform-only = cheap), plus a faint grain.
   Used behind login, the Pro paywall and page headers so nothing feels empty. */
const BLOBS = [
  { c: "#4aa3ff", x: "-10%", y: "-15%", s: "55vmax", d: 22, dx: 60, dy: 40 },
  { c: "#8b6bff", x: "55%", y: "-20%", s: "50vmax", d: 26, dx: -50, dy: 50 },
  { c: "#ff6aa2", x: "60%", y: "55%", s: "48vmax", d: 24, dx: -40, dy: -50 },
  { c: "#3ddc97", x: "-15%", y: "60%", s: "42vmax", d: 28, dx: 50, dy: -30 },
];

export function Aurora({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-0 overflow-hidden", className)} aria-hidden>
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: b.x,
            top: b.y,
            width: b.s,
            height: b.s,
            background: `radial-gradient(circle, ${b.c} 0%, transparent 65%)`,
            opacity: 0.38 * intensity,
            willChange: "transform",
          }}
          animate={reduce ? undefined : { x: [0, b.dx, 0], y: [0, b.dy, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22/></svg>')]" />
    </div>
  );
}
