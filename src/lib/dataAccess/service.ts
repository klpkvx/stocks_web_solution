import { getCachedHeatmapPayload } from "@/lib/heatmapData";
import { getCachedNewsPayload } from "@/lib/newsData";
import { getCachedQuotesPayload } from "@/lib/quotesData";
import { getRecentFilings, buildWhisperSummary } from "@/lib/sec";
import { getTimeSeries } from "@/lib/twelveData";
import { getTickerSearchPayload, warmTickerSearchCache } from "@/lib/tickerData";

export type DataAccessContext = {
  forceRefresh?: boolean;
};

export const dataAccess = {
  async dashboard(
    symbols: string[],
    options: {
      includeNews: boolean;
      includeHeatmap: boolean;
      newsSymbol: string;
      forceRefresh?: boolean;
    }
  ) {
    const [quotes, news, heatmap] = await Promise.all([
      getCachedQuotesPayload(symbols, { forceRefresh: options.forceRefresh }),
      options.includeNews
        ? getCachedNewsPayload(options.newsSymbol, { forceRefresh: options.forceRefresh })
        : Promise.resolve(null),
      options.includeHeatmap
        ? getCachedHeatmapPayload({ forceRefresh: options.forceRefresh })
        : Promise.resolve(null)
    ]);

    return { quotes, news, heatmap };
  },

  quotes(symbols: string[], ctx: DataAccessContext = {}) {
    return getCachedQuotesPayload(symbols, { forceRefresh: ctx.forceRefresh });
  },

  news(symbol: string, ctx: DataAccessContext & { from?: string; to?: string } = {}) {
    return getCachedNewsPayload(symbol, {
      from: ctx.from,
      to: ctx.to,
      forceRefresh: ctx.forceRefresh
    });
  },

  heatmap(ctx: DataAccessContext = {}) {
    return getCachedHeatmapPayload({ forceRefresh: ctx.forceRefresh });
  },

  sec(symbol: string, ctx: DataAccessContext = {}) {
    return getRecentFilings(symbol).then(({ filings }) => ({
      symbol,
      filings: filings.slice(0, 6),
      summary: buildWhisperSummary(filings)
    }));
  },

  timeSeries(symbol: string, interval = "1day") {
    return getTimeSeries(symbol, interval);
  },

  tickerSearch(query: string, limit = 12, ctx: DataAccessContext = {}) {
    return getTickerSearchPayload(query, limit, { forceRefresh: ctx.forceRefresh });
  },

  warmTickers(symbols: string[]) {
    return warmTickerSearchCache(symbols);
  }
};
