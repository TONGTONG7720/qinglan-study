import { useEffect, useState } from "react";

import { loadCurrentUser } from "../../api/auth";
import type { CurrentUserResult } from "../../api/auth";
import { courseMaterialsRepository } from "./course-materials.repository";
import type { CourseCatalogResult } from "./types";

export type CourseMaterialsPageData =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly catalogResult: CourseCatalogResult;
      readonly currentUser: CurrentUserResult;
    }
  | { readonly status: "error" };

export function useCourseMaterialsPageData(): CourseMaterialsPageData {
  const [state, setState] = useState<CourseMaterialsPageData>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    void loadCurrentUser(controller.signal)
      .then(async (currentUser) => {
        const isStudent = currentUser.status === "authenticated" && currentUser.user.roles.includes("STUDENT");
        const catalogResult = currentUser.status === "authenticated" && !isStudent
          ? { status: "unavailable", reason: "STUDENT_ROLE_REQUIRED" } as const
          : await courseMaterialsRepository.loadCatalog(
              isStudent ? currentUser.user.id : undefined,
              controller.signal,
            );
        if (!controller.signal.aborted) {
          setState({ status: "ready", catalogResult, currentUser });
        }
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setState({ status: "error" });
        }
      });

    return () => { controller.abort(); };
  }, []);

  return state;
}
