import { useId } from "react";
import { cn } from "@/lib/utils";

/** Paw whose main pad is a location pin, with a "link" dot. Uses currentColor. */
export const MARK_PATH =
  "M50 90C43.6 82 31.5 72.2 31.5 60.5A18.5 18.5 0 1 1 68.5 60.5C68.5 72.2 56.4 82 50 90ZM43 60.5a7 7 0 1 0 14 0a7 7 0 1 0-14 0Z";

export const TOES = [
  { cx: 23.5, cy: 41, rx: 7.4, ry: 9.4, rot: -26 },
  { cx: 39, cy: 25.5, rx: 8, ry: 10.4, rot: -9 },
  { cx: 61, cy: 25.5, rx: 8, ry: 10.4, rot: 9 },
  { cx: 76.5, cy: 41, rx: 7.4, ry: 9.4, rot: 26 },
];

export function LogoMark({ className, title = "PawLink" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label={title} fill="currentColor">
      <path d={MARK_PATH} fillRule="evenodd" />
      {TOES.map((t, i) => (
        <ellipse key={i} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} transform={`rotate(${t.rot} ${t.cx} ${t.cy})`} />
      ))}
    </svg>
  );
}

/** iOS-style app icon: squircle, layered gradient, glossy white mark. */
export function AppIcon({ className, glow = false }: { className?: string; glow?: boolean }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 120" className={cn("overflow-visible", className)} role="img" aria-label="PawLink">
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#3aa0ff" />
          <stop offset="0.55" stopColor="#3b6cf6" />
          <stop offset="1" stopColor="#6a4cf0" />
        </linearGradient>
        <radialGradient id={`gl${uid}`} cx="0.82" cy="0.95" r="0.7">
          <stop offset="0" stopColor="#ff5b8a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ff5b8a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`hl${uid}`} cx="0.3" cy="0.05" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`mk${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e6edff" />
        </linearGradient>
        <filter id={`sh${uid}`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="2.5" stdDeviation="2.5" floodColor="#1b2a8a" floodOpacity="0.35" />
        </filter>
        <filter id={`og${uid}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      {glow && <rect x="14" y="20" width="92" height="92" rx="26" fill={`url(#bg${uid})`} opacity="0.55" filter={`url(#og${uid})`} />}
      <rect x="4" y="4" width="112" height="112" rx="26.5" fill={`url(#bg${uid})`} />
      <rect x="4" y="4" width="112" height="112" rx="26.5" fill={`url(#gl${uid})`} />
      <rect x="4" y="4" width="112" height="112" rx="26.5" fill={`url(#hl${uid})`} />
      <rect x="4.5" y="4.5" width="111" height="111" rx="26" fill="none" stroke="#fff" strokeOpacity="0.28" />
      <g transform="translate(19 17) scale(0.82)" filter={`url(#sh${uid})`} fill={`url(#mk${uid})`}>
        <path d={MARK_PATH} fillRule="evenodd" />
        {TOES.map((t, i) => (
          <ellipse key={i} cx={t.cx} cy={t.cy} rx={t.rx} ry={t.ry} transform={`rotate(${t.rot} ${t.cx} ${t.cy})`} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-[-0.03em]", className)} dir="ltr">
      <AppIcon className="h-[1.6em] w-[1.6em]" />
      <span>
        Paw<span className="text-accent">Link</span>
      </span>
    </span>
  );
}
