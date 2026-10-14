"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wraps a person's avatar / name so it opens their public profile (like Instagram). */
export function ProfileLink({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={`/users/${id}`} onClick={(e) => e.stopPropagation()} className={cn("transition-opacity hover:opacity-80 active:opacity-60", className)}>
      {children}
    </Link>
  );
}
