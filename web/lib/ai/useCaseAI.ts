"use client";

import { useMemo } from "react";
import { useI18n } from "../i18n";
import type { Case } from "../types";
import { analyze } from "./analyze";

/** AI analysis for a case: the stored one if present, otherwise computed (mock) in the current language. */
export function useCaseAI(c: Case | undefined | null) {
  const { t } = useI18n();
  return useMemo(() => {
    if (!c) return null;
    if (c.ai) return c.ai;
    return analyze(
      { species: c.species, count: c.count, description: c.description, conditionTags: c.conditionTags, location: c.location, baseline: c.triage },
      t,
    );
  }, [c, t]);
}
