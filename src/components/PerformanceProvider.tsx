import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type PerformanceMode = "auto" | "quality" | "performance";
type PerformanceContextValue = {
  mode: PerformanceMode;
  reducedEffects: boolean;
  setMode: (mode: PerformanceMode) => void;
};

const STORAGE_KEY = "performance-mode";
const PerformanceContext = createContext<PerformanceContextValue | null>(null);

function detectLowPowerClient() {
  if (typeof window === "undefined") return false;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowCpu = typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 8) <= 4;
  const lowMemory =
    typeof (navigator as any)?.deviceMemory === "number" &&
    Number((navigator as any).deviceMemory) <= 4;
  return reducedMotion || lowCpu || lowMemory;
}

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PerformanceMode>("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "auto" || saved === "quality" || saved === "performance") {
      setMode(saved);
    }
    setReady(true);
  }, []);

  const reducedEffects = useMemo(() => {
    if (!ready) return false;
    if (mode === "performance") return true;
    if (mode === "quality") return false;
    return detectLowPowerClient();
  }, [mode, ready]);

  useEffect(() => {
    if (!ready || typeof document === "undefined") return;
    document.documentElement.setAttribute(
      "data-performance",
      reducedEffects ? "performance" : "quality"
    );
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
  }, [mode, ready, reducedEffects]);

  const value = useMemo(
    () => ({
      mode,
      reducedEffects,
      setMode
    }),
    [mode, reducedEffects]
  );

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error("usePerformance must be used within PerformanceProvider");
  }
  return context;
}
