import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  PracticeHub,
  PracticeHubFilter,
  PracticeHubStatus,
  PracticeRecommendation,
  PracticeRecommendationBadgeTone,
  PracticeRecommendationKind,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<PracticeHubStatus, { readonly title: string; readonly description: string }> = {
  LOADING: {
    title: "练习中心加载中",
    description: "保留页面骨架，等待服务端返回当前知识点和到期错题推荐。",
  },
  WITH_RECOMMENDATIONS: {
    title: "练习中心",
    description: "当前练习推荐已经按学生本人上下文返回。",
  },
  NO_RECOMMENDATIONS: {
    title: "今日暂无练习",
    description: "今天没有服务端确认的当前点练习或到期错题；页面不会制造无意义推荐。",
  },
  FILTER_EMPTY: {
    title: "当前筛选无结果",
    description: "保留已有筛选数量，不回退到虚构练习。",
  },
  CURRENT_KNOWLEDGE_POINT_UNAVAILABLE: {
    title: "当前知识点不可用",
    description: "无法确认学科、章节或知识点范围；不会生成跨范围题目。",
  },
  RECOMMENDATION_UNAVAILABLE: {
    title: "练习推荐不可用",
    description: "推荐服务未接入或暂不可用；不能把本地 Fixture 当作真实练习推荐。",
  },
  OFFLINE: {
    title: "离线只读",
    description: "可以查看已加载推荐；没有服务端确认时不能创建练习 attempt。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后再读取本人练习推荐。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "练习范围不可用",
    description: "当前资源不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

const filterOrder: readonly PracticeHubFilter[] = ["ALL", "CURRENT_KNOWLEDGE_POINT", "WRONG_BOOK_RECOVERY"];

const filterLabels: Record<PracticeHubFilter, string> = {
  ALL: "全部",
  CURRENT_KNOWLEDGE_POINT: "当前知识点",
  WRONG_BOOK_RECOVERY: "错题恢复",
};

function filterMatches(kind: PracticeRecommendationKind, filter: PracticeHubFilter): boolean {
  return filter === "ALL" || filter === kind;
}

function badgeClassName(tone: PracticeRecommendationBadgeTone): string {
  return tone === "DUE" ? "is-due" : "is-current";
}

function PracticeHubMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="practice-hub-mobile-menu">
      <summary aria-label="打开移动端练习中心导航">
        <span>
          <strong>清朗学习</strong>
          <small>每日任务</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端每日任务功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <span aria-current="page">练习中心</span>
        <span>错题恢复 · 待服务确认</span>
      </nav>
    </details>
  );
}

