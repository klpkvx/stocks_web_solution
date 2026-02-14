import { memo, type ReactNode } from "react";

function ModuleCard({
  title,
  subtitle,
  actions,
  children
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="glass content-auto fade-in-up rounded-3xl px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export default memo(ModuleCard);
