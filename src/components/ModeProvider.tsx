import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useStoredState } from "@/lib/useStoredState";

export type UserMode = "beginner" | "pro";

type ModeContextValue = {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
};

const ModeContext = createContext<ModeContextValue | null>(null);

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useStoredState<UserMode>("user-mode", "beginner");

  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within ModeProvider");
  }
  return context;
}
