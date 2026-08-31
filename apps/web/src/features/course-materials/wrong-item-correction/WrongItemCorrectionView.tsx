import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  WrongItemCorrectionCauseValue,
  WrongItemCorrectionDocument,
  WrongItemCorrectionStatus,
  WrongItemCorrectionStep,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly WrongItemCorrectionStatus[] = [
  "ANSWERING",
  "CAUSE_UNSELECTED",
  "READY_TO_SUBMIT",
  "DRAFT_SAVING",
  "DRAFT_SAVED_LOCAL",
  "DRAFT_SAVED_SERVER",
  "SUBMITTING",
  "CORRECTION_FAILED",
  "CORRECTION_PASSED_PENDING_REVIEW",
  "SUBMISSION_UNKNOWN",
  "DUPLICATE_SUBMISSION",
  "OFFLINE_DRAFT",
];

function isDisplayableCorrection(document: WrongItemCorrectionDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildDetailUrl(course: CourseSummary, document: WrongItemCorrectionDocument): string {
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

function buildWrongBookUrl(course: CourseSummary, document: WrongItemCorrectionDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.wrongBookTargetId,
    term: course.term,
    view: "wrong-book",
  });
  return `/student/learn?${params.toString()}`;
}

function CorrectionDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["wrong-correction-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CorrectionSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="wrong-correction-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function CorrectionMobileMenu({
  detailUrl,
  wrongBookUrl,
}: {
  readonly detailUrl: string;
  readonly wrongBookUrl: string;
}) {
  return (
    <details className="wrong-correction-mobile-menu">
      <summary aria-label="打开移动端错题订正导航">
        <span>
          <strong>清朗学习</strong>
          <small>错题订正</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端错题订正功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={wrongBookUrl}>错题本</Link>
        <Link to={detailUrl}>错题详情</Link>
        <span aria-current="page">错题订正</span>
      </nav>
    </details>
  );
}

function CorrectionHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: WrongItemCorrectionDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-22" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.draftStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;
  return (
    <header className="page-header wrong-correction-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb wrong-correction-breadcrumb">
          {document.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="wrong-correction-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date wrong-correction-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.draftStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function correctionStepClass(step: WrongItemCorrectionStep): string {
  return step.state === "COMPLETE"
    ? "is-complete"
    : step.state === "CURRENT"
    ? "is-current"
    : step.state === "ERROR"
    ? "is-error"
    : "is-pending";
}

function CorrectionProgress({ steps }: { readonly steps: readonly WrongItemCorrectionStep[] }) {
  return (
    <ol className="wrong-correction-progress" aria-label="错题订正三步进度">
      {steps.map((step, index) => (
        <li
          aria-current={step.state === "CURRENT" ? "step" : undefined}
          className={correctionStepClass(step)}
          key={step.id}
        >
          <span aria-hidden="true">{index + 1}</span>
          <strong>{step.label}</strong>
          <small>{step.caption}</small>
        </li>
      ))}
    </ol>
  );
}

function CorrectionQuestion({
  answer,
  document,
  onAnswerChange,
  onProcessChange,
  process,
}: {
  readonly answer: string;
  readonly document: WrongItemCorrectionDocument;
  readonly onAnswerChange: (value: string) => void;
  readonly onProcessChange: (value: string) => void;
  readonly process: string;
}) {
  const processCount = process.length;
  return (
    <section className="wrong-correction-answer-section" aria-labelledby="wrong-correction-answer-title">
      <div className="wrong-correction-answer-layout">
        <div className="wrong-correction-large-number" aria-label={document.largeNumberCaption}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <div className="wrong-correction-answer-body">
          <article className="wrong-correction-question" aria-label="重新作答题目">
            <h2 id="wrong-correction-answer-title">{document.itemTitle}</h2>
            <p className="wrong-correction-scope">{document.scopeLabel}</p>
            <p className="wrong-correction-question-text">{document.questionText}</p>
            <p className="wrong-correction-muted">本页默认收起原答案与正确结论，请重新完成。</p>
            <details className="wrong-correction-original-record">
              <summary>{document.foldedOriginalRecordLabel}</summary>
              <div>
                <p><span>{document.originalRecord.originalAnswerLabel}</span><strong>{document.originalRecord.originalAnswer}</strong></p>
                <p><span>{document.originalRecord.correctAnswerLabel}</span><strong>{document.originalRecord.correctAnswer}</strong></p>
                <p><span>{document.originalRecord.causeLabel}</span><strong>{document.originalRecord.causeText}</strong></p>
              </div>
            </details>
          </article>
          <div className="wrong-correction-field">
            <label htmlFor="wrong-correction-answer">{document.answerLabel}</label>
            <input
              autoComplete="off"
              id="wrong-correction-answer"
              onChange={(event) => {
                onAnswerChange(event.currentTarget.value);
              }}
              value={answer}
            />
          </div>
          <div className="wrong-correction-field">
            <label htmlFor="wrong-correction-process">{document.processLabel}</label>
            <textarea
              id="wrong-correction-process"
              maxLength={document.processCharLimit}
              onChange={(event) => {
                onProcessChange(event.currentTarget.value);
              }}
              rows={4}
              value={process}
            />
            <span className="wrong-correction-char-count">{processCount} / {document.processCharLimit}</span>
          </div>
          <p className="wrong-correction-save-line">{document.answerStatusLabel}</p>
        </div>
      </div>
    </section>
  );
}

function CorrectionCauseSelector({
  causeExplanation,
  document,
  onCauseChange,
  onCauseExplanationChange,
  selectedCause,
}: {
  readonly causeExplanation: string;
  readonly document: WrongItemCorrectionDocument;
  readonly onCauseChange: (value: WrongItemCorrectionCauseValue) => void;
  readonly onCauseExplanationChange: (value: string) => void;
  readonly selectedCause: WrongItemCorrectionCauseValue | null;
}) {
  const causeCount = causeExplanation.length;
  return (
    <section className="wrong-correction-cause-section" aria-labelledby="wrong-correction-cause-title">
      <div className="wrong-correction-cause-layout">
        <div className="wrong-correction-cause-side-title">
          <h2 id="wrong-correction-cause-title">说明错因</h2>
          <span aria-hidden="true" />
        </div>
        <fieldset className="wrong-correction-cause-fieldset">
          <legend>{document.causeQuestion}</legend>
          <div className="wrong-correction-radio-list" role="radiogroup" aria-describedby="wrong-correction-privacy">
            {document.causeOptions.map((option) => (
              <label className="wrong-correction-radio" key={option.id}>
                <input
                  checked={selectedCause === option.value}
                  name="wrong-correction-cause"
                  onChange={() => {
                    onCauseChange(option.value);
                  }}
                  type="radio"
                  value={option.value}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          <div className="wrong-correction-field is-cause-explanation">
            <label htmlFor="wrong-correction-cause-explanation">{document.causeExplanationLabel}</label>
            <textarea
              id="wrong-correction-cause-explanation"
              maxLength={document.causeCharLimit}
              onChange={(event) => {
                onCauseExplanationChange(event.currentTarget.value);
              }}
              rows={3}
              value={causeExplanation}
            />
            <span className="wrong-correction-char-count">{causeCount} / {document.causeCharLimit}</span>
          </div>
          <p className="wrong-correction-privacy" id="wrong-correction-privacy">{document.privacyNotice}</p>
        </fieldset>
      </div>
    </section>
  );
}

function rowsForSubmissionStatus(
  document: WrongItemCorrectionDocument,
  status: WrongItemCorrectionStatus,
): {
  readonly progressRows: readonly DefinitionRow[];
  readonly evidenceRows: readonly DefinitionRow[];
} {
  if (status !== "SUBMISSION_UNKNOWN") {
    return {
      progressRows: document.progressRows,
      evidenceRows: document.evidenceRows,
    };
  }
  return {
    progressRows: document.progressRows.map((row) =>
      row.semanticKey === "FINAL_SUBMISSION"
        ? { ...row, value: "结果未知" }
        : row.semanticKey === "READY_STATE"
          ? { ...row, value: "查询原提交状态" }
          : row,
    ),
    evidenceRows: document.evidenceRows.map((row) =>
      row.semanticKey === "CORRECTION_EVIDENCE"
        ? { ...row, value: "未知，待服务端查询" }
        : row.semanticKey === "REVIEW_PLAN"
          ? { ...row, value: "未知时不生成新计划" }
          : row,
    ),
  };
}

function CorrectionRightRail({
  document,
  status,
}: {
  readonly document: WrongItemCorrectionDocument;
  readonly status: WrongItemCorrectionStatus;
}) {
  const { evidenceRows, progressRows } = rowsForSubmissionStatus(document, status);
  return (
    <aside className="wrong-correction-rail" aria-label="错题订正辅助信息">
      <section className="wrong-correction-rail-section" aria-labelledby="wrong-correction-progress-title">
        <CorrectionSectionTitle id="wrong-correction-progress-title" title="订正进度" />
        <CorrectionDefinitionList rows={progressRows} />
      </section>
      <section className="wrong-correction-rail-section" aria-labelledby="wrong-correction-evidence-title">
        <CorrectionSectionTitle id="wrong-correction-evidence-title" title="证据状态" />
        <CorrectionDefinitionList rows={evidenceRows} />
        <p>只有服务端确认订正后，才会进入待复习。</p>
      </section>
      <section className="wrong-correction-rail-section" aria-labelledby="wrong-correction-rules-title">
        <CorrectionSectionTitle id="wrong-correction-rules-title" title="订正规则" />
        <CorrectionDefinitionList rows={document.ruleRows} />
      </section>
      <section className="wrong-correction-rail-section" aria-labelledby="wrong-correction-privacy-title">
        <CorrectionSectionTitle id="wrong-correction-privacy-title" title="服务与隐私" />
        <CorrectionDefinitionList rows={document.privacyRows} />
      </section>
    </aside>
  );
}

function CorrectionRailCompact({
  document,
  status,
}: {
  readonly document: WrongItemCorrectionDocument;
  readonly status: WrongItemCorrectionStatus;
}) {
  return (
    <details className="wrong-correction-collapsible">
      <summary>订正进度、证据与隐私</summary>
      <div className="wrong-correction-collapsible-content">
        <CorrectionRightRail document={document} status={status} />
      </div>
    </details>
  );
}

function CorrectionSubmitDialog({
  document,
  onCancel,
  onConfirm,
}: {
  readonly document: WrongItemCorrectionDocument;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const dialogTitleId = "wrong-correction-dialog-title";
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="wrong-correction-dialog-backdrop">
      <section
        aria-describedby="wrong-correction-dialog-description"
        aria-labelledby={dialogTitleId}
        aria-modal="true"
        className="wrong-correction-dialog"
        role="dialog"
      >
        <h2 id={dialogTitleId}>{document.submitDialogTitle}</h2>
        <p id="wrong-correction-dialog-description">{document.submitDialogDescription}</p>
        <ul>
          {document.submitDialogItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div className="wrong-correction-dialog-actions">
          <button className="wrong-correction-secondary-action" onClick={onCancel} ref={cancelRef} type="button">
            取消
          </button>
          <button className="wrong-correction-primary-action" onClick={onConfirm} type="button">
            确认提交
          </button>
        </div>
      </section>
    </div>
  );
}

function CorrectionActionBar({
  canSubmit,
  detailUrl,
  document,
  onSaveExit,
  onSubmit,
}: {
  readonly canSubmit: boolean;
  readonly detailUrl: string;
  readonly document: WrongItemCorrectionDocument;
  readonly onSaveExit: () => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="wrong-correction-actions" aria-labelledby="wrong-correction-actions-title">
      <h2 id="wrong-correction-actions-title">提交订正</h2>
      <div className="wrong-correction-action-row">
        <button
          className="wrong-correction-primary-action"
          disabled={!canSubmit}
          onClick={onSubmit}
          type="button"
        >
          <span>{document.primaryActionLabel}</span>
          <Icon name="arrowRight" size={22} />
        </button>
        <Link className="text-button wrong-correction-secondary-link" to={detailUrl}>
          {document.returnActionLabel}
        </Link>
        <button className="text-button wrong-correction-secondary-button" onClick={onSaveExit} type="button">
          {document.saveExitActionLabel}
        </button>
      </div>
      <p className="wrong-correction-warning">{document.irreversibleNotice}</p>
      <p>{document.evidenceNotice}</p>
    </section>
  );
}

function WrongItemCorrectionReady({
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
  readonly document: WrongItemCorrectionDocument;
}) {
  const [answer, setAnswer] = useState(document.answerValue);
  const [process, setProcess] = useState(document.processValue);
  const [selectedCause, setSelectedCause] = useState<WrongItemCorrectionCauseValue | null>(document.selectedCause);
  const [causeExplanation, setCauseExplanation] = useState(document.causeExplanationValue);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<WrongItemCorrectionStatus>(document.status);
  const [message, setMessage] = useState<string | null>(null);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const detailUrl = buildDetailUrl(course, document);
  const wrongBookUrl = buildWrongBookUrl(course, document);
  const canSubmit =
    answer.trim().length > 0 &&
    process.trim().length > 0 &&
    selectedCause !== null &&
    causeExplanation.trim().length > 0 &&
    status !== "SUBMISSION_UNKNOWN";
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message !== null) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function openSubmitDialog(): void {
    if (!canSubmit) {
      setMessage("订正答案、判断过程和错因说明完整后才可以提交。");
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
    <div className="app-shell wrong-correction-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <CorrectionMobileMenu detailUrl={detailUrl} wrongBookUrl={wrongBookUrl} />
      <main className="paper-canvas wrong-correction-canvas" id="main-content">
        <CorrectionHeader dateTime={dateTime} document={document} />
        <CorrectionProgress steps={document.progressSteps} />
        <div className="wrong-correction-grid">
          <article className="wrong-correction-main" aria-label="错题订正表单">
            <form
              className="wrong-correction-form"
              onSubmit={(event) => {
                event.preventDefault();
                openSubmitDialog();
              }}
            >
              <CorrectionQuestion
                answer={answer}
                document={document}
                onAnswerChange={setAnswer}
                onProcessChange={setProcess}
                process={process}
              />
              <CorrectionCauseSelector
                causeExplanation={causeExplanation}
                document={document}
                onCauseChange={setSelectedCause}
                onCauseExplanationChange={setCauseExplanation}
                selectedCause={selectedCause}
              />
              <CorrectionActionBar
                canSubmit={canSubmit}
                detailUrl={detailUrl}
                document={document}
                onSaveExit={saveExit}
                onSubmit={openSubmitDialog}
              />
            </form>
            <p
              aria-live="polite"
              className="wrong-correction-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="wrong-correction-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="wrong-correction-rail-divider" />
          <CorrectionRightRail document={document} status={status} />
          <CorrectionRailCompact document={document} status={status} />
        </div>
        {dialogOpen ? (
          <CorrectionSubmitDialog
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

function WrongItemCorrectionUnavailableSurface({
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
    <div className="app-shell wrong-correction-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page wrong-correction-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="WRONG_ITEM_CORRECTION_UNAVAILABLE：当前不会展示虚构订正草稿、correctionId、提交结果、复习计划、RecoveryAttempt、LearningEvidence、Mastery、预算或云端笔记。"
          title="错题订正服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function WrongItemCorrectionLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell wrong-correction-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas wrong-correction-canvas" id="main-content">
        <div aria-label="正在加载错题订正" className="page-loading wrong-correction-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface WrongItemCorrectionRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
  readonly wrongItemId: string | null;
}

export function WrongItemCorrectionRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
  wrongItemId,
}: WrongItemCorrectionRouteProps) {
  const document = useMemo(() => {
    if (targetId === null) {
      return wrongItemId === null
        ? course.wrongItemCorrections?.[0]
        : course.wrongItemCorrections?.find((item) => item.wrongItemId === wrongItemId);
    }
    const targetDocument = course.wrongItemCorrections?.find((item) => item.targetId === targetId);
    if (targetDocument === undefined) {
      return undefined;
    }
    if (wrongItemId !== null && targetDocument.wrongItemId !== wrongItemId) {
      return undefined;
    }
    return targetDocument;
  }, [course.wrongItemCorrections, targetId, wrongItemId]);

  if (document === undefined) {
    return (
      <WrongItemCorrectionServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-021 错题订正文档；生产环境不会用开发 Fixture 补订正草稿、correctionId、提交状态或复习计划。"
        title="错题订正"
      />
    );
  }

  if (document.status === "LOADING") {
    return <WrongItemCorrectionLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableCorrection(document)) {
    return (
      <WrongItemCorrectionServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="错题订正不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或猜测订正结果。"
        title="错题订正"
      />
    );
  }

  return (
    <WrongItemCorrectionReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function WrongItemCorrectionServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的错题订正服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "错题订正",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <WrongItemCorrectionUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
