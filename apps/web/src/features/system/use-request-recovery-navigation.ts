import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { classifyRequestRecovery } from "./request-recovery";

export function useRequestRecoveryNavigation(): (error: unknown) => boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const from = `${location.pathname}${location.search}${location.hash}`;

  return useCallback((error: unknown) => {
    const decision = classifyRequestRecovery(error, from);
    if (decision === null) return false;
    void navigate(decision.route, {
      replace: true,
      state: {
        from: decision.from,
        reason: decision.reason,
        retryAfterSeconds: decision.retryAfterSeconds,
      },
    });
    return true;
  }, [from, navigate]);
}
