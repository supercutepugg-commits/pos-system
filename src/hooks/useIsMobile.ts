"use client";

import { useEffect, useState } from "react";

// Tailwind의 lg 브레이크포인트(1024px)와 동일한 기준.
const QUERY = "(max-width: 1023px)";

// SSR 시점에는 알 수 없으므로 null을 반환하고, 클라이언트에서 확정되면 boolean으로 바뀐다.
export function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  return isMobile;
}
