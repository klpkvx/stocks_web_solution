import type { NextApiRequest, NextApiResponse } from "next";
import { cached } from "@/lib/serverStore";
import { withApiObservability } from "@/lib/apiObservability";
import { dataAccess } from "@/lib/dataAccess/service";
import { parseQuery } from "@/lib/apiValidation";
import { backtestQuerySchema } from "@/contracts/requestContracts";

const BACKTEST_REFRESH_MS = 10 * 60 * 1000;
const BACKTEST_STALE_MS = 2 * 60 * 60 * 1000;
const BACKTEST_EXPIRES_IN = Math.max(60, Math.floor(BACKTEST_REFRESH_MS / 1000));

function sma(values: number[], period: number) {
  const result: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < period) {
      result.push(NaN);
      continue;
    }
    const window = values.slice(i + 1 - period, i + 1);
    const sum = window.reduce((acc, value) => acc + value, 0);
    result.push(sum / period);
  }
  return result;
}

function maxDrawdown(values: number[]) {
  let peak = values[0] || 1;
  let maxDd = 0;
  values.forEach((value) => {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak;
    if (drawdown > maxDd) maxDd = drawdown;
  });
  return maxDd;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = parseQuery(req, res, backtestQuerySchema);
  if (!query) return;
  const symbol = query.symbol;
  const shortWindow = query.short;
  const longWindow = query.long;

  try {
    const payload = await cached(
      `backtest:${symbol}:${shortWindow}:${longWindow}`,
      async () => {
        const series = await dataAccess.timeSeries(symbol, "1day");
        const closes = series.map((point) => point.close);
        const dates = series.map((point) => point.time);

        const shortSma = sma(closes, shortWindow);
        const longSma = sma(closes, longWindow);

        let position = 0;
        let equity = 1;
        const equityCurve: { time: string; value: number }[] = [];
        let trades = 0;
        let wins = 0;
        let lastEntry = 0;

        for (let i = 1; i < closes.length; i += 1) {
          const shortValue = shortSma[i];
          const longValue = longSma[i];
          const prevClose = closes[i - 1];
          const close = closes[i];

          if (position === 0 && shortValue > longValue) {
            position = 1;
            lastEntry = close;
            trades += 1;
          } else if (position === 1 && shortValue < longValue) {
            position = 0;
            if (close > lastEntry) wins += 1;
          }

          const dailyReturn = prevClose ? (close - prevClose) / prevClose : 0;
          equity *= position ? 1 + dailyReturn : 1;
          equityCurve.push({ time: dates[i], value: equity });
        }

        const totalReturn = equity - 1;
        const winRate = trades ? wins / trades : 0;
        const drawdown = maxDrawdown(equityCurve.map((point) => point.value));

        return {
          symbol,
          shortWindow,
          longWindow,
          equityCurve,
          stats: {
            totalReturn,
            winRate,
            trades,
            maxDrawdown: drawdown
          },
          expiresIn: BACKTEST_EXPIRES_IN
        };
      },
      {
        ttlMs: BACKTEST_REFRESH_MS,
        staleTtlMs: BACKTEST_STALE_MS,
        staleIfError: true,
        backgroundRevalidate: true,
        l2: true
      }
    );

    res.setHeader(
      "Cache-Control",
      `s-maxage=${BACKTEST_EXPIRES_IN}, stale-while-revalidate=${BACKTEST_EXPIRES_IN}`
    );
    return res.status(200).json(payload);
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error?.message || "Failed to backtest" });
  }
}

export default withApiObservability("backtest", handler);
