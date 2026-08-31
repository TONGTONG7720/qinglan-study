import { Link } from "react-router-dom";

import { Icon } from "../../components/Icon";

export type PlannedRole = "AUTH" | "GUARDIAN" | "ADMIN";

export interface PlannedSurfacePageProps {
  readonly pageId: string;
  readonly role: PlannedRole;
  readonly title: string;
  readonly description?: string;
}

const roleLabel: Readonly<Record<PlannedRole, string>> = {
  AUTH: "身份与首次使用",
  GUARDIAN: "家长学习支持",
  ADMIN: "管理后台",
};

export function PlannedSurfacePage({ pageId, role, title, description }: PlannedSurfacePageProps) {
  const returnTarget = role === "AUTH" ? "/login" : role === "GUARDIAN" ? "/guardian/overview" : "/admin/overview";
  return (
    <main className={`planned-surface planned-surface-${role.toLowerCase()}`} data-page-id={pageId}>
      <aside aria-label={`${roleLabel[role]}导航`}>
        <div className="planned-brand"><strong>清朗学习</strong><span>INK STUDY ROOM</span><i>清朗</i></div>
        <nav><span aria-current="page">{roleLabel[role]}</span></nav>
        <small>{role === "ADMIN" ? "ADMIN_ONLY" : role === "GUARDIAN" ? "G-GUARDIAN-LINKED" : "安全会话"}</small>
      </aside>
      <section>
        <header><span>{roleLabel[role]}</span><strong>服务尚未接入</strong></header>
        <div className="planned-message">
          <Icon name="shieldCheck" size={36} />
          <h1>{title}</h1>
          <p>{description ?? "页面正式路径已经接入；对应数据服务尚未接入时，生产环境只显示此安全边界，不加载设计 Fixture，也不执行写操作。"}</p>
        </div>
        <dl>
          <div><dt>前端路径</dt><dd>已注册</dd></div>
          <div><dt>设计与提示词</dt><dd>已完成</dd></div>
          <div><dt>真实数据服务</dt><dd>尚未接入</dd></div>
          <div><dt>权限边界</dt><dd>必须由 API 强制校验</dd></div>
        </dl>
        <div className="planned-actions">
          <Link to={returnTarget}>返回安全入口</Link>
          <Link to="/login">重新验证身份</Link>
        </div>
      </section>
    </main>
  );
}
