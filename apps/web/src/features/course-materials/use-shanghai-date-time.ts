import { useEffect, useMemo, useState } from "react";

export interface ShanghaiDateTime {
  readonly date: string;
  readonly weekdayEnglish: string;
  readonly weekdayChinese: string;
}

export function formatShanghaiDateTime(now: Date): ShanghaiDateTime {
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const parts = new Map(dateParts.map((part) => [part.type, part.value]));
  const year = parts.get("year") ?? "----";
  const month = parts.get("month") ?? "--";
  const day = parts.get("day") ?? "--";

  return {
    date: `${year}-${month}-${day}`,
    weekdayEnglish: new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      weekday: "long",
    })
      .format(now),
    weekdayChinese: new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      weekday: "long",
    }).format(now),
  };
}

export function useShanghaiDateTime(): ShanghaiDateTime {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => { setNow(new Date()); }, 60_000);
    return () => { window.clearInterval(timer); };
  }, []);

  return useMemo(() => formatShanghaiDateTime(now), [now]);
}
