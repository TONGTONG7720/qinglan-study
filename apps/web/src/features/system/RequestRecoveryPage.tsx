import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { SystemStatePage } from "./SystemStatePage";
import { parseRequestRecoveryState, type RequestRecoveryReason } from "./request-recovery";

type RecoverableSystemKind = "session-expired" | "offline" | "error";

const errorCopy: Readonly<Record<Exclude<RequestRecoveryReason, "SESSION_EXPIRED" | "OFFLINE">, {
  readonly code: string;
  readonly description: string;
}>> = {
  TIMEOUT: {
    code: "SAFE_READ_TIMEOUT",
    description: "本次安全读取已超时，系统没有自动重试。确认服务恢复后，可由你手工重新读取原页面。",
  },
  RATE_LIMITED: {
    code: "RATE_LIMITED",
    description: "请求频率暂时受限，系统没有自动重试。请等待服务允许后，再手工重新读取原页面。",
  },
  SERVER_UNAVAILABLE: {
    code: "SERVICE_UNAVAILABLE",
    description: "服务暂时无法完成安全读取，系统没有排队或自动重放请求。请稍后手工重试。",
  },
  NETWORK_FAILURE: {
    code: "NETWORK_REQUEST_FAILED",
    description: "浏览器仍报告在线，但本次服务连接失败。系统不会把它误判为写入失败，也不会自动重试。",
  },
};

export function RequestRecoveryPage({ kind }: { readonly kind: RecoverableSystemKind }) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useMemo(() => parseRequestRecoveryState(location.state), [location.state]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const returnTo = state?.from ?? "/";

  useEffect(() => {
    if (kind !== "offline") return undefined;
    const onOnline = () => { setStatusMessage("浏览器网络可能已恢复；请手工重新检查原页面。"); };
    const onOffline = () => { setStatusMessage("浏览器仍处于离线状态，尚未重新读取任何数据。"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [kind]);

  if (kind === "session-expired") {
    return (
      <SystemStatePage
        kind="session-expired"
        primaryState={{ from: returnTo }}
        statusMessage="旧页面数据已卸载；重新登录后只恢复这个安全目标。"
      />
    );
  }

  const retry = () => {
    if (kind === "offline" && !navigator.onLine) {
      setStatusMessage("浏览器仍处于离线状态，尚未重新读取任何数据。");
      return;
    }
    void navigate(returnTo, { replace: true });
  };

  if (kind === "offline") {
    return (
      <SystemStatePage
        kind="offline"
        onPrimaryAction={retry}
        primaryLabel="手工重新检查"
        statusMessage={statusMessage}
      />
    );
  }

  const reason = state?.reason;
  const copy = reason === "TIMEOUT" || reason === "RATE_LIMITED" || reason === "SERVER_UNAVAILABLE" || reason === "NETWORK_FAILURE"
    ? errorCopy[reason]
    : { code: "SAFE_RECOVERY_REQUIRED", description: "读取失败已安全收口；系统没有自动重试或执行任何写操作。" };
  const retryAfter = reason === "RATE_LIMITED" && state?.retryAfterSeconds !== null && state?.retryAfterSeconds !== undefined
    ? ` 服务建议至少等待 ${String(state.retryAfterSeconds)} 秒。`
    : "";
  return (
    <SystemStatePage
      code={copy.code}
      description={`${copy.description}${retryAfter}`}
      kind="error"
      onPrimaryAction={retry}
      primaryLabel="手工重试安全读取"
      statusMessage={statusMessage}
    />
  );
}
