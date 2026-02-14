import type { Quote } from "@/lib/twelveData";

export type AlertCondition =
  | "above"
  | "below"
  | "percentAbove"
  | "percentBelow";

export type AlertRule = {
  id: string;
  symbol: string;
  condition: AlertCondition;
  value: number;
  createdAt: string;
  triggeredAt?: string;
};

export type AlertStatus = {
  triggered: boolean;
  message: string;
};

export function evaluateAlert(rule: AlertRule, quote: Quote | undefined): AlertStatus {
  if (!quote || quote.price === null || quote.percentChange === null) {
    return { triggered: false, message: "No live price" };
  }

  const price = quote.price;
  const pct = quote.percentChange;

  switch (rule.condition) {
    case "above":
      return {
        triggered: price >= rule.value,
        message: `Price ${price.toFixed(2)} above ${rule.value}`
      };
    case "below":
      return {
        triggered: price <= rule.value,
        message: `Price ${price.toFixed(2)} below ${rule.value}`
      };
    case "percentAbove":
      return {
        triggered: pct >= rule.value,
        message: `Change ${pct.toFixed(2)}% above ${rule.value}%`
      };
    case "percentBelow":
      return {
        triggered: pct <= rule.value,
        message: `Change ${pct.toFixed(2)}% below ${rule.value}%`
      };
    default:
      return { triggered: false, message: "Unknown rule" };
  }
}
