import { useEffect, useState } from "react";

import { practiceRepository } from "./practice.repository";
import type { PracticeResult } from "./types";

export type PracticePageData =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly result: PracticeResult }
  | { readonly status: "error" };

export function usePractice(courseId: string): PracticePageData {
  const [state, setState] = useState<PracticePageData>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    void practiceRepository
      .load(courseId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ status: "ready", result });
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error" });
        }
      });

    return () => { controller.abort(); };
  }, [courseId]);

  return state;
}
