import type { CurrentUserResult } from "../api/auth";
import { Link, NavLink } from "react-router-dom";
import { useReleaseScope } from "../config/release-scope";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly route?: string;
  readonly separatorBefore?: boolean;
}

const navigationItems: readonly NavigationItem[] = [
  { id: "student-today", label: "今日学习", icon: "house", route: "/student/today" },
  { id: "student-learn", label: "课程与资料", icon: "bookOpen", route: "/student/learn" },
  { id: "daily-tasks", label: "每日任务", icon: "calendarDays", route: "/student/plans" },
  { id: "ai-tutor", label: "AI 辅导", icon: "sparkles", route: "/student/questions" },
  { id: "learning-evidence", label: "OCR 与证据", icon: "upload", route: "/student/questions/new/image" },
  { id: "wrong-answer-review", label: "错题复习", icon: "circleAlert", route: "/student/wrong-book" },
  { id: "mastery-evidence", label: "掌握证据", icon: "check", route: "/student/mastery" },
  { id: "assessment", label: "考试与评估", icon: "fileText", route: "/student/exams" },
  { id: "family-report", label: "家庭周报", icon: "userRound", route: "/guardian/overview", separatorBefore: true },
  { id: "family-privacy", label: "隐私与家庭隔离", icon: "shieldCheck", route: "/student/settings/family-privacy" },
];

export interface SidebarProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
  readonly currentItemId?: string;
  readonly profileActive?: boolean;
}

function userPresentation(currentUser: CurrentUserResult, demoActive: boolean) {
  if (currentUser.status === "authenticated") {
    const primaryRole = currentUser.user.roles[0] ?? "STUDENT";
    const roleLabel = primaryRole === "STUDENT" ? "学生" : primaryRole === "GUARDIAN" ? "家长" : "管理员";
    return { name: currentUser.user.displayName, role: roleLabel };
  }
  if (demoActive) {
    return { name: "林清远", role: "初二 · 学生" };
  }
  return {
    name: currentUser.status === "unavailable" ? "会话服务不可用" : "尚未登录",
    role: "请通过认证入口进入",
  };
}

export function Sidebar({ currentUser, demoActive, currentItemId, profileActive = false }: SidebarProps) {
  const releaseScope = useReleaseScope();
  const visibleNavigationItems = releaseScope === "READ_ONLY_BETA"
    ? navigationItems.filter((item) => item.id === "student-today" || item.id === "student-learn")
    : navigationItems;
  const user = userPresentation(currentUser, demoActive);
  const initial = user.name.trim().slice(0, 1) || "清";

  return (
    <aside className="sidebar" aria-label="主要导航" data-od-id="app-sidebar">
      <div className="brand-lockup">
        <strong className="brand-name">清朗学习</strong>
        <span className="brand-caption" translate="no">
          INK STUDY ROOM
        </span>
        <span aria-label="清朗印章" className="brand-seal">清朗</span>
      </div>

      {releaseScope === "READ_ONLY_BETA" ? (
        <p className="sidebar-release-scope">
          <Icon name="shieldCheck" size={16} />
          <span><strong>邀请制只读 Beta</strong><small>仅开放本人学习概览</small></span>
        </p>
      ) : null}

      <nav className="sidebar-nav" aria-label="学习功能">
        {visibleNavigationItems.map((item) =>
          item.route !== undefined && currentItemId !== undefined ? (
            <Link
              aria-current={currentItemId === item.id ? "page" : undefined}
              className={`sidebar-nav-item${item.separatorBefore === true ? " has-separator" : ""}${currentItemId === item.id ? " is-current" : ""}`}
              data-od-id={`nav-${item.id}`}
              key={item.label}
              to={item.route}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ) : item.route !== undefined ? (
            <NavLink
              className={({ isActive }) => {
                return `sidebar-nav-item${item.separatorBefore === true ? " has-separator" : ""}${isActive ? " is-current" : ""}`;
              }}
              data-od-id={`nav-${item.id}`}
              end
              key={item.label}
              to={item.route}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ) : (
            <button
              aria-current={currentItemId === item.id ? "page" : undefined}
              aria-label={`${item.label}，尚未在本阶段实现`}
              className={`sidebar-nav-item${item.separatorBefore === true ? " has-separator" : ""}${currentItemId === item.id ? " is-current" : ""}`}
              data-od-id={`nav-${item.id}`}
              disabled
              key={item.label}
              type="button"
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ),
        )}
      </nav>

      <div
        aria-current={profileActive ? "page" : undefined}
        className={`sidebar-profile${profileActive ? " is-current" : ""}`}
        aria-label="当前用户"
      >
        <span className="profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="profile-copy">
          <strong>{user.name}</strong>
          <small>{user.role}</small>
        </span>
        <Icon className="profile-chevron" name="chevronRight" size={16} />
      </div>
    </aside>
  );
}
