import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ScheduledReviewAnswerField,
  ScheduledReviewAttemptDocument,
  ScheduledReviewAttemptStatus,
  ScheduledReviewEligibilityStep,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly ScheduledReviewAttemptStatus[] = [
  "DUE_ANSWERING",
  "DRAFT_SAVING",
  "DRAFT_SAVED_LOCAL",
  "DRAFT_SAVED_SERVER",
  "SUBMITTING",
  "NETWORK_FAILURE_RETRYABLE",
  "SUBMISSION_UNKNOWN",
  "OFFLINE_DRAFT",
];

function isDisplayableReview(document: ScheduledReviewAttemptDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildDetailUrl(course: CourseSummary, document: ScheduledReviewAttemptDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.detailTargetId,
    term: course.term,
    view: "wrong-item-detail",
    wrongItem: document.wrongItemId,
  });
  return `/student/learn?${params.toString()}`;
}

function buildWrongBookUrl(course: CourseSummary, document: ScheduledReviewAttemptDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.wrongBookTargetId,
    term: course.term,
    view: "wrong-book",
  });
  return `/student/learn?${params.toString()}`;
}

function buildInitialFieldValues(fields: readonly ScheduledReviewAnswerField[]): Record<string, string> {
  const values: Record<string, string> = {};
  fields.forEach((field) => {
    values[field.name] = field.value;
  });
  return values;
}

function countCharacters(value: string): number {
  return Array.from(value).length;
}

function ReviewDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["scheduled-review-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReviewSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="scheduled-review-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ReviewMobileMenu({
  detailUrl,
  wrongBookUrl,
}: {
  readonly detailUrl: string;
  readonly wrongBookUrl: string;
}) {
  return (
    <details className="scheduled-review-mobile-menu">
      <summary aria-label="打开移动端到期复习导航">
        <span>
          <strong>清朗学习</strong>
          <small>到期复习</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端到期复习功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={wrongBookUrl}>错题本</Link>
        <Link to={detailUrl}>错题详情</Link>
        <span aria-current="page">到期复习</span>
      </nav>
    </details>
  );
}

function ReviewHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: ScheduledReviewAttemptDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const gatePrefix = `${document.gateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(gatePrefix)
    ? document.updatedAtLabel.slice(gatePrefix.length)
    : document.updatedAtLabel;
  return (
    <header className="page-header scheduled-review-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb scheduled-review-breadcrumb">
          {document.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="scheduled-review-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date scheduled-review-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.gateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function eligibilityStepClass(step: ScheduledReviewEligibilityStep): string {
  return step.state === "COMPLETE"
    ? "is-complete"
    : step.state === "CURRENT"
    ? "is-current"
    : step.state === "UNAVAILABLE"
    ? "is-unavailable"
    : "is-pending";
}

function ReviewEligibilityPath({ steps }: { readonly steps: readonly ScheduledReviewEligibilityStep[] }) {
  return (
    <ol className="scheduled-review-path" aria-label="到期复习门控路径">
      {steps.map((step) => (
        <li
          aria-current={step.state === "CURRENT" ? "step" : undefined}
          className={eligibilityStepClass(step)}
          key={step.id}
        >
          <strong>{step.label}</strong>
          <span>{step.caption}</span>
        </li>
      ))}
    </ol>
  );
}

function ReviewQuestion({ document }: { readonly document: ScheduledReviewAttemptDocument }) {
  return (
    <section className="scheduled-review-question-section" aria-labelledby="scheduled-review-question-title">
      <div className="scheduled-review-question-layout">
        <div className="scheduled-review-large-number" aria-label={document.largeNumberCaption}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <article className="scheduled-review-question" aria-label="到期复习新变式题">
          <h2 id="scheduled-review-question-title">{document.questionTitle}</h2>
          <p className="scheduled-review-scope">{document.scopeLabel}</p>
          <p className="scheduled-review-variant">{document.variantRelationLabel}</p>
          <p className="scheduled-review-question-text">{document.questionText}</p>
          <p className="scheduled-review-protection">{document.protectedHistoryNotice}</p>
          <p className="scheduled-review-muted">{document.noHintNotice}</p>
        </article>
      </div>
    </section>
  );
}

function ReviewAnswerField({
  field,
  onValueChange,
  value,
}: {
  readonly field: ScheduledReviewAnswerField;
  readonly onValueChange: (name: string, value: string) => void;
  readonly value: string;
}) {
  const countLabel = field.maxLength === undefined
    ? null
    : `${String(countCharacters(value))} / ${String(field.maxLength)}`;
  return (
    <div className="scheduled-review-field">
      <label htmlFor={`scheduled-review-${field.name}`}>{field.label}</label>
      {field.kind === "TEXTAREA" ? (
        <textarea
          id={`scheduled-review-${field.name}`}
          maxLength={field.maxLength}
          onChange={(event) => {
            onValueChange(field.name, event.currentTarget.value);
          }}
          placeholder={field.placeholder}
          rows={4}
          value={value}
        />
      ) : (
        <input
          autoComplete="off"
          id={`scheduled-review-${field.name}`}
          inputMode={field.inputMode}
          onChange={(event) => {
            onValueChange(field.name, event.currentTarget.value);
          }}
          placeholder={field.placeholder}
          value={value}
        />
      )}
      {countLabel === null ? null : <span className="scheduled-review-char-count">{countLabel}</span>}
    </div>
  );
}

function ReviewAnswerForm({
  document,
  fieldValues,
  onValueChange,
}: {
  readonly document: ScheduledReviewAttemptDocument;
  readonly fieldValues: Readonly<Record<string, string>>;
  readonly onValueChange: (name: string, value: string) => void;
}) {
  return (
    <section className="scheduled-review-answer-section" aria-labelledby="scheduled-review-answer-title">
      <ReviewSectionTitle id="scheduled-review-answer-title" title="我的复习作答" />
      <div className="scheduled-review-answer-fields">
        {document.fields.map((field) => (
          <ReviewAnswerField
            field={field}
            key={field.id}
            onValueChange={onValueChange}
            value={fieldValues[field.name] ?? ""}
          />
        ))}
      </div>
      <p className="scheduled-review-save-line">{document.draftStatusLine}</p>
    </section>
  );
}

function rowsForSubmissionStatus(
  document: ScheduledReviewAttemptDocument,
  status: ScheduledReviewAttemptStatus,
): readonly DefinitionRow[] {
  if (status !== "SUBMISSION_UNKNOWN") {
    return document.evidenceRows;
  }
  return document.evidenceRows.map((row) =>
    row.semanticKey === "FINAL_SUBMISSION"
      ? { ...row, value: "结果未知，先查询原提交" }
      : row.semanticKey === "REVIEW_EVIDENCE"
        ? { ...row, value: "未知时不创建第二次证据" }
        : row,
  );
}

function ReviewRightRail({
  document,
  status,
}: {
  readonly document: ScheduledReviewAttemptDocument;
  readonly status: ScheduledReviewAttemptStatus;
}) {
  const evidenceRows = rowsForSubmissionStatus(document, status);
  return (
    <aside className="scheduled-review-rail" aria-label="到期复习辅助信息">
      <section className="scheduled-review-rail-section" aria-labelledby="scheduled-review-gate-title">
        <ReviewSectionTitle id="scheduled-review-gate-title" title="到期门控" />
        <ReviewDefinitionList rows={document.gateRows} />
      </section>
      <section className="scheduled-review-rail-section" aria-labelledby="scheduled-review-protected-title">
        <ReviewSectionTitle id="scheduled-review-protected-title" title="旧答案保护" />
        <ReviewDefinitionList rows={document.protectedHistoryRows} />
        <p>提交前不请求这些私有历史字段。</p>
      </section>
      <section className="scheduled-review-rail-section" aria-labelledby="scheduled-review-evidence-title">
        <ReviewSectionTitle id="scheduled-review-evidence-title" title="证据状态" />
        <ReviewDefinitionList rows={evidenceRows} />
      </section>
      <section className="scheduled-review-rail-section" aria-labelledby="scheduled-review-privacy-title">
        <ReviewSectionTitle id="scheduled-review-privacy-title" title="服务与隐私" />
        <ReviewDefinitionList rows={document.privacyRows} />
        {status === "SUBMISSION_UNKNOWN" ? <p className="scheduled-review-service-code">{document.serviceCode}</p> : null}
      </section>
    </aside>
  );
}

function ReviewRailCompact({
  document,
  status,
}: {
  readonly document: ScheduledReviewAttemptDocument;
  readonly status: ScheduledReviewAttemptStatus;
}) {
  return (
    <details className="scheduled-review-collapsible">
      <summary>到期门控、旧答案保护与证据</summary>
      <div className="scheduled-review-collapsible-content">
        <ReviewRightRail document={document} status={status} />
      </div>
    </details>
  );
}

function ReviewSubmitDialog({
  document,
  onCancel,
  onConfirm,
}: {
  readonly document: ScheduledReviewAttemptDocument;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const dialogTitleId = "scheduled-review-dialog-title";
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="scheduled-review-dialog-backdrop">
      <section
        aria-describedby="scheduled-review-dialog-description"
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="scheduled-review-dialog"
        role="dialog"
      >
        <h2 id={dialogTitleId}>{document.submitDialogTitle}</h2>
        <p id="scheduled-review-dialog-description">{document.submitDialogDescription}</p>
        <ul>
          {document.submitDialogItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="scheduled-review-dialog-actions">
          <button className="scheduled-review-secondary-action" onClick={onCancel} ref={cancelRef} type="button">
            取消
          </button>
          <button className="scheduled-review-primary-action" onClick={onConfirm} type="button">
            确认提交
          </button>
        </div>
      </section>
    </div>
  );
}

function ReviewActionBar({
  canSubmit,
  detailUrl,
  document,
  onSaveExit,
  onSubmit,
  status,
}: {
  readonly canSubmit: boolean;
  readonly detailUrl: string;
  readonly document: ScheduledReviewAttemptDocument;
  readonly onSaveExit: () => void;
  readonly onSubmit: () => void;
  readonly status: ScheduledReviewAttemptStatus;
}) {
  return (
    <section className="scheduled-review-actions" aria-labelledby="scheduled-review-actions-title">
      <h2 id="scheduled-review-actions-title">提交复习答案</h2>
      <div className="scheduled-review-action-row">
        <button
          className="scheduled-review-primary-action"
          disabled={!canSubmit}
          onClick={onSubmit}
          type="button"
        >
          <span>{status === "SUBMITTING" ? "正在提交" : document.primaryActionLabel}</span>
          <Icon name="arrowRight" size={22} />
        </button>
        <Link className="text-button scheduled-review-secondary-link" to={detailUrl}>
          {document.returnActionLabel}
        </Link>
        <button className="text-button scheduled-review-secondary-button" onClick={onSaveExit} type="button">
          {document.saveExitActionLabel}
        </button>
      </div>
      <p className="scheduled-review-warning">{document.irreversibleNotice}</p>
      <p>{document.evidenceNotice}</p>
    </section>
  );
}

function ScheduledReviewReady({
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
  readonly document: ScheduledReviewAttemptDocument;
}) {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => buildInitialFieldValues(document.fields));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<ScheduledReviewAttemptStatus>(document.status);
  const [message, setMessage] = useState<string | null>(null);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const detailUrl = buildDetailUrl(course, document);
  const wrongBookUrl = buildWrongBookUrl(course, document);
  const canSubmit = document.fields.every((field) => (fieldValues[field.name] ?? "").trim().length > 0) &&
    status !== "SUBMISSION_UNKNOWN" &&
    status !== "SUBMITTING";
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message !== null) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function updateFieldValue(name: string, value: string): void {
    setFieldValues((current) => ({ ...current, [name]: value }));
  }

  function openSubmitDialog(): void {
    if (!canSubmit) {
      setMessage("复习题的三个结论和判断过程完整后才可以提交。");
      return;
    }
    setDialogOpen(true);
  }

  function confirmSubmit(): void {
    setDialogOpen(false);
    setStatus("SUBMISSION_UNKNOWN");
    setMessage(document.submissionUnknownMessage);
  }

  function saveExit(): void {
    setMessage(document.saveExitMessage);
  }

  return (
    <div className="app-shell scheduled-review-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <ReviewMobileMenu detailUrl={detailUrl} wrongBookUrl={wrongBookUrl} />
      <main className="paper-canvas scheduled-review-canvas" id="main-content">
        <ReviewHeader dateTime={dateTime} document={document} />
        <ReviewEligibilityPath steps={document.eligibilitySteps} />
        <div className="scheduled-review-grid">
          <article className="scheduled-review-main" aria-label="到期复习作答表单">
            <form
              className="scheduled-review-form"
              onSubmit={(event) => {
                event.preventDefault();
                openSubmitDialog();
              }}
            >
              <ReviewQuestion document={document} />
              <ReviewAnswerForm
                document={document}
                fieldValues={fieldValues}
                onValueChange={updateFieldValue}
              />
              <ReviewActionBar
                canSubmit={canSubmit}
                detailUrl={detailUrl}
                document={document}
                onSaveExit={saveExit}
                onSubmit={openSubmitDialog}
                status={status}
              />
            </form>
            <p
              aria-live="polite"
              className="scheduled-review-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="scheduled-review-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="scheduled-review-rail-divider" />
          <ReviewRightRail document={document} status={status} />
          <ReviewRailCompact document={document} status={status} />
        </div>
        {dialogOpen ? (
          <ReviewSubmitDialog
            document={document}
            onCancel={() => {
              setDialogOpen(false);
            }}
            onConfirm={confirmSubmit}
          />
        ) : null}
      </main>
    </div>
  );
}

function ScheduledReviewUnavailableSurface({
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
    <div className="app-shell scheduled-review-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page scheduled-review-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="SCHEDULED_REVIEW_ATTEMPT_UNAVAILABLE：当前不会展示虚构 reviewId、新变式题、旧答案字段、作答草稿、提交状态、ReviewAttempt、LearningEvidence、RecoveryAttempt、Mastery、预算或云端笔记。"
          title="到期复习作答服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function ScheduledReviewLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell scheduled-review-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas scheduled-review-canvas" id="main-content">
        <div aria-label="正在加载到期复习" className="page-loading scheduled-review-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface ScheduledReviewAttemptRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly reviewId: string | null;
  readonly targetId: string | null;
  readonly wrongItemId: string | null;
}

export function ScheduledReviewAttemptRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  reviewId,
  targetId,
  wrongItemId,
}: ScheduledReviewAttemptRouteProps) {
  const document = useMemo(() => {
    if (targetId === null) {
      return reviewId === null && wrongItemId === null
        ? course.scheduledReviewAttempts?.[0]
        : course.scheduledReviewAttempts?.find((item) =>
          (reviewId === null || item.reviewId === reviewId) &&
          (wrongItemId === null || item.wrongItemId === wrongItemId),
        );
    }
    const targetDocument = course.scheduledReviewAttempts?.find((item) => item.targetId === targetId);
    if (targetDocument === undefined) {
      return undefined;
    }
    if (reviewId !== null && targetDocument.reviewId !== reviewId) {
      return undefined;
    }
    if (wrongItemId !== null && targetDocument.wrongItemId !== wrongItemId) {
      return undefined;
    }
    return targetDocument;
  }, [course.scheduledReviewAttempts, reviewId, targetId, wrongItemId]);

  if (document === undefined) {
    return (
      <ScheduledReviewAttemptServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-022 到期复习作答文档；生产环境不会用开发 Fixture 补 reviewId、新变式题或旧答案保护状态。"
        title="到期复习"
      />
    );
  }

  if (document.status === "LOADING") {
    return <ScheduledReviewLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableReview(document)) {
    return (
      <ScheduledReviewAttemptServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="到期复习暂不可作答；当前不会提前解锁题目、回退旧题或猜测复习结果。"
        title="到期复习"
      />
    );
  }

  return (
    <ScheduledReviewReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function ScheduledReviewAttemptServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的到期复习作答服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "到期复习",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <ScheduledReviewUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
