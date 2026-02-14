import Sentiment from "sentiment";

const analyzer = new Sentiment();

export type SentimentResult = {
  score: number;
  normalized: number;
};

export type SentimentSummary = {
  score: number;
  label: "bullish" | "bearish" | "neutral";
  confidence: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function analyzeSentiment(text: string): SentimentResult {
  const result = analyzer.analyze(text || "");
  const normalized = clamp(result.score / 10, -1, 1);
  return { score: result.score, normalized };
}

export function summarizeSentiment(values: number[]): SentimentSummary {
  if (!values.length) {
    return { score: 0, label: "neutral", confidence: 0 };
  }

  const score = values.reduce((acc, value) => acc + value, 0) / values.length;
  const label = score > 0.2 ? "bullish" : score < -0.2 ? "bearish" : "neutral";
  const confidence = clamp(Math.abs(score) / 0.6, 0, 1);

  return { score, label, confidence };
}
