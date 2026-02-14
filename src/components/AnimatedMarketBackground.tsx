import { usePerformance } from "@/components/PerformanceProvider";

const TICKER_BADGES = [
  { text: "AAPL +1.2%", top: "14%", left: "6%", delay: "0s" },
  { text: "MSFT +0.8%", top: "24%", left: "18%", delay: "2.2s" },
  { text: "NVDA +2.1%", top: "18%", left: "36%", delay: "1.3s" },
  { text: "AMZN -0.4%", top: "28%", left: "54%", delay: "3.1s" },
  { text: "GOOGL +0.6%", top: "20%", left: "73%", delay: "1.8s" },
  { text: "META +1.7%", top: "66%", left: "9%", delay: "0.7s" },
  { text: "TSLA -1.1%", top: "74%", left: "28%", delay: "2.7s" },
  { text: "SPY +0.3%", top: "70%", left: "46%", delay: "1.5s" },
  { text: "QQQ +0.5%", top: "78%", left: "63%", delay: "3.6s" },
  { text: "AVGO +1.4%", top: "68%", left: "80%", delay: "2.9s" }
];

const CHART_LINES = [
  "M0,90 C140,50 300,135 520,80 C760,26 980,120 1280,64",
  "M0,160 C180,120 360,210 610,150 C850,92 1060,220 1280,170",
  "M0,230 C130,200 300,276 520,222 C740,168 970,292 1280,236",
  "M0,300 C160,266 350,345 610,300 C860,248 1080,360 1280,322"
];

export default function AnimatedMarketBackground() {
  const { reducedEffects } = usePerformance();
  const lines = reducedEffects ? CHART_LINES.slice(0, 2) : CHART_LINES;
  const badges = reducedEffects ? TICKER_BADGES.slice(0, 3) : TICKER_BADGES;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(56,189,248,0.22),transparent_38%),radial-gradient(circle_at_82%_2%,rgba(167,139,250,0.16),transparent_42%),radial-gradient(circle_at_82%_84%,rgba(249,115,22,0.14),transparent_46%)]" />

      <div className="market-frame absolute left-1/2 top-1/2 h-[86vh] w-[94vw] -translate-x-1/2 -translate-y-1/2 rounded-[30px] border border-white/10 bg-slate-950/10 backdrop-blur-[1px]">
        <svg
          className="absolute inset-0 h-full w-full opacity-45"
          viewBox="0 0 1280 400"
          preserveAspectRatio="none"
          aria-hidden
        >
          {lines.map((line, index) => (
            <path
              key={line}
              d={line}
              className={`market-line ${reducedEffects ? "market-line-static" : ""}`}
              style={{ animationDelay: `${index * 1.6}s` }}
            />
          ))}
        </svg>

        {badges.map((badge) => (
          <div
            key={badge.text}
            className="market-ticker"
            style={{
              top: badge.top,
              left: badge.left,
              animationDelay: badge.delay
            }}
          >
            {badge.text}
          </div>
        ))}
      </div>
    </div>
  );
}
