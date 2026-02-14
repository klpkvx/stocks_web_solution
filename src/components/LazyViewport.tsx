import type { ReactNode } from "react";
import { useInView } from "@/lib/useInView";

export default function LazyViewport({
  children,
  placeholder,
  rootMargin = "320px"
}: {
  children: ReactNode;
  placeholder: ReactNode;
  rootMargin?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({
    rootMargin,
    once: true
  });

  return <div ref={ref}>{inView ? children : placeholder}</div>;
}
