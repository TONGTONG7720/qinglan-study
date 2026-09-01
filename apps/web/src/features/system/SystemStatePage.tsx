import { Component, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { Icon } from "../../components/Icon";

export type SystemStateKind = "not-found" | "session-expired" | "offline" | "error" | "limited-release";

export interface SystemStatePageProps {
  readonly kind: SystemStateKind;
  readonly code?: string;
  readonly description?: string;
  readonly primaryLabel?: string;
  readonly primaryTarget?: string;
  readonly primaryState?: unknown;
  readonly onPrimaryAction?: () => void;
  readonly statusMessage?: string | null;
}

const stateCopy: Readonly<Record<SystemStateKind, {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly code: string;
  readonly primaryLabel: string;
  readonly primaryTarget: string;
}>> = {
  "not-found": {
    eyebrow: "安全边界 / SAFE RETURN",
    title: "无法打开此内容",
    description: "目标不存在或当前账号无权访问时，系统使用相同提示，不说明对象类型、身份关系或内部路径。",
    code: "SAFE_BOUNDARY",
    primaryLabel: "返回安全首页",
    primaryTarget: "/",
  },
  "session-expired": {
    eyebrow: "会话保护 / SESSION",
    title: "会话已过期",
    description: "为保护本人和家庭数据，旧页面内容已经清理。重新登录后只恢复获授权的安全目标。",
    code: "SESSION_EXPIRED",
    primaryLabel: "重新登录",
    primaryTarget: "/login",
  },
  offline: {
    eyebrow: "离线恢复 / OFFLINE",
    title: "当前处于离线状态",
    description: "浏览器离线不代表写操作失败。系统不会排队、重放或伪装提交、删除、更新和确认操作成功。",
    code: "CONFIRMED_OFFLINE",
    primaryLabel: "重新检查连接",
    primaryTarget: "/",
  },
  error: {
    eyebrow: "错误恢复 / RECOVERY",
    title: "出现了一个意外问题",
    description: "错误已安全捕获，敏感详情不会展示。系统只允许重新执行明确标记为安全读取的操作。",
    code: "SAFE_RECOVERY_REQUIRED",
    primaryLabel: "返回安全首页",
    primaryTarget: "/",
  },
  "limited-release": {
    eyebrow: "首发范围 / READ-ONLY BETA",
    title: "此功能暂未开放",
    description: "当前邀请制只读 Beta 仅开放登录、本人今日学习、课程与教材概览。此入口不会读取未接入的数据，也不会执行、排队或重放写操作。",
    code: "READ_ONLY_BETA",
    primaryLabel: "返回今日学习",
    primaryTarget: "/student/today",
  },
};

export function SystemStatePage({
  kind,
  code,
  description,
  primaryLabel,
  primaryTarget,
  primaryState,
  onPrimaryAction,
  statusMessage,
}: SystemStatePageProps) {
  const copy = stateCopy[kind];
  return (
    <main className="system-page">
      <section className="system-cover" aria-label="系统安全状态">
        <div className="system-brand">
          <strong>清朗学习</strong>
          <span>INK STUDY ROOM</span>
          <i aria-hidden="true">清朗</i>
        </div>
        <div>
          <p>{kind === "offline" ? "连接已断" : kind === "error" ? "错误已收" : kind === "limited-release" ? "首发收口" : "只守边界"}</p>
          <strong>{kind === "offline" ? "状态不清" : kind === "error" ? "信息已净" : kind === "limited-release" ? "只读开放" : "安全返回"}</strong>
        </div>
      </section>
      <section className="system-content" aria-labelledby="system-state-title">
        <header>
          <span>{copy.eyebrow}</span>
          <code>{code ?? copy.code}</code>
        </header>
        <div className="system-status-strip">
          <span>{kind === "limited-release" ? "首发范围　邀请制只读" : "敏感详情　未展示"}</span>
          <span>最近写操作　未重放</span>
          <span>权限范围　服务端确认</span>
        </div>
        <div className="system-message">
          <Icon name={kind === "offline" ? "monitor" : kind === "error" ? "circleAlert" : "shieldCheck"} size={36} />
          <h1 id="system-state-title">{copy.title}</h1>
          <p>{description ?? copy.description}</p>
        </div>
        <ol className="system-path">
          <li>停止不确定的写操作</li>
          <li>重新确认会话与服务状态</li>
          <li>只恢复合法的最小上下文</li>
          <li>由用户明确决定下一步</li>
        </ol>
        <div className="system-actions">
          {onPrimaryAction === undefined
            ? <Link className="system-primary" state={primaryState} to={primaryTarget ?? copy.primaryTarget}>{primaryLabel ?? copy.primaryLabel}<Icon name="arrowRight" size={18} /></Link>
            : <button className="system-primary" onClick={onPrimaryAction} type="button">{primaryLabel ?? copy.primaryLabel}<Icon name="arrowRight" size={18} /></button>}
          <button onClick={() => {
            window.history.back();
          }} type="button">返回上一安全页面</button>
        </div>
        {statusMessage === null || statusMessage === undefined ? null : <p className="system-action-status" role="status">{statusMessage}</p>}
      </section>
    </main>
  );
}

interface GlobalErrorBoundaryProps { readonly children: ReactNode; }
interface GlobalErrorBoundaryState { readonly failed: boolean; }

export class GlobalErrorBoundary extends Component<GlobalErrorBoundaryProps, GlobalErrorBoundaryState> {
  override state: GlobalErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(): void {
    // Intentionally do not log raw errors or component stacks in the UI layer.
  }

  override render(): ReactNode {
    return this.state.failed ? <SystemStatePage kind="error" /> : this.props.children;
  }
}
