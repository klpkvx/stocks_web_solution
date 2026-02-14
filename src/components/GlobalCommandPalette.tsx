import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { parseCommand } from "@/lib/nlp";
import { useFeatureFlags } from "@/lib/useFeatureFlags";
import { navigateToTicker } from "@/lib/stockNavigation";

type QuickCommand = {
  id: string;
  label: string;
  run: () => void;
};

export default function GlobalCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const flags = useFeatureFlags();

  const quickCommands = useMemo<QuickCommand[]>(
    () => [
      { id: "cmd-dashboard", label: "Open dashboard", run: () => void router.push("/") },
      { id: "cmd-portfolio", label: "Open portfolio", run: () => void router.push("/portfolio") },
      { id: "cmd-news", label: "Open news", run: () => void router.push("/news") },
      { id: "cmd-strategy", label: "Open strategy", run: () => void router.push("/strategy") },
      { id: "cmd-alerts", label: "Open alerts", run: () => void router.push("/alerts") }
    ],
    [router]
  );

  useEffect(() => {
    if (!flags.globalCommandPalette) return;
    const onKey = (event: KeyboardEvent) => {
      const isOpenHotkey = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isOpenHotkey) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flags.globalCommandPalette]);

  function runParsedCommand(input: string) {
    const action = parseCommand(input);
    if (action.type === "open" && action.symbols[0]) {
      void navigateToTicker(router, action.symbols[0]);
      return;
    }
    if (action.type === "compare") {
      const symbols = action.symbols.join(",");
      void router.push(symbols ? `/compare?symbols=${encodeURIComponent(symbols)}` : "/compare");
      return;
    }
    if (action.type === "news") {
      const symbol = action.symbols[0];
      void router.push(symbol ? `/news?symbol=${encodeURIComponent(symbol)}` : "/news");
      return;
    }
    if (action.type === "strategy") {
      const symbol = action.symbols[0];
      void router.push(symbol ? `/strategy?symbol=${encodeURIComponent(symbol)}` : "/strategy");
      return;
    }
    if (action.type === "alerts") {
      void router.push("/alerts");
      return;
    }
    if (action.type === "search" && action.query) {
      void navigateToTicker(router, action.query);
    }
  }

  if (!flags.globalCommandPalette) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[170] rounded-full border border-white/15 bg-night/80 px-3 py-2 text-xs text-muted backdrop-blur transition hover:border-white/40 hover:text-ink"
        aria-label="Open command palette"
      >
        Cmd/Ctrl + K
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="mx-auto mt-20 w-full max-w-2xl rounded-2xl border border-white/10 bg-night/95 p-4 shadow-card">
            <input
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Type command (e.g. AAPL, compare AAPL vs MSFT)"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-ink outline-none focus:border-glow/50"
              onKeyDown={(event) => {
                if (event.key === "Enter" && value.trim()) {
                  event.preventDefault();
                  runParsedCommand(value.trim());
                  setValue("");
                  setOpen(false);
                }
              }}
            />
            <div className="mt-3 grid gap-2">
              {quickCommands.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-xl border border-white/10 px-3 py-2 text-left text-sm text-muted transition hover:border-white/30 hover:text-ink"
                  onClick={() => {
                    item.run();
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
