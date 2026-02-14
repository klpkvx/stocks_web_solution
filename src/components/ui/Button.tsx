import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

export default function Button({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  const base =
    "rounded-full px-4 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow/70";
  const tone =
    variant === "primary"
      ? "bg-gradient-to-r from-glow to-lavender text-night"
      : variant === "ghost"
        ? "text-muted hover:text-ink"
        : "border border-white/10 text-muted hover:border-white/30 hover:text-ink";

  return (
    <button className={`${base} ${tone} ${className}`} {...props}>
      {children}
    </button>
  );
}
