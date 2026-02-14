import Link from "next/link";
import { memo } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { Quote } from "@/lib/twelveData";
import StockIcon from "@/components/StockIcon";

function WatchlistCard({ quote }: { quote: Quote }) {
  const isPositive = (quote.change || 0) >= 0;
  return (
    <Link
      href={`/stock/${quote.symbol}`}
      title={`${quote.symbol} - ${quote.name}`}
      className="glass group flex items-center justify-between gap-4 rounded-2xl px-5 py-4 transition hover:-translate-y-1 hover:border-white/20"
    >
      <div className="flex items-center gap-3">
        <StockIcon symbol={quote.symbol} />
        <div>
          <p className="text-lg font-semibold text-ink">{quote.symbol}</p>
          <p className="text-xs text-muted">{quote.name}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold text-ink">
          {formatCurrency(quote.price, quote.currency)}
        </p>
        <p
          className={`text-xs font-semibold ${
            isPositive ? "text-neon" : "text-ember"
          }`}
        >
          {formatPercent(quote.percentChange)}
        </p>
      </div>
    </Link>
  );
}

export default memo(WatchlistCard);
