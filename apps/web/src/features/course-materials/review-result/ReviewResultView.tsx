import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ReviewResultAnswerJudgement,
  ReviewResultAnswerRow,
  ReviewResultDocument,
  ReviewResultMetric,
  ReviewResultReason,
  ReviewResultStatus,
  ReviewResultTimelineStage,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly ReviewResultStatus[] = [
  "PASSED_RECOVERED",
  "MASTERY_EVIDENCE_UPDATED",
  "MASTERY_UPDATE_PENDING",
  "OFFLINE_READONLY",
];

const unavailableCopy: Record<Exclude<ReviewResultStatus, "PASSED_RECOVERED" | "MASTERY_EVIDENCE_UPDATED" | "MASTERY_UPDATE_PENDING" | "OFFLINE_READONLY">, { readonly title: string; readonly subtitle: string }> = {
  LOADING: {
    title: "复习结果",
    subtitle: "正在读取复习结果；加载时不会闪现旧答案、示例题或伪造恢复状态。",
  },
  FAILED_RESCHEDULED: {
    title: "复习结果",
    subtitle: "复习未通过时必须由服务端返回新安排；当前不会前端标记已恢复。",
  },
  PARTIALLY_JUDGED: {
    title: "复习结果",
    subtitle: "部分可判时不能把不可判项当作正确，也不能把本条错题标记为已恢复。",
  },
  RESULT_UNKNOWN: {
    title: "复习结果未知",
    subtitle: "REVIEW_RESULT_UNKNOWN：需要查询原 review，不能由前端猜测恢复、重排或掌握证据。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "复习结果不可用",
    subtitle: "当前 review 不在学生 OWN 范围内；无权和不存在统一不泄露。",
  },
  SESSION_EXPIRED: {
    title: "复习结果",
    subtitle: "学生身份需要刷新；失败时返回错题本，不展示虚构结果。",
  },
};

function getUnavailableCopy(status: ReviewResultStatus): { readonly title: string; readonly subtitle: string } {
  if (
    status === "LOADING" ||
    status === "FAILED_RESCHEDULED" ||
    status === "PARTIALLY_JUDGED" ||
    status === "RESULT_UNKNOWN" ||
    status === "DENIED_AS_NOT_FOUND" ||
    status === "SESSION_EXPIRED"
  ) {
    return unavailableCopy[status];
  }
  return {
    title: "复习结果",
    subtitle: "当前复习结果状态不能作为已恢复结果展示；页面不会猜测错题恢复或掌握证据。",
  };
}

function isDisplayableReviewResult(review: ReviewResultDocument): boolean {
  return displayableStatuses.includes(review.status);
}

function buildWrongBookUrl(course: CourseSummary, review: ReviewResultDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: review.wrongBookTargetId,
    term: course.term,
    view: "wrong-book",
  });
  return `/student/learn?${params.toString()}`;
}

function buildKnowledgeEvidenceUrl(course: CourseSummary, review: ReviewResultDocument): string {
  const params = new URLSearchParams({
    action: "EVIDENCE",
    grade: String(course.grade),
    knowledge: review.knowledgeEvidenceTargetId,
    subject: course.subjectCode,
    term: course.term,
    view: "knowledge-point-target",
  });
  return `/student/learn?${params.toString()}`;
}

function buildNextUrl(course: CourseSummary, review: ReviewResultDocument): string | null {
  if (review.nextRecommendedTargetId === undefined) {
    return null;
  }
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: review.nextRecommendedTargetId,
    term: course.term,
    view: "wrong-book",
  });
  return `/student/learn?${params.toString()}`;
}

function ReviewResultDefinitionList({ rows }: { readonly rows: readonly DefinitionRow[] }) {
  return (
    <dl className="review-result-definition-list">
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewResultSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="review-result-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ReviewResultMobileMenu({
  wrongBookUrl,
}: {
  readonly wrongBookUrl: string;
}) {
  return (
    <details className="review-result-mobile-menu">
      <summary aria-label="打开移动端复习结果导航">
        <span>
          <strong>清朗学习</strong>
          <small>复习结果</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端复习结果功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={wrongBookUrl}>错题本</Link>
        <span aria-current="page">复习结果</span>
      </nav>
    </details>
  );
}

