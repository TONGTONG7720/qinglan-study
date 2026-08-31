import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  MasteryDetailDocument,
  MasteryDetailDocumentStatus,
  MasteryDetailEvidenceEffect,
  MasteryDetailEvidenceEvent,
  MasteryDetailLearningTargetMapping,
  MasteryDetailWrongItemTargetMapping,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly MasteryDetailDocumentStatus[] = [
  "EVIDENCE_SUFFICIENT",
  "EVIDENCE_INSUFFICIENT",
  "EVIDENCE_CONFLICTED",
  "NEW_EVIDENCE_PENDING",
  "OFFLINE_READONLY",
];

function isDisplayableMasteryDetail(document: MasteryDetailDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildOverviewUrl(course: CourseSummary, targetId: string): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: targetId,
    term: course.term,
    view: "mastery-overview",
  });
  return `/student/learn?${params.toString()}`;
}

function buildKnowledgePointUrl(course: CourseSummary, mapping: MasteryDetailLearningTargetMapping): string {
  const params = new URLSearchParams({
    chapter: mapping.chapterId,
    grade: String(course.grade),
    knowledge: mapping.knowledgePointId,
    routeToken: mapping.routeToken,
    subject: course.subjectCode,
    term: course.term,
    view: "knowledge-point-detail",
  });
  return `/student/learn?${params.toString()}`;
}

function buildWrongItemUrl(course: CourseSummary, mapping: MasteryDetailWrongItemTargetMapping): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    routeToken: mapping.routeToken,
    subject: course.subjectCode,
    target: mapping.targetId,
    term: course.term,
    view: "wrong-item-detail",
    wrongItem: mapping.wrongItemId,
  });
  return `/student/learn?${params.toString()}`;
}

function effectClass(effect: MasteryDetailEvidenceEffect): string {
  return `is-${effect.toLowerCase()}`;
}

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["mastery-detail-definition-list", className].filter(Boolean).join(" ")}>
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
    <div className="mastery-detail-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function MasteryDetailMobileMenu() {
  return (
    <details className="mastery-detail-mobile-menu">
      <summary aria-label="打开移动端掌握详情导航">
        <span>
          <strong>清朗学习</strong>
          <small>掌握证据</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端掌握证据功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <span aria-current="page">掌握证据</span>
      </nav>
    </details>
  );
}

function MasteryDetailHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: MasteryDetailDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.updateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header mastery-detail-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb mastery-detail-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="mastery-detail-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date mastery-detail-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.updateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function MasteryJudgmentSummary({ document }: { readonly document: MasteryDetailDocument }) {
  return (
    <section aria-labelledby="mastery-detail-judgment-title" className="mastery-detail-judgment">
      <div
        aria-label={`${document.largeNumber} ${document.largeNumberCaption}`}
        className="mastery-detail-large-number"
      >
        <strong>{document.largeNumber}</strong>
        <span>{document.largeNumberCaption}</span>
      </div>
      <div className="mastery-detail-judgment-copy">
        <div className="mastery-detail-kicker">
          <span id="mastery-detail-judgment-title">当前判断</span>
          <strong className={`is-${document.judgment.toLowerCase()}`}>{document.judgmentLabel}</strong>
        </div>
        <p>{document.rationale}</p>
        <dl className="mastery-detail-metrics" aria-label="当前判断事实">
          {document.metrics.map((metric) => (
            <div key={metric.id}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mastery-detail-boundary-notice">{document.boundaryNotice}</p>
      </div>
    </section>
  );
}

function EvidenceSourcePreview({
  event,
  onClose,
}: {
  readonly event: MasteryDetailEvidenceEvent;
  readonly onClose: () => void;
}) {
  return (
    <section
      aria-label={`${event.sourceTypeLabel}来源详情`}
      aria-live="polite"
      className="mastery-detail-source-preview"
      id={`source-preview-${event.id}`}
    >
      <div>
        <h3>{event.sourcePreview.title}</h3>
        <button type="button" onClick={onClose}>收起来源</button>
      </div>
      <p className="mastery-detail-source-id">
        <span>sourceObjectId：</span>
        {event.sourceObjectId}
      </p>
      <DefinitionList rows={event.sourcePreview.rows} />
      <p>{event.sourcePreview.privacyNotice}</p>
    </section>
  );
}

function EvidenceTimeline({ rows }: { readonly rows: readonly MasteryDetailEvidenceEvent[] }) {
  const [openSourceId, setOpenSourceId] = useState<string | null>(null);

  return (
    <section aria-labelledby="mastery-detail-timeline-title" className="mastery-detail-timeline-section">
      <SectionTitle id="mastery-detail-timeline-title" title="证据时间线" />
      <ol className="mastery-detail-timeline">
        {rows.map((event, index) => {
          const sourceOpen = openSourceId === event.id;
          return (
            <li className={`mastery-detail-event ${effectClass(event.effect)}`} key={event.id}>
              <span aria-hidden="true" className="mastery-detail-event-index">{String(index + 1)}</span>
              <div className="mastery-detail-event-main">
                <div className="mastery-detail-event-heading">
                  <p>
                    <time>{event.occurredAtLabel}</time>
                    <span> · {event.sourceTypeLabel}</span>
                  </p>
                  <strong>{event.resultLabel}</strong>
                </div>
                <p aria-label={event.detailAriaLabel} className="mastery-detail-event-detail">{event.detail}</p>
                <div className="mastery-detail-event-meta">
                  <span>{event.effectLabel}</span>
                </div>
              </div>
              <button
                aria-controls={`source-preview-${event.id}`}
                aria-expanded={sourceOpen}
                className="mastery-detail-source-button"
                type="button"
                onClick={() => {
                  setOpenSourceId(sourceOpen ? null : event.id);
                }}
              >
                {event.actionLabel}
                <Icon name="arrowRight" size={16} />
              </button>
              {sourceOpen ? (
                <EvidenceSourcePreview
                  event={event}
                  onClose={() => {
                    setOpenSourceId(null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ObservationExplanation({ document }: { readonly document: MasteryDetailDocument }) {
  return (
    <section aria-labelledby="mastery-detail-observation-title" className="mastery-detail-observation">
      <SectionTitle id="mastery-detail-observation-title" title="为什么仍需观察" />
      <DefinitionList rows={document.observationRows} />
      <p>{document.observationConclusion}</p>
    </section>
  );
}

function SuggestedAction({
  course,
  document,
}: {
  readonly course: CourseSummary;
  readonly document: MasteryDetailDocument;
}) {
  const action = document.suggestedAction;
  const primaryUrl = action.primaryTargetMapping === null ? null : buildKnowledgePointUrl(course, action.primaryTargetMapping);
  const overviewUrl = buildOverviewUrl(course, action.overviewTargetId);
  const wrongItemUrl = action.relatedWrongItemTargetMapping === null
    ? null
    : buildWrongItemUrl(course, action.relatedWrongItemTargetMapping);

  return (
    <section aria-labelledby="mastery-detail-action-title" className="mastery-detail-action">
      <div>
        <h2 id="mastery-detail-action-title">{action.title}</h2>
        <p>{action.meta}</p>
      </div>
      <div className="mastery-detail-action-row">
        {primaryUrl === null ? (
          <span aria-disabled="true" className="mastery-detail-primary is-disabled">{action.primaryActionLabel}</span>
        ) : (
          <Link className="mastery-detail-primary" to={primaryUrl}>
            {action.primaryActionLabel}
            <Icon name="arrowRight" size={16} />
          </Link>
        )}
        <Link className="mastery-detail-secondary" to={overviewUrl}>{action.secondaryActionLabel}</Link>
        {wrongItemUrl === null ? (
          <span aria-disabled="true" className="mastery-detail-quiet">{action.relatedActionLabel}</span>
        ) : (
          <Link className="mastery-detail-quiet" to={wrongItemUrl}>{action.relatedActionLabel}</Link>
        )}
      </div>
      <p className="mastery-detail-target-notice">{action.targetMappingNotice}</p>
    </section>
  );
}

function MasteryDetailRightRail({ document }: { readonly document: MasteryDetailDocument }) {
  return (
    <aside aria-label="知识点掌握详情辅助信息" className="mastery-detail-right-rail">
      <SectionTitle id="mastery-detail-summary-title" title="判断摘要" />
      <DefinitionList rows={document.summaryRows} />
      <SectionTitle id="mastery-detail-composition-title" title="证据组成" />
      <DefinitionList rows={document.compositionRows} />
      <SectionTitle id="mastery-detail-reliability-title" title="可靠性说明" />
      <DefinitionList rows={document.reliabilityRows} />
      <SectionTitle id="mastery-detail-privacy-title" title="服务与隐私" />
      <DefinitionList rows={document.privacyRows} />
    </aside>
  );
}

function MasteryDetailRailCompact({ document }: { readonly document: MasteryDetailDocument }) {
  return (
    <details className="mastery-detail-rail-compact">
      <summary>查看判断摘要、证据组成、可靠性与隐私</summary>
      <div>
        <SectionTitle id="mastery-detail-compact-summary-title" title="判断摘要" />
        <DefinitionList rows={document.summaryRows} />
        <SectionTitle id="mastery-detail-compact-composition-title" title="证据组成" />
        <DefinitionList rows={document.compositionRows} />
        <SectionTitle id="mastery-detail-compact-reliability-title" title="可靠性说明" />
        <DefinitionList rows={document.reliabilityRows} />
        <SectionTitle id="mastery-detail-compact-privacy-title" title="服务与隐私" />
        <DefinitionList rows={document.privacyRows} />
      </div>
    </details>
  );
}

function MasteryDetailReady({
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
  readonly document: MasteryDetailDocument;
}) {
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  return (
    <div className="app-shell mastery-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="mastery-evidence" currentUser={currentUser} demoActive={demoActive} />
      <MasteryDetailMobileMenu />
      <main className="paper-canvas mastery-detail-canvas" id="main-content">
        <MasteryDetailHeader dateTime={dateTime} document={document} />
        <div className="mastery-detail-grid">
          <article aria-label="知识点掌握详情" className="mastery-detail-main">
            <MasteryJudgmentSummary document={document} />
            <EvidenceTimeline rows={document.evidenceRows} />
            <ObservationExplanation document={document} />
            <SuggestedAction course={course} document={document} />
            {sourceBoundary === undefined ? null : <p className="mastery-detail-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="mastery-detail-rail-divider" />
          <MasteryDetailRightRail document={document} />
          <MasteryDetailRailCompact document={document} />
        </div>
      </main>
    </div>
  );
}

function MasteryDetailUnavailableSurface({
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
    <div className="app-shell mastery-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="mastery-evidence" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page mastery-detail-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="MASTERY_DETAIL_UNAVAILABLE：当前不会展示虚构 knowledgePointId、sourceObjectId、证据事件、来源对象、判断分类、快照版本、建议目标、百分比、排名或雷达图。"
          title="知识点掌握详情服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function MasteryDetailLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell mastery-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="mastery-evidence" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas mastery-detail-canvas" id="main-content">
        <div aria-label="正在加载知识点掌握详情" className="page-loading mastery-detail-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface MasteryDetailRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function MasteryDetailRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  knowledgePointId,
  overviewUrl,
  targetId,
}: MasteryDetailRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null && knowledgePointId !== null) {
      return course.masteryDetails?.find((item) => item.targetId === targetId && item.knowledgePointId === knowledgePointId);
    }
    if (targetId !== null) {
      return course.masteryDetails?.find((item) => item.targetId === targetId);
    }
    if (knowledgePointId !== null) {
      return course.masteryDetails?.find((item) => item.knowledgePointId === knowledgePointId);
    }
    return course.masteryDetails?.[0];
  }, [course.masteryDetails, knowledgePointId, targetId]);

  if (document === undefined) {
    return (
      <MasteryDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-030 知识点掌握详情文档；生产环境不会用开发 Fixture 补 sourceObjectId、证据事件、分类理由或建议路由。"
        title="知识点掌握详情"
      />
    );
  }

  if (document.status === "LOADING") {
    return <MasteryDetailLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableMasteryDetail(document)) {
    return (
      <MasteryDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="知识点掌握详情不可用；当前不会回退到 Fixture，也不会按标题、序号或本地行数据生成证据对象。"
        title="知识点掌握详情"
      />
    );
  }

  return (
    <MasteryDetailReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function MasteryDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的知识点掌握详情服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "知识点掌握详情",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <MasteryDetailUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
