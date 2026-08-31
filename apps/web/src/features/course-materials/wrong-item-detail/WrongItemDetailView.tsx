import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  WrongItemDetailDocument,
  WrongItemDetailStatus,
  WrongItemTimelineStage,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly WrongItemDetailStatus[] = [
  "PENDING_CORRECTION",
  "CORRECTION_IN_PROGRESS",
  "PENDING_REVIEW",
  "REVIEW_DUE",
  "RECOVERED",
  "ORIGINAL_ASSET_DELETED",
  "EVIDENCE_INSUFFICIENT",
  "OFFLINE_READONLY",
];

function isDisplayableWrongItemDetail(document: WrongItemDetailDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildWrongBookUrl(course: CourseSummary, document: WrongItemDetailDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    term: course.term,
    subject: course.subjectCode,
    target: document.wrongBookTargetId,
    view: "wrong-book",
  });
  return `/student/learn?${params.toString()}`;
}

function buildPracticeResultUrl(course: CourseSummary, document: WrongItemDetailDocument): string {
  const params = new URLSearchParams({
    attempt: document.practiceResultAttemptId,
    chapter: document.practiceResultChapterId,
    grade: String(course.grade),
    knowledge: document.practiceResultKnowledgePointId,
    subject: course.subjectCode,
    target: document.practiceResultTargetId,
    term: course.term,
    view: "practice-result",
  });
  return `/student/learn?${params.toString()}`;
}

function buildCorrectionUrl(course: CourseSummary, document: WrongItemDetailDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.correctionTargetId,
    term: course.term,
    view: "wrong-item-correction",
    wrongItem: document.wrongItemId,
  });
  return `/student/learn?${params.toString()}`;
}

function WrongItemMobileMenu({ wrongBookUrl }: { readonly wrongBookUrl: string }) {
  return (
    <details className="wrong-detail-mobile-menu">
      <summary aria-label="打开移动端错题详情导航">
        <span>
          <strong>清朗学习</strong>
          <small>错题详情</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端错题详情功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={wrongBookUrl}>错题本</Link>
        <span aria-current="page">错题详情</span>
      </nav>
    </details>
  );
}

function WrongItemDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["wrong-detail-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WrongItemSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="wrong-detail-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function WrongItemHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: WrongItemDetailDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-22" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.statusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;
  return (
    <header className="page-header wrong-detail-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb wrong-detail-breadcrumb">
          {document.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="wrong-detail-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date wrong-detail-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.statusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function WrongItemQuestion({ document }: { readonly document: WrongItemDetailDocument }) {
  return (
    <section className="wrong-detail-question" aria-labelledby="wrong-detail-question-title">
      <WrongItemSectionTitle id="wrong-detail-question-title" title="原题与原答" />
      <div className="wrong-detail-question-layout">
        <div className="wrong-detail-question-number" aria-label={document.questionNumberCaption}>
          <strong>{document.questionNumber}</strong>
          <span>{document.questionNumberCaption}</span>
        </div>
        <article className="wrong-detail-question-body" aria-label="错题事实">
          <h3>{document.itemTitle}</h3>
          <p className="wrong-detail-scope">{document.scopeLabel}</p>
          <p className="wrong-detail-question-text">{document.questionText}</p>
          <p className="wrong-detail-source">{document.sourceLabel}</p>
          <div className="wrong-detail-answer-comparison" aria-label="原答与正确结论">
            <div>
              <span>{document.originalAnswerLabel}</span>
              <strong className="is-original-answer">{document.originalAnswer}</strong>
            </div>
            <span aria-hidden="true" className="wrong-detail-answer-divider" />
            <div>
              <span>{document.correctAnswerLabel}</span>
              <strong className="is-correct-answer">{document.correctAnswer}</strong>
            </div>
          </div>
          <p className="wrong-detail-answer-boundary">{document.answerBoundary}</p>
        </article>
      </div>
    </section>
  );
}

function WrongItemStructuredCause({ document }: { readonly document: WrongItemDetailDocument }) {
  return (
    <section className="wrong-detail-cause" aria-labelledby="wrong-detail-cause-title">
      <WrongItemSectionTitle id="wrong-detail-cause-title" title="结构化错因" />
      <WrongItemDefinitionList className="wrong-detail-cause-list" rows={document.causeRows} />
      <p>{document.causeExplanation}</p>
    </section>
  );
}

function timelineStageClass(stage: WrongItemTimelineStage): string {
  return stage.state === "CONFIRMED"
    ? "is-confirmed"
    : stage.state === "CURRENT"
    ? "is-current"
    : stage.state === "UNAVAILABLE"
    ? "is-unavailable"
    : "is-pending";
}

function WrongItemTimeline({ stages }: { readonly stages: readonly WrongItemTimelineStage[] }) {
  return (
    <section className="wrong-detail-timeline-section" aria-labelledby="wrong-detail-timeline-title">
      <WrongItemSectionTitle id="wrong-detail-timeline-title" title="状态记录" />
      <ol className="wrong-detail-timeline">
        {stages.map((stage, index) => (
          <li
            aria-current={stage.state === "CURRENT" ? "step" : undefined}
            className={timelineStageClass(stage)}
            key={stage.id}
          >
            <span aria-hidden="true">{index + 1}</span>
            <strong>{stage.label}</strong>
            <small>{stage.caption}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WrongItemActionBar({
  correctionUrl,
  document,
  practiceResultUrl,
  wrongBookUrl,
}: {
  readonly correctionUrl: string;
  readonly document: WrongItemDetailDocument;
  readonly practiceResultUrl: string;
  readonly wrongBookUrl: string;
}) {
  const disabled = document.status === "EVIDENCE_INSUFFICIENT" || document.status === "OFFLINE_READONLY";
  return (
    <section className="wrong-detail-actions" aria-labelledby="wrong-detail-actions-title">
      <WrongItemSectionTitle id="wrong-detail-actions-title" title="下一步" />
      <div className="wrong-detail-action-row">
        {disabled ? (
          <button
            className="wrong-detail-primary-action"
            disabled
            type="button"
          >
            <span>{document.primaryActionLabel}</span>
            <Icon name="arrowRight" size={22} />
          </button>
        ) : (
          <Link className="wrong-detail-primary-action" to={correctionUrl}>
            <span>{document.primaryActionLabel}</span>
            <Icon name="arrowRight" size={22} />
          </Link>
        )}
        <Link className="text-button wrong-detail-secondary-link" to={wrongBookUrl}>
          {document.returnActionLabel}
        </Link>
        <span aria-hidden="true" className="wrong-detail-action-divider" />
        <Link className="text-button wrong-detail-secondary-link" to={practiceResultUrl}>
          {document.resultActionLabel}
        </Link>
      </div>
      <p>{document.evidenceNotice}</p>
    </section>
  );
}

function WrongItemRightRail({
  document,
  onViewSubmission,
}: {
  readonly document: WrongItemDetailDocument;
  readonly onViewSubmission: () => void;
}) {
  return (
    <aside className="wrong-detail-rail" aria-label="错题详情辅助信息">
      <section className="wrong-detail-rail-section" aria-labelledby="wrong-detail-status-title">
        <WrongItemSectionTitle id="wrong-detail-status-title" title="当前状态" />
        <WrongItemDefinitionList rows={document.currentStatusRows} />
      </section>
      <section className="wrong-detail-rail-section" aria-labelledby="wrong-detail-reliability-title">
        <WrongItemSectionTitle id="wrong-detail-reliability-title" title="证据可靠性" />
        <WrongItemDefinitionList rows={document.reliabilityRows} />
      </section>
      <section className="wrong-detail-rail-section" aria-labelledby="wrong-detail-source-title">
        <WrongItemSectionTitle id="wrong-detail-source-title" title="来源信息" />
        <WrongItemDefinitionList rows={document.sourceRows} />
        <button className="text-button wrong-detail-submission-button" onClick={onViewSubmission} type="button">
          查看提交记录
        </button>
      </section>
      <section className="wrong-detail-rail-section" aria-labelledby="wrong-detail-privacy-title">
        <WrongItemSectionTitle id="wrong-detail-privacy-title" title="服务与隐私" />
        <WrongItemDefinitionList rows={document.privacyRows} />
      </section>
    </aside>
  );
}

function WrongItemRailCompact({
  document,
  onViewSubmission,
}: {
  readonly document: WrongItemDetailDocument;
  readonly onViewSubmission: () => void;
}) {
  return (
    <details className="wrong-detail-collapsible">
      <summary>当前状态、证据与隐私</summary>
      <div className="wrong-detail-collapsible-content">
        <WrongItemRightRail document={document} onViewSubmission={onViewSubmission} />
      </div>
    </details>
  );
}

function WrongItemReady({
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
  readonly document: WrongItemDetailDocument;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const wrongBookUrl = buildWrongBookUrl(course, document);
  const practiceResultUrl = buildPracticeResultUrl(course, document);
  const correctionUrl = buildCorrectionUrl(course, document);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message !== null) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function viewSubmission(): void {
    setMessage(document.submissionUnavailableMessage);
  }

  return (
    <div className="app-shell wrong-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <WrongItemMobileMenu wrongBookUrl={wrongBookUrl} />
      <main className="paper-canvas wrong-detail-canvas" id="main-content">
        <WrongItemHeader dateTime={dateTime} document={document} />
        <div className="wrong-detail-grid">
          <article className="wrong-detail-main" aria-label="错题详情">
            <WrongItemQuestion document={document} />
            <WrongItemStructuredCause document={document} />
            <WrongItemTimeline stages={document.timelineStages} />
            <WrongItemActionBar
              correctionUrl={correctionUrl}
              document={document}
              practiceResultUrl={practiceResultUrl}
              wrongBookUrl={wrongBookUrl}
            />
            <p
              aria-live="polite"
              className="wrong-detail-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="wrong-detail-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="wrong-detail-rail-divider" />
          <WrongItemRightRail document={document} onViewSubmission={viewSubmission} />
          <WrongItemRailCompact document={document} onViewSubmission={viewSubmission} />
        </div>
      </main>
    </div>
  );
}

function WrongItemUnavailableSurface({
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
    <div className="app-shell wrong-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page wrong-detail-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="WRONG_ITEM_DETAIL_UNAVAILABLE：当前不会展示虚构原题、原答、判定、错因、私题原图、订正状态、RecoveryAttempt、Mastery、预算或云端笔记。"
          title="错题详情服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function WrongItemLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell wrong-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas wrong-detail-canvas" id="main-content">
        <div aria-label="正在加载错题详情" className="page-loading wrong-detail-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface WrongItemDetailRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
  readonly wrongItemId: string | null;
}

export function WrongItemDetailRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
  wrongItemId,
}: WrongItemDetailRouteProps) {
  const document = useMemo(() => {
    if (targetId === null) {
      return wrongItemId === null
        ? course.wrongItemDetails?.[0]
        : course.wrongItemDetails?.find((item) => item.wrongItemId === wrongItemId);
    }
    const targetDocument = course.wrongItemDetails?.find((item) => item.targetId === targetId);
    if (targetDocument === undefined) {
      return undefined;
    }
    if (wrongItemId !== null && targetDocument.wrongItemId !== wrongItemId) {
      return undefined;
    }
    return targetDocument;
  }, [course.wrongItemDetails, targetId, wrongItemId]);

  if (document === undefined) {
    return (
      <WrongItemDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-020 错题详情文档；生产环境不会用开发 Fixture 补原题、原答、错因或状态。"
        title="错题详情"
      />
    );
  }

  if (document.status === "LOADING") {
    return <WrongItemLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableWrongItemDetail(document)) {
    return (
      <WrongItemDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="错题详情不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或猜测题目。"
        title="错题详情"
      />
    );
  }

  return (
    <WrongItemReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function WrongItemDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的错题详情服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "错题详情",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <WrongItemUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
