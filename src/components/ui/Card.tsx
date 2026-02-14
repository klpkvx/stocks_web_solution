import type { ReactNode } from "react";

export default function Card({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`glass ${className}`}>{children}</div>;
}
