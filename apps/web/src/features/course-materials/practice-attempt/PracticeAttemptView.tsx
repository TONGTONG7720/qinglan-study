import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type { CourseSummary, DefinitionRow, PracticeAttempt, PracticeAttemptField } from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

type DraftUiState = "SERVER_SAVED" | "SAVING" | "LOCAL_ONLY" | "SUBMITTING" | "SUBMISSION_UNKNOWN";

interface PracticeAttemptRouteProps {
  readonly attemptId: string | null;
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly practiceHubUrl: string;
  readonly targetId: string | null;
}

function valuesFromFields(fields: readonly PracticeAttemptField[]): Readonly<Record<string, string>> {
  return fields.reduce<Record<string, string>>((values, field) => {
    values[field.id] = field.value;
    return values;
  }, {});
}

function fieldValue(values: Readonly<Record<string, string>>, field: PracticeAttemptField): string {
  return values[field.id] ?? "";
}

function rowListClassName(className?: string): string {
  return ["practice-attempt-definition-list", className].filter(Boolean).join(" ");
}

function PracticeAttemptMobileMenu({ practiceHubUrl }: { readonly practiceHubUrl: string }) {
  return (
    <details className="practice-attempt-mobile-menu">
      <summary>
        <span><strong>清朗学习</strong><small>每日任务</small></span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端练习作答导航">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link aria-current="page" to={practiceHubUrl}>独立练习</Link>
      </nav>
    </details>
  );
}

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={rowListClassName(className)}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
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
  const titleId = useId();
  return (
    <section className="practice-attempt-rail-section" aria-labelledby={titleId}>
      <div className="practice-attempt-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList rows={rows} />
      {children}
    </section>
  );
}

function PracticeAttemptRightRail({
  attempt,
  compact = false,
}: {
  readonly attempt: PracticeAttempt;
  readonly compact?: boolean;
}) {
  return (
    <aside
      aria-label={compact ? "练习作答折叠辅助信息" : "练习作答辅助信息"}
      className="right-rail practice-attempt-rail"
    >
      <PracticeRailSection rows={attempt.progressRows} title="练习进度">
        <ol aria-label="问题保存状态" className="practice-attempt-rail-progress">
          {attempt.progressItems.map((item) => (
            <li className={`is-${item.state.toLowerCase()}`} key={item.id}>
              <span>{item.number}</span>
              <strong>{item.label}</strong>
            </li>
          ))}
        </ol>
      </PracticeRailSection>
      <PracticeRailSection rows={attempt.ruleRows} title="独立作答规则" />
      <PracticeRailSection rows={attempt.evidenceRows} title="证据状态">
        <p className="practice-attempt-rail-note">只有服务端确认提交后，才可能形成一次有效练习证据。</p>
      </PracticeRailSection>
      <PracticeRailSection rows={attempt.privacyRows} title="服务与隐私" />
      <PracticeRailSection rows={attempt.serviceRows} title="提交结果未知时">
        <p className="practice-attempt-service-code">PRACTICE_SUBMISSION_UNKNOWN</p>
      </PracticeRailSection>
    </aside>
  );
}

function PracticeAttemptRailCompact({ attempt }: { readonly attempt: PracticeAttempt }) {
  return (
    <details className="right-rail-collapsible practice-attempt-collapsible">
      <summary>
        <span>进度、证据与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <PracticeAttemptRightRail attempt={attempt} compact />
      </div>
    </details>
  );
}

