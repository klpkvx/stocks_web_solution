export function LoadingSkeleton({
  className = ""
}: {
  className?: string;
}) {
  return <div className={`loading-shimmer rounded-xl ${className}`} aria-hidden />;
}

export function LoadingDots({
  label = "Loading"
}: {
  label?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2 text-xs text-muted" role="status" aria-live="polite">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-glow [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-lavender [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ember" />
      </span>
    </div>
  );
}
