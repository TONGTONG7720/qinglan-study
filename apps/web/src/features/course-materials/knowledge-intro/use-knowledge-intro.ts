import { useEffect, useState } from "react";

import { knowledgeIntroRepository } from "./knowledge-intro.repository";
import type { KnowledgeIntroResult } from "./types";

export type KnowledgeIntroPageData =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly result: KnowledgeIntroResult }
  | { readonly status: "error" };

export function useKnowledgeIntro(courseId: string): KnowledgeIntroPageData {
  const [state, setState] = useState<KnowledgeIntroPageData>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    void knowledgeIntroRepository
      .load(courseId, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ status: "ready", result });
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error" });
        }
      });

    return () => {
      controller.abort();
    };
  }, [courseId]);

  return state;
}
