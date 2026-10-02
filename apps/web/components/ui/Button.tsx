"use client";

import Link from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "filled" | "tinted" | "glass" | "plain" | "dark" | "danger" | "white";
type Size = "sm" | "md" | "lg" | "icon" | "icon-lg";

const variants: Record<Variant, string> = {
  filled: "bg-accent text-white shadow-[0_8px_24px_-8px_var(--accent)] hover:brightness-110",
  tinted: "bg-accent-soft text-accent hover:bg-accent/20",
  glass: "glass text-label hover:bg-white/70 dark:hover:bg-white/10",
  plain: "text-accent hover:bg-accent-soft",
  dark: "bg-label text-bg hover:opacity-90",
  danger: "bg-urgent text-white shadow-[0_8px_24px_-8px_var(--urgent)] hover:brightness-110",
  white: "bg-white text-[#1d1d1f] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.3)] hover:bg-white/90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[14px] gap-1.5 rounded-full",
  md: "h-11 px-5 text-[15px] gap-2 rounded-full",
  lg: "h-14 px-7 text-[17px] gap-2.5 rounded-full",
  icon: "h-10 w-10 rounded-full",
  "icon-lg": "h-12 w-12 rounded-full",
};

const spring = { type: "spring", stiffness: 500, damping: 30 } as const;

export interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "filled", size = "md", className, children, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={spring}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] transition-[background,filter,opacity] duration-200 disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
});

const MotionLink = motion.create(Link);

export function ButtonLink({
  href,
  variant = "filled",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <MotionLink
      href={href}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      transition={spring}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em] transition-[background,filter,opacity] duration-200",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </MotionLink>
  );
}
