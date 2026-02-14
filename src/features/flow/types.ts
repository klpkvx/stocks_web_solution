export type DipAlertRule = {
  id: string;
  symbol: string;
  anchorPrice?: number | null;
  dropPercent: number;
  maxSpend: number;
  autoBuy: boolean;
  notify: boolean;
  createdAt: string;
  triggeredAt?: string;
};

export type CopyAllocation = {
  id: string;
  traderId: string;
  amount: number;
  createdAt: string;
};

export type RoundUpTxn = {
  id: string;
  label: string;
  amount: number;
  roundUp: number;
  multiplier: number;
  invested: number;
  timestamp: string;
  symbol: string;
};

export type DreamContest = {
  id: string;
  name: string;
  targets: { symbol: string; shares: number }[];
  deposits: number;
  startedAt: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  timestamp: string;
};

export const DEFAULT_WATCHLIST = ["AAPL", "MSFT", "GOOGL"];

export const DEFAULT_DREAM: DreamContest = {
  id: "dream-1",
  name: "Dream Tech Trio",
  targets: [
    { symbol: "AAPL", shares: 1 },
    { symbol: "NVDA", shares: 1 },
    { symbol: "TSLA", shares: 1 }
  ],
  deposits: 0,
  startedAt: "2024-06-01T00:00:00.000Z"
};