function PracticeHubHeader({
  dateTime,
  demoActive,
  detail,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: PracticeHub;
}) {
  return (
    <header className="page-header practice-hub-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb practice-hub-breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
        </nav>
        <h1>{detail.title}</h1>
        <div className="practice-hub-header-meta">
          <p>{detail.subtitle}</p>
          {demoActive && detail.fixtureBadgeLabel !== undefined ? <span>{detail.fixtureBadgeLabel}</span> : null}
        </div>
      </div>
      <div className="page-date practice-hub-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}，${detail.updatedAtLabel}`}>
        <strong>{dateTime.date}</strong>
        <small>{dateTime.weekdayChinese}</small>
        <small>{detail.updatedAtLabel}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function PracticeSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="practice-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function PracticeDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["practice-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PracticeFilterTabs({
  activeFilter,
  counts,
  onFilterChange,
}: {
  readonly activeFilter: PracticeHubFilter;
  readonly counts: Readonly<Record<PracticeHubFilter, number>>;
  readonly onFilterChange: (filter: PracticeHubFilter) => void;
}) {
  return (
    <div aria-label="练习类型筛选" className="practice-filter-tabs" role="tablist">
      {filterOrder.map((filter) => {
        const selected = filter === activeFilter;
        return (
          <button
            aria-selected={selected}
            className={selected ? "is-active" : undefined}
            key={filter}
            onClick={() => { onFilterChange(filter); }}
            role="tab"
            type="button"
          >
            {filterLabels[filter]} <span>{counts[filter]}</span>
          </button>
        );
      })}
    </div>
  );
}

function PracticeDetailPanel({
  id,
  kind,
  onClose,
  onKeyDown,
  recommendation,
}: {
  readonly id: string;
  readonly kind: "EXPLANATION" | "SOURCE";
  readonly onClose: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly recommendation: PracticeRecommendation;
}) {
  const title = kind === "SOURCE" ? "错题来源" : "练习说明";
  const rows = kind === "SOURCE"
    ? recommendation.sourceRows.map((row) => `${row.label}：${row.value}`)
    : recommendation.explanationRows;

  return (
    <div
      aria-label={`${recommendation.title}${title}`}
      className="practice-recommendation-detail"
      id={id}
      onKeyDown={onKeyDown}
      role="region"
      tabIndex={-1}
    >
      <div>
        <h3>{title}</h3>
        <button className="text-button" onClick={onClose} type="button">收起</button>
      </div>
      <ul>
        {rows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </div>
  );
}

function PracticeRecommendationItem({
  recommendation,
}: {
  readonly recommendation: PracticeRecommendation;
}) {
  const detailPanelId = useId();
  const explanationButtonRef = useRef<HTMLButtonElement | null>(null);
  const sourceButtonRef = useRef<HTMLButtonElement | null>(null);
  const [openPanel, setOpenPanel] = useState<"EXPLANATION" | "SOURCE" | null>(null);
  const [attemptUnavailable, setAttemptUnavailable] = useState(false);
  const hasSourceRows = recommendation.sourceRows.length > 0;
  const primaryClassName = recommendation.kind === "CURRENT_KNOWLEDGE_POINT"
    ? "primary-button practice-start-button"
    : "secondary-button practice-start-button";

  useEffect(() => {
    if (openPanel === null) {
      return;
    }
    document.getElementById(detailPanelId)?.focus();
  }, [detailPanelId, openPanel]);

  function returnFocusToOpener(panel: "EXPLANATION" | "SOURCE"): void {
    window.setTimeout(() => {
      if (panel === "EXPLANATION") {
        explanationButtonRef.current?.focus();
      } else {
        sourceButtonRef.current?.focus();
      }
    }, 0);
  }

  function closePanel(): void {
    if (openPanel === null) {
      return;
    }
    const lastPanel = openPanel;
    setOpenPanel(null);
    returnFocusToOpener(lastPanel);
  }

  function handlePanelKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closePanel();
    }
  }

  function openExplanation(): void {
    setOpenPanel((current) => current === "EXPLANATION" ? null : "EXPLANATION");
  }

  function openSource(): void {
    setOpenPanel((current) => current === "SOURCE" ? null : "SOURCE");
  }

  return (
    <li className={`practice-recommendation-item is-${recommendation.kind.toLowerCase().replaceAll("_", "-")}`}>
      <div className="practice-recommendation-number" aria-hidden="true">{recommendation.ordinalLabel}</div>
      <div className="practice-recommendation-body">
        <div className="practice-recommendation-topline">
          <span className={`practice-recommendation-badge ${badgeClassName(recommendation.badgeTone)}`}>{recommendation.badgeLabel}</span>
          <span className="practice-recommendation-status">{recommendation.statusLabel}</span>
        </div>
        <h3>{recommendation.title}</h3>
        {recommendation.contextLabel === undefined ? null : <p className="practice-recommendation-context">{recommendation.contextLabel}</p>}
        {recommendation.sourceLabel === undefined ? null : <p className="practice-recommendation-source">{recommendation.sourceLabel}</p>}
        <p className="practice-recommendation-meta">{recommendation.metaLabel}</p>
        <p className="practice-recommendation-reason">
          <span>推荐理由：</span>{recommendation.reason}
        </p>
        <div className="practice-recommendation-actions">
          <button
            className={primaryClassName}
            disabled={attemptUnavailable}
            onClick={() => { setAttemptUnavailable(true); }}
            type="button"
          >
            <span>{attemptUnavailable ? "服务未接入" : recommendation.primaryActionLabel}</span>
            <Icon name="arrowRight" size={17} />
          </button>
          <button
            aria-controls={detailPanelId}
            aria-expanded={hasSourceRows ? openPanel === "SOURCE" : openPanel === "EXPLANATION"}
            className="text-button"
            onClick={hasSourceRows ? openSource : openExplanation}
            ref={hasSourceRows ? sourceButtonRef : explanationButtonRef}
            type="button"
          >
            {recommendation.secondaryActionLabel}
          </button>
        </div>
        <p aria-live="polite" className="practice-attempt-message">
          {attemptUnavailable ? recommendation.unavailableMessage : ""}
        </p>
        {openPanel === null ? null : (
          <PracticeDetailPanel
            id={detailPanelId}
            kind={openPanel}
            onClose={closePanel}
            onKeyDown={handlePanelKeyDown}
            recommendation={recommendation}
          />
        )}
      </div>
    </li>
  );
}

function PracticeRecommendations({ detail }: { readonly detail: PracticeHub }) {
  const [activeFilter, setActiveFilter] = useState<PracticeHubFilter>("ALL");
  const counts = useMemo<Readonly<Record<PracticeHubFilter, number>>>(() => ({
    ALL: detail.recommendations.length,
    CURRENT_KNOWLEDGE_POINT: detail.recommendations.filter((item) => item.kind === "CURRENT_KNOWLEDGE_POINT").length,
    WRONG_BOOK_RECOVERY: detail.recommendations.filter((item) => item.kind === "WRONG_BOOK_RECOVERY").length,
  }), [detail.recommendations]);
  const visibleRecommendations = detail.recommendations.filter((item) => filterMatches(item.kind, activeFilter));

  return (
    <section className="practice-today-panel" aria-labelledby="practice-today-title">
      <div className="practice-today-title-row">
        <PracticeSectionTitle id="practice-today-title" title="今日可练" />
        <PracticeFilterTabs activeFilter={activeFilter} counts={counts} onFilterChange={setActiveFilter} />
      </div>

      <div className="practice-today-layout">
        <div className="practice-oversized-metric" aria-label={`${detail.metricValue} ${detail.metricCaption}`}>
          <strong>{detail.metricValue}</strong>
          <span>{detail.metricCaption}</span>
        </div>

        <div className="practice-recommendation-area" role="tabpanel">
          {visibleRecommendations.length === 0 ? (
            <div className="practice-filter-empty" role="status">
              <h3>{detail.filterEmptyTitle}</h3>
              <p>{detail.filterEmptyDescription}</p>
            </div>
          ) : (
            <ol className="practice-recommendation-list">
              {visibleRecommendations.map((recommendation) => (
                <PracticeRecommendationItem key={recommendation.id} recommendation={recommendation} />
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}

function PracticeBoundary({ detail }: { readonly detail: PracticeHub }) {
  const titleId = useId();
  return (
    <section className="practice-boundary-panel" aria-labelledby={titleId}>
      <PracticeSectionTitle id={titleId} title="练习边界" />
      <dl className="practice-boundary-list">
        {detail.boundaryRows.map((row) => (
          <div key={row.id}>
            <dt>{row.title}</dt>
            <dd>{row.description}</dd>
          </div>
        ))}
      </dl>
      <p>{detail.estimatedTotalLabel}</p>
    </section>
  );
}

function PracticeRailSection({
  children,
  rows,
  title,
}: {
  readonly children?: ReactNode;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `practice-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className="practice-rail-section" aria-labelledby={titleId}>
      <div className="practice-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <PracticeDefinitionList className="practice-rail-list" rows={rows} />
      {children}
    </section>
  );
}

function PracticeHubRightRail({
  detail,
  knowledgePointUrl,
  compact = false,
}: {
  readonly detail: PracticeHub;
  readonly knowledgePointUrl: string;
  readonly compact?: boolean;
}) {
  return (
    <aside
      className="right-rail practice-hub-rail"
      aria-label={compact ? "练习中心折叠辅助信息" : "练习中心辅助信息"}
    >
      <PracticeRailSection rows={detail.currentKnowledgeRows} title="当前知识点">
        <a className="practice-rail-link" href={knowledgePointUrl}>{detail.returnKnowledgeLabel}</a>
      </PracticeRailSection>
      <PracticeRailSection rows={detail.recommendationBasisRows} title="推荐依据" />
      <PracticeRailSection rows={detail.evidenceRuleRows} title="证据规则" />
      <PracticeRailSection rows={detail.privacyRows} title="服务与隐私" />
      <PracticeRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="practice-service-code">{detail.serviceCode}</p>
    </aside>
  );
}

function PracticeHubRailCompact({
  detail,
  knowledgePointUrl,
}: {
  readonly detail: PracticeHub;
  readonly knowledgePointUrl: string;
}) {
  return (
    <details className="right-rail-collapsible practice-hub-collapsible">
      <summary>
        <span>知识点、依据与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <PracticeHubRightRail compact detail={detail} knowledgePointUrl={knowledgePointUrl} />
      </div>
    </details>
  );
}

function PracticeHubLoadingSurface({
  currentUser,
  demoActive,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
}) {
  return (
    <div className="app-shell practice-hub-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <PracticeHubMobileMenu overviewUrl={overviewUrl} />
      <main className="paper-canvas practice-hub-canvas" id="main-content">
        <div className="page-loading practice-hub-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns">
            <span />
            <span />
          </div>
        </div>
      </main>
    </div>
  );
}

function PracticeHubStatusSurface({
  detail,
  overviewUrl,
}: {
  readonly detail: PracticeHub;
  readonly overviewUrl: string;
}) {
  const copy = serviceStateCopy[detail.status];
  return (
    <div className="practice-hub-service-state">
      <StatusPanel description={copy.description} title={copy.title} />
      <p className="practice-service-code">{detail.serviceCode}</p>
      <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
    </div>
  );
}

export interface PracticeHubRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly knowledgePointUrl: string;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function PracticeHubRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  knowledgePointId,
  knowledgePointUrl,
  overviewUrl,
  targetId,
}: PracticeHubRouteProps) {
  const detail = useMemo(
    () => course.practiceHubs?.find((item) => item.targetId === targetId) ??
      course.practiceHubs?.find((item) => item.knowledgePointId === knowledgePointId) ??
      (targetId === null && knowledgePointId === null ? course.practiceHubs?.[0] : undefined),
    [course.practiceHubs, knowledgePointId, targetId],
  );

  if (detail === undefined) {
    return (
      <PracticeHubServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端练习中心文档；生产环境不会用开发 Fixture 补推荐、错题来源、attemptId 或掌握证据。"
        title="练习中心"
      />
    );
  }

  if (detail.status === "LOADING") {
    return <PracticeHubLoadingSurface currentUser={currentUser} demoActive={demoActive} overviewUrl={overviewUrl} />;
  }

  if (
    detail.status !== "WITH_RECOMMENDATIONS" &&
    detail.status !== "NO_RECOMMENDATIONS" &&
    detail.status !== "FILTER_EMPTY"
  ) {
    return (
      <div className="app-shell practice-hub-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
        <PracticeHubMobileMenu overviewUrl={overviewUrl} />
        <main className="paper-canvas practice-hub-canvas" id="main-content">
          <PracticeHubHeader dateTime={dateTime} demoActive={demoActive} detail={detail} />
          <PracticeHubStatusSurface detail={detail} overviewUrl={overviewUrl} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell practice-hub-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <PracticeHubMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas practice-hub-canvas" id="main-content">
        <PracticeHubHeader dateTime={dateTime} demoActive={demoActive} detail={detail} />
        <div className="content-grid practice-hub-grid">
          <article className="main-column practice-hub-main" aria-label="练习中心">
            <PracticeRecommendations detail={detail} />
            <PracticeBoundary detail={detail} />
            <p className="practice-source-boundary">{detail.sourceBoundary}</p>
          </article>

          <PracticeHubRightRail detail={detail} knowledgePointUrl={knowledgePointUrl} />
          <PracticeHubRailCompact detail={detail} knowledgePointUrl={knowledgePointUrl} />
        </div>
      </main>
    </div>
  );
}

export interface PracticeHubServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function PracticeHubServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: PracticeHubServiceUnavailableProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="PRACTICE_RECOMMENDATION_UNAVAILABLE：当前没有真实练习推荐服务端文档；不会把开发 Fixture、本地筛选、错题来源或按钮点击伪装成 attempt、LearningEvidence、Mistake、RecoveryAttempt、Mastery、预算或云端笔记。"
          title="练习推荐服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
