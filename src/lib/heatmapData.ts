import { buildHeatmapPayload } from "@/lib/heatmap";
import { cached } from "@/lib/serverStore";
import type { HeatmapPayload } from "@/types/heatmap";

const REFRESH_MS = (() => {
  const raw = Number(process.env.HEATMAP_REFRESH_MS || 120000);
  if (!Number.isFinite(raw)) return 120000;
  return Math.max(30_000, raw);
})();

const STALE_MS = (() => {
  const raw = Number(process.env.HEATMAP_STALE_MS || 6 * 60 * 60 * 1000);
  if (!Number.isFinite(raw)) return 6 * 60 * 60 * 1000;
  return Math.max(REFRESH_MS, raw);
})();

const EXPIRES_IN = Math.max(20, Math.min(120, Math.floor(REFRESH_MS / 1000)));

export async function getCachedHeatmapPayload(options: { forceRefresh?: boolean } = {}) {
  const data = await cached(
    "heatmap:global",
    async () => buildHeatmapPayload(),
    {
      ttlMs: REFRESH_MS,
      staleTtlMs: STALE_MS,
      staleIfError: true,
      forceRefresh: options.forceRefresh,
      backgroundRevalidate: true,
      l2: true
    }
  );

  return {
    ...(data as HeatmapPayload),
    expiresIn: EXPIRES_IN
  };
}
