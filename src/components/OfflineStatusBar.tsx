import { useNetworkStatus } from "@/lib/useNetworkStatus";
import { useFeatureFlags } from "@/lib/useFeatureFlags";

export default function OfflineStatusBar() {
  const online = useNetworkStatus();
  const flags = useFeatureFlags();

  if (!flags.offlineBanner || online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[220] border-b border-amber-300/40 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100 backdrop-blur"
    >
      Offline mode: showing cached market snapshot. Some data may be delayed.
    </div>
  );
}
