import { cn } from "@/lib/utils";

/** Cut-out pet photo that pops out of a colored circle (the head goes over the top edge). */
export function PetSticker({
  src,
  size = 120,
  bg = "#d9ecff",
  className,
  scale = 1.18,
  ring = true,
}: {
  src: string;
  size?: number;
  bg?: string;
  className?: string;
  /** how much bigger than the circle the photo is (bigger = pops out more) */
  scale?: number;
  ring?: boolean;
}) {
  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <div className={cn("absolute inset-0 rounded-full", ring && "ring-4 ring-white dark:ring-white/10")} style={{ background: bg }} />
      <div
        className="absolute inset-0"
        // clip only the bottom half to the circle: the top of the photo can leave the frame
        style={{ clipPath: "inset(-80% -20% 0 -20% round 0 0 50% 50%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute bottom-0 left-1/2 max-w-none -translate-x-1/2 select-none object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.18)]"
          style={{ height: `${scale * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Pet cut-outs with their brand pastel, reused across the app. */
export const PETS = {
  beagle: { src: "/pets/dog-beagle.webp", bg: "#cfe5ff" },
  tabby: { src: "/pets/cat-tabby-2.webp", bg: "#ffd8e4" },
  frenchie: { src: "/pets/dog-frenchie.webp", bg: "#ffe9a8" },
  sheep: { src: "/pets/sheep-1.webp", bg: "#cdeedd" },
  kitten: { src: "/pets/cat-kitten.webp", bg: "#e3dcff" },
  goat: { src: "/pets/goat-1.webp", bg: "#ffdcc2" },
  jack: { src: "/pets/dog-jack.webp", bg: "#c9eefc" },
  ginger: { src: "/pets/cat-ginger.webp", bg: "#ffe4c4" },
  pug: { src: "/pets/dog-pug.webp", bg: "#fff1b8" },
  horse: { src: "/pets/horse-1.webp", bg: "#e6f4d7" },
  cow: { src: "/pets/cow-2.webp", bg: "#e8efff" },
  white: { src: "/pets/dog-white.webp", bg: "#dff3ff" },
  bw: { src: "/pets/cat-bw.webp", bg: "#f1e6ff" },
  aussie: { src: "/pets/dog-aussie.webp", bg: "#ffe0d6" },
  puppy: { src: "/pets/dog-puppy.webp", bg: "#fde2ff" },
} as const;