function PracticeAttemptHeader({
  attempt,
  dateTime,
  demoActive,
}: {
  readonly attempt: PracticeAttempt;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
}) {
  const breadcrumbParts = attempt.breadcrumbLabel.split(" / ");
  return (
    <header className="page-header practice-attempt-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb practice-attempt-breadcrumb">
          {breadcrumbParts.map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="practice-attempt-header-title">
          <h1>{attempt.title}</h1>
          <p>{attempt.subtitle}</p>
          {demoActive && attempt.fixtureBadgeLabel !== undefined ? <span className="fixture-badge">{attempt.fixtureBadgeLabel}</span> : null}
        </div>
      </div>
      <div className="page-date practice-attempt-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}，${attempt.savedAtLabel}`}>
        <strong>{attempt.status === "ANSWERING" ? attemptDate(attempt, dateTime).date : dateTime.date}</strong>
        <span>{attempt.status === "ANSWERING" ? attemptDate(attempt, dateTime).weekday : dateTime.weekdayChinese}</span>
        <small>{attempt.savedAtLabel}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function attemptDate(
  attempt: PracticeAttempt,
  dateTime: ShanghaiDateTime,
): { readonly date: string; readonly weekday: string } {
  return attempt.id.startsWith("demo-")
    ? { date: "2026-08-22", weekday: "星期六" }
    : { date: dateTime.date, weekday: dateTime.weekdayChinese };
}

function QuestionProgress({
  attempt,
  onStepActivate,
}: {
  readonly attempt: PracticeAttempt;
  readonly onStepActivate: (number: number, label: string) => void;
}) {
  return (
    <section className="practice-attempt-progress" aria-labelledby="practice-attempt-progress-title">
      <div className="practice-attempt-progress-copy">
        <h2 id="practice-attempt-progress-title">第 {attempt.currentQuestionNumber} 题 / 共 {attempt.totalQuestions} 题</h2>
        <span>已作答 {attempt.answeredCount}</span>
      </div>
      <ol aria-label="题目导航" className="practice-attempt-step-list">
        {attempt.progressItems.map((item) => (
          <li key={item.id}>
            <button
              aria-current={item.state === "CURRENT" ? "step" : undefined}
              aria-label={`第 ${String(item.number)} 题，${item.label}`}
              className={`is-${item.state.toLowerCase()}`}
              onClick={() => { onStepActivate(item.number, item.label); }}
              type="button"
            >
              {item.state === "SAVED" ? <Icon name="check" size={16} /> : item.number}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MathQuestionContent({ attempt }: { readonly attempt: PracticeAttempt }) {
  return (
    <section className="practice-attempt-question" aria-labelledby="practice-attempt-question-title">
      <div className="practice-attempt-metric" aria-hidden="true">
        <strong>{attempt.metricValue}</strong>
        <span>{attempt.metricCaption}</span>
      </div>
      <div className="practice-attempt-question-copy">
        <span className="practice-attempt-type">{attempt.questionTypeLabel}</span>
        <h2 id="practice-attempt-question-title">{attempt.questionTitle}</h2>
        <p className="practice-attempt-context">{attempt.questionContext}</p>
        <p className="practice-attempt-stem">{attempt.stem}</p>
        <p className="practice-attempt-no-hint">{attempt.noHintNotice}</p>
      </div>
    </section>
  );
}

function AnswerField({
  disabled,
  field,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly field: PracticeAttemptField;
  readonly onChange: (fieldId: string, value: string) => void;
  readonly value: string;
}) {
  const describedBy = field.maxLength === undefined ? undefined : `${field.id}-count`;
  return (
    <div className={field.kind === "TEXTAREA" ? "practice-attempt-answer-row is-process" : "practice-attempt-answer-row"}>
      <label htmlFor={field.id}>{field.label}</label>
      {field.kind === "TEXTAREA" ? (
        <textarea
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          id={field.id}
          maxLength={field.maxLength}
          name={field.name}
          onChange={(event) => { onChange(field.id, event.target.value); }}
          placeholder={field.placeholder}
          value={value}
        />
      ) : (
        <input
          autoComplete="off"
          disabled={disabled}
          id={field.id}
          inputMode={field.inputMode ?? "text"}
          name={field.name}
          onChange={(event) => { onChange(field.id, event.target.value); }}
          placeholder={field.placeholder}
          spellCheck={false}
          type="text"
          value={value}
        />
      )}
      {field.maxLength === undefined ? null : (
        <span className="practice-attempt-count" id={`${field.id}-count`}>
          {value.length} / {field.maxLength}
        </span>
      )}
    </div>
  );
}

function statusLabelFor(draftUiState: DraftUiState, attempt: PracticeAttempt): string {
  if (draftUiState === "SUBMISSION_UNKNOWN") return "提交结果未知 · 等待查询";
  if (draftUiState === "SUBMITTING") return "正在提交 · 请勿重复点击";
  if (draftUiState === "SAVING") return "正在保存草稿";
  if (draftUiState === "LOCAL_ONLY") return "本地草稿已更新 · 等待同步";
  return attempt.draftStatusLabel;
}

function PracticeAttemptForm({
  attempt,
  draftUiState,
  practiceHubUrl,
  onSubmitRequest,
  onValueChange,
  values,
}: {
  readonly attempt: PracticeAttempt;
  readonly draftUiState: DraftUiState;
  readonly practiceHubUrl: string;
  readonly onSubmitRequest: () => void;
  readonly onValueChange: (fieldId: string, value: string) => void;
  readonly values: Readonly<Record<string, string>>;
}) {
  const disabled = draftUiState === "SUBMITTING" || draftUiState === "SUBMISSION_UNKNOWN";
  const requiredMissing = attempt.fields.some((field) => fieldValue(values, field).trim().length === 0);
  const limitExceeded = attempt.fields.some((field) => {
    const max = field.maxLength;
    return max !== undefined && fieldValue(values, field).length > max;
  });
  const submitDisabled = disabled || requiredMissing || limitExceeded;
  return (
    <form
      aria-describedby="practice-attempt-submit-helper"
      className="practice-attempt-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!submitDisabled) onSubmitRequest();
      }}
    >
      <div className="practice-attempt-section-title">
        <h2>我的作答</h2>
        <span aria-hidden="true" />
      </div>
      <fieldset disabled={disabled}>
        <legend className="sr-only">第 5 题作答表单</legend>
        {attempt.fields.map((field) => (
          <AnswerField
            disabled={disabled}
            field={field}
            key={field.id}
            onChange={onValueChange}
            value={fieldValue(values, field)}
          />
        ))}
      </fieldset>
      <div className="practice-attempt-draft-row">
        <p aria-live="polite">{statusLabelFor(draftUiState, attempt)}</p>
        <span>{attempt.draftLevel === "SERVER_SAVED" ? "服务端草稿" : "本地草稿"}</span>
      </div>
      <div className="practice-attempt-actions">
        <button className="practice-attempt-previous" type="button">{attempt.previousActionLabel}</button>
        <button
          aria-busy={draftUiState === "SUBMITTING"}
          className="primary-button practice-attempt-submit"
          disabled={submitDisabled}
          type="submit"
        >
          {draftUiState === "SUBMITTING" ? "正在提交" : attempt.submitActionLabel}
        </button>
        <Link className="practice-attempt-exit" to={practiceHubUrl}>
          {attempt.exitActionLabel}
        </Link>
      </div>
      <p className="practice-attempt-submit-helper" id="practice-attempt-submit-helper">
        {requiredMissing ? "请补齐所有作答字段；提交前不会判断对错。" : attempt.submitReminder}
      </p>
    </form>
  );
}

function SubmitConfirmationDialog({
  attempt,
  dialogRef,
  onCancel,
  onConfirm,
}: {
  readonly attempt: PracticeAttempt;
  readonly dialogRef: RefObject<HTMLDialogElement | null>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <dialog
      aria-labelledby="practice-attempt-submit-dialog-title"
      className="practice-attempt-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      ref={dialogRef}
    >
      <div>
        <h2 id="practice-attempt-submit-dialog-title">{attempt.submitDialogTitle}</h2>
        <p>{attempt.submitDialogDescription}</p>
        <div className="practice-attempt-dialog-actions">
          <button autoFocus className="secondary-button" onClick={onCancel} type="button">{attempt.submitDialogCancelLabel}</button>
          <button className="primary-button" onClick={onConfirm} type="button">{attempt.submitDialogConfirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}

function PracticeAttemptReady({
  attempt,
  currentUser,
  dateTime,
  demoActive,
  practiceHubUrl,
}: {
  readonly attempt: PracticeAttempt;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly practiceHubUrl: string;
}) {
  const [values, setValues] = useState(() => valuesFromFields(attempt.fields));
  const [draftUiState, setDraftUiState] = useState<DraftUiState>(attempt.draftLevel === "SERVER_SAVED" ? "SERVER_SAVED" : "LOCAL_ONLY");
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submitTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (draftUiState !== "SAVING") return undefined;
    const timer = window.setTimeout(() => { setDraftUiState(attempt.draftLevel === "SERVER_SAVED" ? "SERVER_SAVED" : "LOCAL_ONLY"); }, 420);
    return () => { window.clearTimeout(timer); };
  }, [attempt.draftLevel, draftUiState]);

  useEffect(() => {
    if (announcement === null) return undefined;
    const timer = window.setTimeout(() => { setAnnouncement(null); }, 4_000);
    return () => { window.clearTimeout(timer); };
  }, [announcement]);

  function setFieldValue(fieldId: string, value: string): void {
    setValues((current) => ({ ...current, [fieldId]: value }));
    if (draftUiState !== "SUBMISSION_UNKNOWN") setDraftUiState("SAVING");
  }

  function openSubmitDialog(): void {
    submitTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    dialogRef.current?.showModal();
  }

  function closeSubmitDialog(): void {
    dialogRef.current?.close();
    window.setTimeout(() => { submitTriggerRef.current?.focus(); }, 0);
  }

  function confirmSubmit(): void {
    dialogRef.current?.close();
    setDraftUiState("SUBMITTING");
    window.setTimeout(() => { setDraftUiState("SUBMISSION_UNKNOWN"); }, 240);
  }

  const sourceBoundary = demoActive ? attempt.sourceBoundary : undefined;
  return (
    <div className="app-shell practice-attempt-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <PracticeAttemptMobileMenu practiceHubUrl={practiceHubUrl} />
      <main className="paper-canvas practice-attempt-canvas" id="main-content">
        <PracticeAttemptHeader attempt={attempt} dateTime={dateTime} demoActive={demoActive} />
        <div className="practice-attempt-layout">
          <section className="practice-attempt-main" aria-labelledby="practice-attempt-main-title">
            <h2 className="sr-only" id="practice-attempt-main-title">练习作答主内容</h2>
            <QuestionProgress
              attempt={attempt}
              onStepActivate={(number, label) => {
                setAnnouncement(`第 ${String(number)} 题${label}；当前 STU-017 页面不会重建其他题的服务端草稿。`);
              }}
            />
            <MathQuestionContent attempt={attempt} />
            <PracticeAttemptForm
              attempt={attempt}
              draftUiState={draftUiState}
              practiceHubUrl={practiceHubUrl}
              onSubmitRequest={openSubmitDialog}
              onValueChange={setFieldValue}
              values={values}
            />
            {draftUiState === "SUBMISSION_UNKNOWN" ? (
              <section className="practice-attempt-unknown" aria-live="polite" role="status">
                <h2>提交结果未知</h2>
                <p>{attempt.unknownSubmissionMessage}</p>
              </section>
            ) : null}
            {sourceBoundary === undefined ? null : <p className="practice-attempt-source-boundary">{sourceBoundary}</p>}
          </section>
          <span aria-hidden="true" className="practice-attempt-rail-divider" />
          <PracticeAttemptRightRail attempt={attempt} />
          <PracticeAttemptRailCompact attempt={attempt} />
        </div>
      </main>
      <SubmitConfirmationDialog attempt={attempt} dialogRef={dialogRef} onCancel={closeSubmitDialog} onConfirm={confirmSubmit} />
      {announcement === null ? null : (
        <div className="toast" role="status">
          <Icon name="info" size={18} /><span>{announcement}</span>
          <button aria-label="关闭提示" onClick={() => { setAnnouncement(null); }} type="button">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function PracticeAttemptUnavailableSurface({
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
    <div className="app-shell practice-attempt-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page practice-attempt-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>独立作答服务边界</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description={`${subtitle} 当前不会展示虚构题干、旧缓存答案、草稿、practice attempt、LearningEvidence、Mistake、RecoveryAttempt、Mastery、预算或云端笔记。`}
          title="练习作答服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export function PracticeAttemptServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的练习作答服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "独立练习",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return <PracticeAttemptUnavailableSurface currentUser={currentUser} demoActive={demoActive} overviewUrl={overviewUrl} subtitle={subtitle} title={title} />;
}

export function PracticeAttemptRoute({
  attemptId,
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  practiceHubUrl,
  targetId,
}: PracticeAttemptRouteProps) {
  const attempt = useMemo(() => {
    const attempts = course.practiceAttempts ?? [];
    return attempts.find((item) => (
      item.attemptId === attemptId ||
      item.targetId === targetId ||
      item.id === targetId ||
      item.id === attemptId
    ));
  }, [attemptId, course.practiceAttempts, targetId]);

  if (attempt?.status !== "ANSWERING") {
    return (
      <PracticeAttemptServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-017 练习作答文档；返回课程与资料，不泄露其他 attempt。"
        title="独立练习"
      />
    );
  }

  return (
    <PracticeAttemptReady
      attempt={attempt}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      practiceHubUrl={practiceHubUrl}
    />
  );
}
