import { useEffect, useState } from "react";

export function useVisibility() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handle = () => setVisible(document.visibilityState === "visible");
    handle();
    document.addEventListener("visibilitychange", handle);
    return () => document.removeEventListener("visibilitychange", handle);
  }, []);

  return visible;
}
