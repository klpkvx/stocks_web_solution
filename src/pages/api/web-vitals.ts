import type { NextApiRequest, NextApiResponse } from "next";
import { parseBody } from "@/lib/apiValidation";
import { webVitalsBodySchema } from "@/contracts/requestContracts";

const METRICS: Array<{
  id: string;
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
  at: number;
}> = [];

const MAX_METRICS = 500;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    const payload = parseBody(req, res, webVitalsBodySchema);
    if (!payload) return;

    METRICS.push({
      id: payload.id,
      name: payload.name,
      value: payload.value,
      rating: payload.rating,
      navigationType: payload.navigationType,
      at: Date.now()
    });

    if (METRICS.length > MAX_METRICS) {
      METRICS.splice(0, METRICS.length - MAX_METRICS);
    }
    return res.status(204).end();
  }

  if (req.method === "GET") {
    const grouped = METRICS.reduce<Record<string, number[]>>((acc, metric) => {
      acc[metric.name] = acc[metric.name] || [];
      acc[metric.name].push(metric.value);
      return acc;
    }, {});

    const summary = Object.entries(grouped).map(([name, values]) => ({
      name,
      count: values.length,
      avg: values.reduce((acc, value) => acc + value, 0) / values.length
    }));
    return res.status(200).json({ summary, count: METRICS.length });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