function ReviewResultHeader({
  dateTime,
  review,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly review: ReviewResultDocument;
}) {
  const dateLabel = review.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = review.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const resultPrefix = `${review.resultStatusLabel} · `;
  const statusDetail = review.updatedAtLabel.startsWith(resultPrefix)
    ? review.updatedAtLabel.slice(resultPrefix.length)
    : review.updatedAtLabel;
  return (
    <header className="page-header review-result-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb review-result-breadcrumb">
          {review.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="review-result-header-title">
          <h1>{review.title}</h1>
          <p>{review.subtitle}</p>
        </div>
      </div>
      <div className="page-date review-result-date" aria-label={`${dateLabel}，${weekdayLabel}，${review.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{review.resultStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ResultMetric({ metric }: { readonly metric: ReviewResultMetric }) {
  const sourceLabel = metric.source === "SERVER_CONFIRMED" ? "服务端确认" : "服务处理中";
  return (
    <li>
      <strong>{metric.value}</strong>
      <span>{metric.label}</span>
      <small>{sourceLabel}</small>
    </li>
  );
}

function ReviewResultSummary({ review }: { readonly review: ReviewResultDocument }) {
  return (
    <section className="review-result-summary" aria-labelledby="review-result-summary-title">
      <ReviewResultSectionTitle id="review-result-summary-title" title="本次结果" />
      <div className="review-result-summary-body">
        <div className="review-result-large-number" aria-label={`${review.largeNumber} ${review.largeNumberCaption}`}>
          <strong>{review.largeNumber}</strong>
          <span>{review.largeNumberCaption}</span>
        </div>
        <div className="review-result-summary-copy">
          <p>{review.summaryText}</p>
          <ol className="review-result-metrics" aria-label="本次复习结果指标">
            {review.metrics.map((metric) => <ResultMetric key={metric.id} metric={metric} />)}
          </ol>
          <p className="review-result-evidence-boundary">
            <span aria-hidden="true" />
            {review.evidenceBoundary}
          </p>
        </div>
      </div>
    </section>
  );
}

function judgementClassName(judgement: ReviewResultAnswerJudgement): string {
  return judgement === "CORRECT"
    ? "is-correct"
    : judgement === "WRONG"
    ? "is-wrong"
    : "is-unjudgeable";
}

function ReviewAnswerRows({ rows }: { readonly rows: readonly ReviewResultAnswerRow[] }) {
  return (
    <dl className="review-result-answer-list">
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.answer}</dd>
          <dd className={judgementClassName(row.judgement)}>{row.judgementLabel}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewResultAnswer({ review }: { readonly review: ReviewResultDocument }) {
  return (
    <section className="review-result-answer" aria-labelledby="review-result-answer-title">
      <ReviewResultSectionTitle id="review-result-answer-title" title={review.answerSectionTitle} />
      <div className="review-result-answer-body">
        <div>
          <h3>{review.answerTopicTitle}</h3>
          <p className="review-result-equation">{review.answerQuestionText}</p>
          <p>{review.answerPrompt}</p>
          <ReviewAnswerRows rows={review.answerRows} />
          <p className="review-result-analysis">{review.analysisText}</p>
          <p className="review-result-answer-source">{review.answerSourceLabel}</p>
        </div>
        <RecoveryReasons review={review} />
      </div>
    </section>
  );
}

function RecoveryReasons({ review }: { readonly review: ReviewResultDocument }) {
  return (
    <section className="review-result-reasons" aria-labelledby="review-result-reasons-title">
      <ReviewResultSectionTitle id="review-result-reasons-title" title={review.recoveryReasonTitle} />
      <dl>
        {review.recoveryReasons.map((reason: ReviewResultReason) => (
          <div key={reason.id}>
            <dt>{reason.label}</dt>
            <dd>{reason.value}</dd>
          </div>
        ))}
      </dl>
      <p>{review.recoveryReasonSummary}</p>
    </section>
  );
}

function timelineClassName(stage: ReviewResultTimelineStage): string {
  return stage.state === "CURRENT"
    ? "is-current"
    : stage.state === "COMPLETE"
    ? "is-complete"
    : stage.state === "UNAVAILABLE"
    ? "is-unavailable"
    : "is-pending";
}

function ReviewResultTimeline({ review }: { readonly review: ReviewResultDocument }) {
  return (
    <section className="review-result-timeline-section" aria-labelledby="review-result-timeline-title">
      <ReviewResultSectionTitle id="review-result-timeline-title" title={review.timelineTitle} />
      <ol className="review-result-timeline" aria-label="错题恢复证据路径">
        {review.timelineStages.map((stage, index) => (
          <li
            aria-current={stage.state === "CURRENT" ? "step" : undefined}
            className={timelineClassName(stage)}
            key={stage.id}
          >
            <span>{String(index + 1)}</span>
            <strong>{stage.label}</strong>
            <small>{stage.caption}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReviewResultActions({
  knowledgeEvidenceUrl,
  nextUrl,
  onContinueFallback,
  review,
  wrongBookUrl,
}: {
  readonly knowledgeEvidenceUrl: string;
  readonly nextUrl: string | null;
  readonly onContinueFallback: () => void;
  readonly review: ReviewResultDocument;
  readonly wrongBookUrl: string;
}) {
  return (
    <section className="review-result-actions" aria-label="复习结果下一步">
      <div>
        <Link className="primary-button" to={knowledgeEvidenceUrl}>
          <span>{review.primaryActionLabel}</span>
          <Icon name="arrowRight" size={22} />
        </Link>
        <Link className="text-button" to={wrongBookUrl}>{review.wrongBookActionLabel}</Link>
        {nextUrl === null ? (
          <button className="text-button" onClick={onContinueFallback} type="button">
            {review.continueActionLabel}
          </button>
        ) : (
          <Link className="text-button" to={nextUrl}>{review.continueActionLabel}</Link>
        )}
      </div>
      <p>{review.nextStepNotice}</p>
    </section>
  );
}

function ReviewResultRailSection({
  children,
  rows,
  title,
}: {
  readonly children?: ReactNode;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  return (
    <section className="review-result-rail-section">
      <div className="review-result-rail-title">
        <h2>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <ReviewResultDefinitionList rows={rows} />
      {children}
    </section>
  );
}

function ReviewResultRightRail({
  compact = false,
  review,
}: {
  readonly compact?: boolean;
  readonly review: ReviewResultDocument;
}) {
  return (
    <aside aria-label={compact ? "复习结果折叠辅助信息" : "复习结果辅助信息"} className="review-result-rail">
      <ReviewResultRailSection rows={review.resultRows} title="结果确认" />
      <ReviewResultRailSection rows={review.wrongStatusRows} title="错题状态" />
      <ReviewResultRailSection rows={review.masteryImpactRows} title="掌握证据影响" />
      <ReviewResultRailSection rows={review.privacyRows} title="服务与隐私">
        {review.status === "RESULT_UNKNOWN" ? <p className="review-result-service-code">{review.serviceCode}</p> : null}
      </ReviewResultRailSection>
    </aside>
  );
}

function ReviewResultRailCompact({ review }: { readonly review: ReviewResultDocument }) {
  return (
    <details className="review-result-collapsible">
      <summary>
        <span>结果、错题与证据</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="review-result-collapsible-content">
        <ReviewResultRightRail compact review={review} />
      </div>
    </details>
  );
}

function ReviewResultReady({
  course,
  currentUser,
  dateTime,
  demoActive,
  review,
}: {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly review: ReviewResultDocument;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const wrongBookUrl = buildWrongBookUrl(course, review);
  const knowledgeEvidenceUrl = buildKnowledgeEvidenceUrl(course, review);
  const nextUrl = buildNextUrl(course, review);
  const sourceBoundary = demoActive ? review.sourceBoundary : undefined;

  useEffect(() => {
    if (message !== null) {
      announcementRef.current?.focus();
    }
  }, [message]);

  return (
    <div className="app-shell review-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <ReviewResultMobileMenu wrongBookUrl={wrongBookUrl} />
      <main className="paper-canvas review-result-canvas" id="main-content">
        <ReviewResultHeader dateTime={dateTime} review={review} />
        <div className="review-result-layout">
          <article className="review-result-main" aria-label="复习结果">
            <ReviewResultSummary review={review} />
            <ReviewResultAnswer review={review} />
            <ReviewResultTimeline review={review} />
            <ReviewResultActions
              knowledgeEvidenceUrl={knowledgeEvidenceUrl}
              nextUrl={nextUrl}
              onContinueFallback={() => { setMessage(review.continueFallbackMessage); }}
              review={review}
              wrongBookUrl={wrongBookUrl}
            />
            <p aria-live="polite" className="review-result-action-message" ref={announcementRef} tabIndex={-1}>
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="review-result-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="review-result-rail-divider" />
          <ReviewResultRightRail review={review} />
          <ReviewResultRailCompact review={review} />
        </div>
      </main>
    </div>
  );
}

function ReviewResultUnavailableSurface({
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
    <div className="app-shell review-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page review-result-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="REVIEW_RESULT_UNKNOWN：当前不会展示虚构结果、wrongItem恢复状态、knowledgePointId、LearningEvidence、RecoveryAttempt、Mastery、预算或云端笔记。"
          title="复习结果服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function ReviewResultLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell review-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas review-result-canvas" id="main-content">
        <div aria-label="正在加载复习结果" className="page-loading review-result-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface ReviewResultRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly reviewId: string | null;
  readonly targetId: string | null;
  readonly wrongItemId: string | null;
}

export function ReviewResultRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  reviewId,
  targetId,
  wrongItemId,
}: ReviewResultRouteProps) {
  const review = useMemo(() => {
    if (targetId === null) {
      return reviewId === null && wrongItemId === null
        ? course.reviewResults?.[0]
        : course.reviewResults?.find((item) =>
          (reviewId === null || item.reviewId === reviewId) &&
          (wrongItemId === null || item.wrongItemId === wrongItemId),
        );
    }
    const targetReview = course.reviewResults?.find((item) => item.targetId === targetId);
    if (targetReview === undefined) {
      return undefined;
    }
    if (reviewId !== null && targetReview.reviewId !== reviewId) {
      return undefined;
    }
    if (wrongItemId !== null && targetReview.wrongItemId !== wrongItemId) {
      return undefined;
    }
    return targetReview;
  }, [course.reviewResults, reviewId, targetId, wrongItemId]);

  if (review === undefined) {
    return (
      <ReviewResultServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-023 复习结果文档；生产环境不会用开发 Fixture 补 reviewId、恢复结果或掌握证据。"
        title="复习结果"
      />
    );
  }

  if (review.status === "LOADING") {
    return <ReviewResultLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableReviewResult(review)) {
    const copy = getUnavailableCopy(review.status);
    return (
      <ReviewResultServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.subtitle}
        title={copy.title}
      />
    );
  }

  return (
    <ReviewResultReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      review={review}
    />
  );
}

export function ReviewResultServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的复习结果服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "复习结果",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <ReviewResultUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
