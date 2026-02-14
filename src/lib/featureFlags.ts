type FeatureFlags = {
  unifiedDataLayer: boolean;
  redisL2Cache: boolean;
  globalCommandPalette: boolean;
  offlineBanner: boolean;
  workspacePresets: boolean;
  progressiveCharts: boolean;
  backgroundRevalidate: boolean;
};

const DEFAULT_FLAGS: FeatureFlags = {
  unifiedDataLayer: true,
  redisL2Cache: true,
  globalCommandPalette: true,
  offlineBanner: true,
  workspacePresets: true,
  progressiveCharts: true,
  backgroundRevalidate: true
};

const STORAGE_KEY = "feature-flags-overrides:v1";

function envBool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value === "1" || value.toLowerCase() === "true";
}

export function getServerFeatureFlags(): FeatureFlags {
  return {
    unifiedDataLayer: envBool("FF_UNIFIED_DATA_LAYER", DEFAULT_FLAGS.unifiedDataLayer),
    redisL2Cache: envBool("FF_REDIS_L2_CACHE", DEFAULT_FLAGS.redisL2Cache),
    globalCommandPalette: envBool(
      "FF_GLOBAL_COMMAND_PALETTE",
      DEFAULT_FLAGS.globalCommandPalette
    ),
    offlineBanner: envBool("FF_OFFLINE_BANNER", DEFAULT_FLAGS.offlineBanner),
    workspacePresets: envBool("FF_WORKSPACE_PRESETS", DEFAULT_FLAGS.workspacePresets),
    progressiveCharts: envBool("FF_PROGRESSIVE_CHARTS", DEFAULT_FLAGS.progressiveCharts),
    backgroundRevalidate: envBool(
      "FF_BACKGROUND_REVALIDATE",
      DEFAULT_FLAGS.backgroundRevalidate
    )
  };
}

export function getClientFeatureFlags(): FeatureFlags {
  const fromServer = getServerFeatureFlags();
  if (typeof window === "undefined") {
    return fromServer;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fromServer;
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    return {
      ...fromServer,
      ...parsed
    };
  } catch {
    return fromServer;
  }
}

export function setClientFeatureFlags(overrides: Partial<FeatureFlags>) {
  if (typeof window === "undefined") return;
  const next = { ...getClientFeatureFlags(), ...overrides };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export type { FeatureFlags };
