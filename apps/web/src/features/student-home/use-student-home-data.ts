import { useEffect, useState } from "react";

import { loadCurrentUser } from "../../api/auth";
import type { CurrentUserResult } from "../../api/auth";
import { isAbortError } from "../../api/http-client";
import { useRequestRecoveryNavigation } from "../system/use-request-recovery-navigation";
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
  const recoverRequest = useRequestRecoveryNavigation();

  useEffect(() => {
    const controller = new AbortController();

    void loadCurrentUser(controller.signal, { propagateRecoveryErrors: true })
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
        if (isAbortError(error)) return;
        if (recoverRequest(error)) {
          setState({ status: "loading" });
          return;
        }
        setState({ status: "error" });
      });

    return () => {
      controller.abort();
    };
  }, [recoverRequest]);

  return state;
}
