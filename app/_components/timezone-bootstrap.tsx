"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { applyBrowserTimezone } from "@/app/actions";

/**
 * When config still has the factory default "UTC", persist the browser's
 * IANA zone once so the clock / calendar / GA4 day match local time.
 */
export function TimezoneBootstrap({ timezone }: { timezone: string }) {
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (timezone !== "UTC" || attempted.current) {
      return;
    }
    attempted.current = true;

    let browserZone: string;
    try {
      browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!browserZone || browserZone === "UTC") {
      return;
    }

    void applyBrowserTimezone(browserZone).then((result) => {
      if (result.ok) {
        router.refresh();
      }
    });
  }, [timezone, router]);

  return null;
}
