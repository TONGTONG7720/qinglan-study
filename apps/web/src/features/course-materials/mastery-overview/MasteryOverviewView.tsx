import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  MasteryEvidenceRow,
  MasteryOverviewDocument,
  MasteryOverviewDocumentStatus,
  MasteryOverviewFilterKey,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly MasteryOverviewDocumentStatus[] = [
  "WITH_EVIDENCE",
  "FIRST_OR_INSUFFICIENT",
  "COVERAGE_INCOMPLETE",
  "UPDATING",
  "FILTER_EMPTY",
  "OFFLINE_READONLY",
  "LOADING_MORE",
  "LOAD_MORE_FAILED",
];

const filterKeys = new Set<MasteryOverviewFilterKey>(["ALL", "SUFFICIENT", "OBSERVE", "INSUFFICIENT"]);

function parseFilter(value: string | null): MasteryOverviewFilterKey {
  if (value === null) {
    return "ALL";
  }
  const normalized = value.toUpperCase();
  return filterKeys.has(normalized as MasteryOverviewFilterKey) ? (normalized as MasteryOverviewFilterKey) : "ALL";
}

function isDisplayableMasteryOverview(document: MasteryOverviewDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function filterRows(
  rows: readonly MasteryEvidenceRow[],
  activeFilter: MasteryOverviewFilterKey,
): readonly MasteryEvidenceRow[] {
  if (activeFilter === "ALL") {
    return rows;
  }
  return rows.filter((row) => row.judgment === activeFilter);
}

function buildFilterUrl(
  searchParams: URLSearchParams,
  filter: MasteryOverviewFilterKey,
  document: MasteryOverviewDocument,
): string {
  const next = new URLSearchParams(searchParams);
  next.set("view", "mastery-overview");
  next.set("target", document.targetId);
  if (filter === "ALL") {
    next.delete("masteryStatus");
  } else {
    next.set("masteryStatus", filter.toLowerCase());
  }
  return `/student/learn?${next.toString()}`;
}

function buildMasteryDetailUrl(course: CourseSummary, row: MasteryEvidenceRow): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    knowledge: row.knowledgePointId,
    subject: course.subjectCode,
    target: row.detailTargetId,
    term: course.term,
    view: "mastery-detail",
  });
  return `/student/learn?${params.toString()}`;
}

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["mastery-overview-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="mastery-overview-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function MasteryOverviewMobileMenu() {
  return (
    <details className="mastery-overview-mobile-menu">
      <summary aria-label="打开移动端掌握概览导航">
        <span>
          <strong>清朗学习</strong>
          <small>掌握概览</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端掌握证据功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <span aria-current="page">掌握概览</span>
      </nav>
    </details>
  );
}

function MasteryOverviewHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: MasteryOverviewDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.updateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header mastery-overview-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb mastery-overview-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="mastery-overview-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date mastery-overview-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.updateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function MasteryOverviewSummary({
  activeFilter,
  document,
  searchParams,
}: {
  readonly activeFilter: MasteryOverviewFilterKey;
  readonly document: MasteryOverviewDocument;
  readonly searchParams: URLSearchParams;
}) {
  return (
    <section aria-label="章节总览与筛选" className="mastery-overview-summary">
      <div className="mastery-overview-chapter">
        <h2>{document.chapterLabel}</h2>
        <span aria-hidden="true" />
      </div>
      <div className="mastery-overview-summary-grid">
        <div className="mastery-overview-large-number" aria-label={`${document.largeNumber} ${document.largeNumberCaption}`}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <div className="mastery-overview-filter-panel">
          <nav aria-label="掌握判断筛选" className="mastery-overview-tabs" role="tablist">
            {document.filters.map((filter) => {
              const selected = filter.id === activeFilter;
              return (
                <Link
                  aria-label={`${filter.label} ${String(filter.count)}`}
                  aria-selected={selected}
                  className={selected ? "is-active" : undefined}
                  key={filter.id}
                  role="tab"
                  to={buildFilterUrl(searchParams, filter.id, document)}
                >
                  <span>{filter.label}</span>
                  <strong>{filter.count}</strong>
                </Link>
              );
            })}
          </nav>
          <div className="mastery-overview-secondary-filters" aria-label="次级筛选">
            <span>{document.subjectFilterLabel}<Icon className="mastery-overview-filter-chevron" name="chevronRight" size={16} /></span>
            <span>{document.evidencePeriodFilterLabel}<Icon className="mastery-overview-filter-chevron" name="chevronRight" size={16} /></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function judgmentClassName(row: MasteryEvidenceRow): string {
  return `mastery-overview-judgment is-${row.judgment.toLowerCase()}`;
}

function KnowledgeEvidenceList({
  course,
  rows,
}: {
  readonly course: CourseSummary;
  readonly rows: readonly MasteryEvidenceRow[];
}) {
  return (
    <section aria-labelledby="mastery-overview-list-title" className="mastery-overview-list-section">
      <h2 className="sr-only" id="mastery-overview-list-title">知识点证据列表</h2>
      <div className="mastery-overview-table" role="table" aria-label="知识点证据列表">
        <div className="mastery-overview-table-head" role="row">
          <span role="columnheader">知识点</span>
          <span role="columnheader">当前判断</span>
          <span role="columnheader">证据摘要</span>
          <span role="columnheader">覆盖 / 最近证据</span>
          <span role="columnheader">判断依据</span>
          <span role="columnheader">操作</span>
        </div>
        {rows.map((row) => (
          <div className="mastery-overview-row" key={row.id} role="row">
            <div className="mastery-overview-point" role="cell">
              <span>{row.ordinalLabel}</span>
              <strong>{row.title}</strong>
            </div>
            <div role="cell">
              <span className={judgmentClassName(row)}>{row.judgmentLabel}</span>
            </div>
            <div role="cell">{row.evidenceSummary}</div>
            <div className="mastery-overview-coverage-cell" role="cell">
              <span>{row.coverageLabel}</span>
              <span>{row.recentEvidenceLabel}</span>
            </div>
            <div role="cell">{row.rationale}</div>
            <div role="cell">
              <Link className="mastery-overview-evidence-link" to={buildMasteryDetailUrl(course, row)}>
                {row.actionLabel}
                <Icon name="arrowRight" size={16} />
              </Link>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mastery-overview-empty" role="status">
          当前筛选没有知识点；清除筛选后仍保留服务端聚合计数，不用本地结果反推掌握分类。
        </p>
      ) : null}
    </section>
  );
}

function MasteryOverviewFooter({ document }: { readonly document: MasteryOverviewDocument }) {
  return (
    <section aria-label="证据期说明" className="mastery-overview-footer">
      <p>{document.coveragePeriodLabel}</p>
      <p>{document.phaseNotice}</p>
    </section>
  );
}

function MasteryOverviewRightRail({ document }: { readonly document: MasteryOverviewDocument }) {
  return (
    <aside aria-label="掌握概览辅助信息" className="mastery-overview-right-rail">
      <SectionTitle id="mastery-coverage-title" title="覆盖概况" />
      <DefinitionList rows={document.coverageRows} />
      <SectionTitle id="mastery-judgment-title" title="判断说明" />
      <DefinitionList rows={document.judgmentRows} />
      <SectionTitle id="mastery-source-title" title="证据来源" />
      <DefinitionList rows={document.sourceRows} />
      <SectionTitle id="mastery-privacy-title" title="服务与隐私" />
      <DefinitionList rows={document.privacyRows} />
    </aside>
  );
}

function MasteryOverviewRailCompact({ document }: { readonly document: MasteryOverviewDocument }) {
  return (
    <details className="mastery-overview-rail-compact">
      <summary>查看覆盖概况、判断说明、证据来源与隐私</summary>
      <div>
        <SectionTitle id="mastery-compact-coverage-title" title="覆盖概况" />
        <DefinitionList rows={document.coverageRows} />
        <SectionTitle id="mastery-compact-judgment-title" title="判断说明" />
        <DefinitionList rows={document.judgmentRows} />
        <SectionTitle id="mastery-compact-source-title" title="证据来源" />
        <DefinitionList rows={document.sourceRows} />
        <SectionTitle id="mastery-compact-privacy-title" title="服务与隐私" />
        <DefinitionList rows={document.privacyRows} />
      </div>
    </details>
  );
}

function MasteryOverviewReady({
  course,
  currentUser,
  dateTime,
  demoActive,
  document,
}: {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: MasteryOverviewDocument;
}) {
  const [searchParams] = useSearchParams();
  const activeFilter = parseFilter(searchParams.get("masteryStatus"));
  const rows = useMemo(() => filterRows(document.rows, activeFilter), [activeFilter, document.rows]);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  return (
    <div className="app-shell mastery-overview-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="mastery-evidence" currentUser={currentUser} demoActive={demoActive} />
      <MasteryOverviewMobileMenu />
      <main className="paper-canvas mastery-overview-canvas" id="main-content">
        <MasteryOverviewHeader dateTime={dateTime} document={document} />
        <div className="mastery-overview-grid">
          <article aria-label="掌握概览" className="mastery-overview-main">
            <MasteryOverviewSummary activeFilter={activeFilter} document={document} searchParams={searchParams} />
            <KnowledgeEvidenceList course={course} rows={rows} />
            <MasteryOverviewFooter document={document} />
            {sourceBoundary === undefined ? null : <p className="mastery-overview-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="mastery-overview-rail-divider" />
          <MasteryOverviewRightRail document={document} />
          <MasteryOverviewRailCompact document={document} />
        </div>
      </main>
    </div>
  );
}

function MasteryOverviewUnavailableSurface({
  currentUser,
  demoActive,
  overviewUrl,
  subtitle,
  title,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}) {
  return (
    <div className="app-shell mastery-overview-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="mastery-evidence" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page mastery-overview-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="MASTERY_OVERVIEW_UNAVAILABLE：当前不会展示虚构掌握分类、knowledgePointId、证据摘要、覆盖期、判断理由、百分比、排名或雷达图。"
          title="掌握概览服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function MasteryOverviewLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell mastery-overview-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="mastery-evidence" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas mastery-overview-canvas" id="main-content">
        <div aria-label="正在加载掌握概览" className="page-loading mastery-overview-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface MasteryOverviewRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function MasteryOverviewRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
}: MasteryOverviewRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      return course.masteryOverviews?.find((item) => item.targetId === targetId);
    }
    return course.masteryOverviews?.[0];
  }, [course.masteryOverviews, targetId]);

  if (document === undefined) {
    return (
      <MasteryOverviewServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-029 掌握概览文档；生产环境不会用开发 Fixture 补 knowledgePointId、分类、证据摘要、覆盖期或判断理由。"
        title="掌握概览"
      />
    );
  }

  if (document.status === "LOADING") {
    return <MasteryOverviewLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableMasteryOverview(document)) {
    return (
      <MasteryOverviewServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="掌握概览不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或按数量生成分类。"
        title="掌握概览"
      />
    );
  }

  return (
    <MasteryOverviewReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function MasteryOverviewServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的掌握概览服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "掌握概览",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <MasteryOverviewUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
