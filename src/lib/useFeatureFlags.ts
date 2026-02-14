import { useMemo } from "react";
import { getClientFeatureFlags } from "@/lib/featureFlags";

export function useFeatureFlags() {
  return useMemo(() => getClientFeatureFlags(), []);
}
