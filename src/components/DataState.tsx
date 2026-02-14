import type { ReactNode } from "react";
import { LoadingDots, LoadingSkeleton } from "@/components/LoadingSkeleton";

export default function DataState({
  loading,
  error,
  empty,
  loadingLabel = "Loading",
  emptyLabel = "No data",
  children
}: {
  loading: boolean;
  error?: string | null;
  empty: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingDots label={loadingLabel} />
        <LoadingSkeleton className="h-28 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-ember">{error}</p>;
  }

  if (empty) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return <>{children}</>;
}
