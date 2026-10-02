"use client";

import { Suspense } from "react";
import { MapExperience } from "@/components/map/MapExperience";

export default function MapPage() {
  return (
    <Suspense>
      <MapExperience />
    </Suspense>
  );
}
