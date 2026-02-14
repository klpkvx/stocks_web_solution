import type { Quote } from "@/lib/twelveData";

export type Holding = {
  id: string;
  symbol: string;
  shares: number;
  costBasis: number;
};

export type PortfolioSummary = {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
};

export function calculatePortfolio(
  holdings: Holding[],
  quotes: Quote[]
): PortfolioSummary {
  const quoteMap = new Map(quotes.map((quote) => [quote.symbol, quote]));

  let totalValue = 0;
  let totalCost = 0;

  holdings.forEach((holding) => {
    const quote = quoteMap.get(holding.symbol);
    const price = quote?.price ?? holding.costBasis;
    totalValue += price * holding.shares;
    totalCost += holding.costBasis * holding.shares;
  });

  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost ? (totalPnL / totalCost) * 100 : 0;

  return { totalValue, totalCost, totalPnL, totalPnLPercent };
}
