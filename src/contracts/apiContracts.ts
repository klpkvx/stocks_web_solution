import { z } from "zod";

export const sentimentLabelSchema = z.enum(["bullish", "bearish", "neutral"]);

export const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  currency: z.string(),
  price: z.number().nullable(),
  change: z.number().nullable(),
  percentChange: z.number().nullable(),
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  volume: z.number().nullable(),
  previousClose: z.number().nullable(),
  timestamp: z.string().nullable()
});

export const newsArticleSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string(),
  source: z.string(),
  publishedAt: z.string(),
  sentiment: z.number().optional(),
  imageUrl: z.string().optional(),
  content: z.string().optional()
});

export const dashboardPayloadSchema = z
  .object({
    quotes: z.array(quoteSchema),
    news: z
      .object({
        symbol: z.string(),
        articles: z.array(newsArticleSchema),
        sentiment: z.object({
          score: z.number(),
          label: sentimentLabelSchema,
          confidence: z.number()
        }),
        warning: z.string().nullable(),
        expiresIn: z.number()
      })
      .nullable(),
    warnings: z.array(z.string()).optional(),
    expiresIn: z.number().optional(),
    updatedAt: z.string().optional()
  })
  .passthrough();

export const stockPayloadSchema = z
  .object({
    quote: quoteSchema,
    series: z.array(
      z.object({
        time: z.string(),
        open: z.number(),
        high: z.number(),
        low: z.number(),
        close: z.number(),
        volume: z.number()
      })
    ),
    news: z.array(newsArticleSchema),
    sentiment: z.object({
      score: z.number(),
      label: sentimentLabelSchema,
      confidence: z.number()
    }),
    warning: z.string().nullable().optional(),
    secWarning: z.string().nullable().optional(),
    expiresIn: z.number().optional()
  })
  .passthrough();

export const quotesPayloadSchema = z.object({
  quotes: z.array(quoteSchema),
  warning: z.string().optional(),
  stale: z.boolean().optional(),
  expiresIn: z.number().optional()
});

export const tickerItemSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  exchange: z.string(),
  country: z.string(),
  type: z.string(),
  currency: z.string().optional()
});

export const tickersPayloadSchema = z.object({
  tickers: z.array(tickerItemSchema),
  expiresIn: z.number().optional()
});
