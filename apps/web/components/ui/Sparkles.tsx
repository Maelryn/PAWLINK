"use client";

import { motion } from "motion/react";
import { useMemo } from "react";
/** Deterministic pseudo-random (same on server and client, pure during render). */
const rnd = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  // rounded: Math.sin differs in the last digits between Node and browsers, which broke hydration
  return Math.round((x - Math.floor(x)) * 1000) / 1000;
};

/* Twinkling 4-point stars scattered over an area. Positions are generated on the client
   (after mount) so server and client HTML stay identical. */

function Star({ size, color }: { size: number; color: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path fill={color} d="M12 0c.6 5.6 3.4 9.4 12 12-8.6 2.6-11.4 6.4-12 12-.6-5.6-3.4-9.4-12-12 8.6-2.6 11.4-6.4 12-12Z" />
    </svg>
  );
}

export function Sparkles({ count = 18, colors = ["#ffffff", "#ffe48a", "#ffd0f0"], className }: { count?: number; colors?: string[]; className?: string }) {
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        let k = i * 7;
        const R = () => rnd(++k);
        return {
        x: R() * 100,
        y: R() * 100,
        s: 6 + R() * 14,
        d: R() * 3,
        t: 1.6 + R() * 2.2,
        c: colors[i % colors.length],
        r: R() * 1.5,
      };
      }),
    [count, colors],
  );
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      {stars.map((st, i) => (
        <motion.span
          key={i}
          className="absolute"
          style={{ left: `${st.x}%`, top: `${st.y}%`, filter: `drop-shadow(0 0 6px ${st.c})` }}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
          transition={{ duration: st.t, delay: st.d, repeat: Infinity, repeatDelay: st.r, ease: "easeInOut" }}
        >
          <Star size={st.s} color={st.c} />
        </motion.span>
      ))}
    </div>
  );
}

/** One-shot burst of stars + confetti from the center (used when Pro is activated). */
export function Burst({ count = 36 }: { count?: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        let k = i * 13 + 5;
        const R = () => rnd(++k);
        const a = (i / count) * Math.PI * 2 + R() * 0.3;
        const r = 120 + R() * 220;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r - 40, rot: R() * 540, c: ["#ffd60a", "#ff375f", "#5e5ce6", "#30d158", "#0a84ff", "#ffffff"][i % 6], star: i % 3 === 0 };
      }),
    [count],
  );
  return (
    <div className="pointer-events-none fixed left-1/2 top-1/2 z-[80]">
      {parts.map((p, i) => (
        <motion.span
          key={i}
          className="absolute"
          initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 160], opacity: [1, 1, 0], scale: 1, rotate: p.rot }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        >
          {p.star ? <Star size={16} color={p.c} /> : <span className="block h-3 w-1.5 rounded-sm" style={{ background: p.c }} />}
        </motion.span>
      ))}
    </div>
  );
}
