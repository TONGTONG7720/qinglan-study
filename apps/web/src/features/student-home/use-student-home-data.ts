import { useEffect, useState } from "react";

import { loadCurrentUser } from "../../api/auth";
import type { CurrentUserResult } from "../../api/auth";
import { studentHomeRepository } from "./student-home.repository";
import type { StudentHomeResult } from "./types";

export type StudentHomePageData =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly homeResult: StudentHomeResult;
      readonly currentUser: CurrentUserResult;
    }
  | { readonly status: "error" };

export function useStudentHomeData(): StudentHomePageData {
  const [state, setState] = useState<StudentHomePageData>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    void loadCurrentUser(controller.signal)
      .then(async (currentUser) => {
        const isStudent = currentUser.status === "authenticated" && currentUser.user.roles.includes("STUDENT");
        const homeResult = currentUser.status === "authenticated" && !isStudent
          ? { status: "unavailable", reason: "STUDENT_ROLE_REQUIRED" } as const
          : await studentHomeRepository.loadToday(
              isStudent ? currentUser.user.id : undefined,
              controller.signal,
            );
        if (!controller.signal.aborted) {
          setState({ status: "ready", homeResult, currentUser });
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
  }, []);

  return state;
}
