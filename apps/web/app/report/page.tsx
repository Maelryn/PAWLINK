"use client";

import { GeoGate } from "@/components/layout/GeoGate";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { ReportFlow } from "@/components/report/ReportFlow";

export default function ReportPage() {
  return (
    <RequireAuth area="report">
      <GeoGate>
        <ReportFlow />
      </GeoGate>
    </RequireAuth>
  );
}
