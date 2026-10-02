"use client";

import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const spring = { type: "spring", stiffness: 380, damping: 30 } as const;
export const softSpring = { type: "spring", stiffness: 120, damping: 20 } as const;

/** Fade + rise + un-blur when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
  once = true,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-60px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Words of a headline rise one after another. */
export function SplitWords({ text, className, delay = 0, stagger = 0.06 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className="inline-block"
            initial={{ y: "110%", opacity: 0, rotate: 4 }}
            animate={{ y: "0%", opacity: 1, rotate: 0 }}
            transition={{ duration: 0.9, delay: delay + i * stagger, ease: [0.16, 1, 0.3, 1] }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Animated number counter that starts when visible. */
export function CountUp({ to, duration = 2, className, format }: { to: number; duration?: number; className?: string; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setVal(v) });
    return () => c.stop();
  }, [inView, to, duration]);
  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {format ? format(Math.round(val)) : Math.round(val).toLocaleString("fr-FR")}
    </span>
  );
}

/**
 * A 3D character floating in space: gentle bob + mouse parallax + depth blur,
 * like the Animoji around the iOS 16 tile.
 */
export function FloatingEmoji({
  src,
  size,
  x,
  y,
  depth = 1,
  blur = 0,
  delay = 0,
  rotate = 0,
  mouse,
  className,
}: {
  src: string;
  size: number;
  x: string;
  y: string;
  depth?: number;
  blur?: number;
  delay?: number;
  rotate?: number;
  mouse: { x: ReturnType<typeof useMotionValue<number>>; y: ReturnType<typeof useMotionValue<number>> };
  className?: string;
}) {
  // heavily blurred decor never moves: a moving blur filter is re-rendered every frame
  const reduce = useReducedMotion() || blur > 4;
  const tx = useTransform(mouse.x, (v) => (blur > 4 ? 0 : v * 28 * depth));
  const ty = useTransform(mouse.y, (v) => (blur > 4 ? 0 : v * 20 * depth));
  const sx = useSpring(tx, { stiffness: 60, damping: 18 });
  const sy = useSpring(ty, { stiffness: 60, damping: 18 });
  return (
    <motion.div
      className={cn("pointer-events-none absolute", className)}
      style={{ left: x, top: y, x: sx, y: sy, filter: blur ? `blur(${blur}px)` : undefined, zIndex: Math.round(depth * 10), willChange: "transform" }}
      initial={{ opacity: 0, scale: 0.4, rotate: rotate - 20 }}
      animate={{ opacity: 1, scale: 1, rotate }}
      transition={{ type: "spring", stiffness: 90, damping: 14, delay: 0.3 + delay }}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, rotate > 0 ? 3 : -3, 0] }}
        transition={{ duration: 5 + delay * 2, repeat: Infinity, ease: "easeInOut", delay }}
      >
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          priority
          className="select-none drop-shadow-[0_24px_30px_rgba(0,0,0,0.18)]"
          style={{ width: size, height: size }}
        />
      </motion.div>
    </motion.div>
  );
}

/** Tracks normalized mouse position (-1..1) over an element. */
export function useMouseParallax() {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    x.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    y.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  };
  const onMouseLeave = () => {
    x.set(0);
    y.set(0);
  };
  return { mouse: { x, y }, handlers: { onMouseMove, onMouseLeave } };
}

/** Card that tilts slightly toward the cursor. */
export function TiltCard({ children, className, max = 6 }: { children: React.ReactNode; className?: string; max?: number }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sry = useSpring(ry, { stiffness: 200, damping: 20 });
  return (
    <motion.div
      className={className}
      style={{ rotateX: srx, rotateY: sry, transformPerspective: 900 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        ry.set(((e.clientX - r.left) / r.width - 0.5) * max * 2);
        rx.set(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
      }}
      onMouseLeave={() => {
        rx.set(0);
        ry.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}
