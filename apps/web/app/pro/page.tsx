"use client";

import { useRouter } from "next/navigation";
import { Paywall } from "@/components/pro/Paywall";

/** /pro: the paywall as a page (full screen on phones, centered card on desktop). */
export default function ProPage() {
  const router = useRouter();
  const close = () => (window.history.length > 1 ? router.back() : router.push("/"));
  return (
    <div className="flex h-[100svh] items-center justify-center bg-[linear-gradient(160deg,#dbe9ff,#ece3ff_50%,#ffe1ec)] dark:bg-[linear-gradient(160deg,#0b1830,#1a1236_50%,#2a0f1f)]">
      <div className="h-full w-full overflow-hidden md:h-[min(760px,92svh)] md:w-[430px] md:rounded-[38px] md:shadow-[0_40px_100px_-30px_rgba(60,40,140,0.6)]">
        <Paywall onClose={close} />
      </div>
    </div>
  );
}
