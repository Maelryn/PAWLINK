"use client";

import { RequireAuth } from "@/components/layout/RequireAuth";
import { ReportFlow } from "@/components/report/ReportFlow";

export default function ReportPage() {
  return (
    <RequireAuth area="report">
      <ReportFlow />
    </RequireAuth>
  );
}
