import type { MarketInsights } from "@/lib/insights";
import type { Quote } from "@/lib/twelveData";

export type Persona = {
  id: string;
  name: string;
  vibe: string;
  style: string;
  bias: "value" | "growth" | "macro" | "future";
};

export const PERSONAS: Persona[] = [
  {
    id: "buffett",
    name: "Warren Buffett",
    vibe: "Patient value investor",
    style: "Calm, grounded, long-term",
    bias: "value"
  },
  {
    id: "wood",
    name: "Cathie Wood",
    vibe: "Disruptive growth optimist",
    style: "Bold, visionary, high conviction",
    bias: "growth"
  },
  {
    id: "future",
    name: "Future You",
    vibe: "Personal accountability",
    style: "Reflective, pragmatic, risk-aware",
    bias: "future"
  },
  {
    id: "macro",
    name: "Macro Strategist",
    vibe: "Rates and cycles",
    style: "Analytical, macro-driven",
    bias: "macro"
  }
];

export type DebateMessage = {
  persona: Persona;
  text: string;
};

export function buildDebate(
  personaList: Persona[],
  inputs: {
    symbol: string;
    action: "buy" | "sell" | "hold";
    size: number;
    horizon: "short" | "long";
  },
  data: {
    quote?: Quote | null;
    sentimentScore?: number;
    insights?: MarketInsights | null;
  }
): DebateMessage[] {
  const { symbol, action, size, horizon } = inputs;
  const sentiment = data.sentimentScore ?? 0;
  const momentum = data.insights?.momentum ?? 0;
  const volatility = data.insights?.volatility ?? 0;

  return personaList.map((persona) => {
    let text = "";
    const actionVerb = action === "buy" ? "adding" : action === "sell" ? "reducing" : "holding";

    if (persona.bias === "value") {
      text = `${symbol} feels like a ${horizon}-term decision. Focus on fundamentals and margin of safety before ${actionVerb} ${size}%.`;
      if (sentiment < -0.2) {
        text += " Negative sentiment can create opportunity if intrinsic value holds.";
      }
    }

    if (persona.bias === "growth") {
      text = `${symbol} thrives on momentum. If the story is intact, ${actionVerb} ${size}% could capture upside.`;
      if (momentum < 0) {
        text += " Momentum is fading though, so size in carefully.";
      }
    }

    if (persona.bias === "macro") {
      text = `${symbol} sits inside a broader macro regime. Watch rates, liquidity, and sector rotation before ${actionVerb}.`;
      if (volatility > 0.4) {
        text += " Volatility is elevated, so risk controls matter.";
      }
    }

    if (persona.bias === "future") {
      text = `Future-you check: does ${actionVerb} ${size}% align with your risk plan? If not, reduce size or wait.`;
      if (sentiment > 0.2) {
        text += " Positive sentiment can help, but don't chase it.";
      }
    }

    return { persona, text };
  });
}
