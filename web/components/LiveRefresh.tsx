"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-reads the live FastF1 data (calendar, drivers) every minute while the tab
 * is visible. Only the server data is refreshed; scroll position, filters and
 * open panels stay as they are.
 */
export default function LiveRefresh({ everySeconds = 60 }: { everySeconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const id = setInterval(refresh, everySeconds * 1000);
    document.addEventListener("visibilitychange", refresh); // catch up when returning to the tab
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, everySeconds]);

  return null;
}
