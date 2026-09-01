import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { safeRecoveryPath } from "./request-recovery";

export function RequestRecoveryCoordinator() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOffline = () => {
      if (location.pathname === "/offline") return;
      const from = safeRecoveryPath(`${location.pathname}${location.search}${location.hash}`);
      void navigate("/offline", {
        replace: true,
        state: { from, reason: "OFFLINE", retryAfterSeconds: null },
      });
    };
    window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("offline", handleOffline); };
  }, [location.hash, location.pathname, location.search, navigate]);

  return null;
}
