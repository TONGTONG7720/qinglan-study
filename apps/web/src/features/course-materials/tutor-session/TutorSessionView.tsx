import { useId, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  TutorSession,
  TutorSessionStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<TutorSessionStatus, { readonly title: string; readonly description: string }> = {
  FIRST_HINT: {
    title: "提示优先辅导",
    description: "当前只展示第一层提示，等待学生先写出自己的判断。",
  },
  WAITING_ANSWER: {
    title: "等待当前回答",
    description: "学生尚未提交当前步骤；不能提前解锁后续提示或答案。",
  },
  PROGRESSIVE_REVEAL: {
    title: "逐步提示中",
    description: "服务端正在按学生回答决定下一步提示；不能在前端伪造模型输出。",
  },
  EVIDENCE_AVAILABLE: {
    title: "证据可用",
    description: "只有服务端确认的独立作答证据，才可进入掌握证据流程。",
  },
  EVIDENCE_UNAVAILABLE: {
    title: "证据不可用",
    description: "提示使用不能替代独立作答或掌握证据。",
  },
  MODEL_TIMEOUT: {
    title: "模型响应超时",
    description: "保留学生当前回答，等待服务端恢复或提供非 AI 入口。",
  },
  SAFE_REFERRAL: {
    title: "安全转介",
    description: "安全风险状态只给克制转介，不继续普通教学。",
  },
  BUDGET_EXHAUSTED: {
    title: "预算已用尽",
    description: "保留当前会话，不生成新的 AI 提示，并提供非 AI 学习入口。",
  },
  OFFLINE: {
    title: "离线不可提交",
    description: "离线状态不能声称已提交回答或解锁后续步骤。",
  },
  SESSION_EXPIRED_RECOVERABLE: {
    title: "会话可恢复",
    description: "需要重新建立学生会话后，由服务端恢复同一个 tutorSessionId。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "辅导会话不可用",
    description: "当前会话不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function TutorMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="tutor-mobile-menu">
      <summary aria-label="打开移动端提示辅导导航">
        <span>
          <strong>清朗学习</strong>
          <small>AI 辅导</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端提示辅导功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <span>OCR 确认</span>
        <span aria-current="page">提示辅导</span>
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
    <dl className={["tutor-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TutorPageHeader({
  dateFootnote,
  dateTime,
  demoActive,
  detail,
  overviewUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: TutorSession;
  readonly overviewUrl: string;
}) {
  return (
    <header className="page-header tutor-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
          <span aria-hidden="true">/</span>
          <a href={overviewUrl}>课程与资料</a>
        </nav>
        <h1>{detail.title}</h1>
        <div className="tutor-header-meta">
          <p>{detail.subtitle}</p>
          {demoActive && detail.fixtureBadgeLabel !== undefined ? <span>{detail.fixtureBadgeLabel}</span> : null}
        </div>
      </div>
      <div className="page-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}`}>
        <span>{dateTime.weekdayEnglish}</span>
        <strong>{dateTime.date}</strong>
        <small>{dateFootnote}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function TutorQuestionPanel({
  detail,
  onQuestionReturn,
}: {
  readonly detail: TutorSession;
  readonly onQuestionReturn: () => void;
}) {
  return (
    <section className="tutor-question-panel" aria-labelledby="tutor-question-title">
      <div className="tutor-section-title">
        <h2 id="tutor-question-title">{detail.question.title}</h2>
        <span aria-hidden="true" />
      </div>
      <div className="tutor-question-card">
        <p>{detail.question.text}</p>
        <div className="tutor-question-lower">
          <DefinitionList className="tutor-question-context" rows={detail.question.contextRows} />
          <div className="tutor-question-confirmation">
            <span><Icon name="check" size={16} />{detail.question.confirmationLabel}</span>
            <button className="secondary-button" onClick={onQuestionReturn} type="button">
              {detail.question.sourceActionLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function TutorProgress({ detail }: { readonly detail: TutorSession }) {
  return (
    <section className="tutor-progress-panel" aria-labelledby="tutor-progress-title">
      <div className="tutor-section-title">
        <h2 id="tutor-progress-title">{detail.progressTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <ol className="tutor-progress" aria-label="提示优先辅导会话进度">
        {detail.steps.map((step) => (
          <li
            aria-current={step.current ? "step" : undefined}
            className={[
              step.completed ? "is-complete" : undefined,
              step.current ? "is-current" : undefined,
              step.locked ? "is-locked" : undefined,
            ].filter(Boolean).join(" ")}
            key={step.id}
          >
            <span aria-hidden="true">
              {step.completed ? <Icon name="check" size={15} /> : step.locked ? <Icon name="lock" size={15} /> : step.ordinalLabel}
            </span>
            <strong>{step.title}</strong>
            <small>{step.statusLabel}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HintPanel({
  answer,
  detail,
  onAnswerChange,
  onSmallerStep,
  onSubmit,
  smallerStepMessage,
  submitMessage,
}: {
  readonly answer: string;
  readonly detail: TutorSession;
  readonly onAnswerChange: (value: string) => void;
  readonly onSmallerStep: () => void;
  readonly onSubmit: () => void;
  readonly smallerStepMessage: string | null;
  readonly submitMessage: string | null;
}) {
  const textareaId = useId();
  const helperId = `${textareaId}-helper`;
  const counterId = `${textareaId}-counter`;
  const trimmedAnswer = answer.trim();
  const canSubmit = trimmedAnswer.length > 0 && submitMessage === null;

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (canSubmit) {
      onSubmit();
    }
  }

  return (
    <section className="tutor-hint-panel" aria-labelledby="tutor-hint-title">
      <div className="tutor-hint-number" aria-hidden="true">{detail.currentHint.ordinalLabel}</div>
      <article className="tutor-hint-copy">
        <h2 id="tutor-hint-title">{detail.currentHint.title}</h2>
        {detail.currentHint.promptLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="tutor-hint-instruction">{detail.currentHint.instruction}</p>
      </article>

      <form className="tutor-answer-form" onSubmit={handleSubmit}>
        <label htmlFor={textareaId}>{detail.answerDraft.title}</label>
        <textarea
          aria-describedby={`${helperId} ${counterId}`}
          id={textareaId}
          maxLength={detail.answerDraft.maxLength}
          onChange={(event) => { onAnswerChange(event.currentTarget.value); }}
          placeholder={detail.answerDraft.placeholder}
          value={answer}
        />
        <div className="tutor-answer-meta">
          <small id={helperId}>{detail.answerDraft.helperText}</small>
          <span id={counterId}>{String(answer.length)} / {String(detail.answerDraft.maxLength)}</span>
        </div>

        <div className="tutor-hint-actions">
          <button className="text-button" onClick={onSmallerStep} type="button">
            {detail.unsureLabel}
            <small>{detail.unsureHint}</small>
          </button>
          <button className="primary-button" disabled={!canSubmit} type="submit">
            {detail.primaryActionLabel}
          </button>
        </div>
        <p aria-live="polite">
          {submitMessage ?? smallerStepMessage ?? (canSubmit ? detail.primaryReadyHint : detail.primaryDisabledHint)}
        </p>
      </form>
    </section>
  );
}

function LockedSteps({ detail }: { readonly detail: TutorSession }) {
  return (
    <section className="tutor-locked-panel" aria-labelledby="tutor-locked-title">
      <div className="tutor-section-title">
        <h2 id="tutor-locked-title">{detail.lockedTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <ol>
        {detail.lockedSteps.map((step) => (
          <li key={step.id}>
            <Icon name="lock" size={17} />
            <strong>{step.title}</strong>
            <span>{step.statusLabel}</span>
            <small>{step.availabilityLabel}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TutorBasis({ detail }: { readonly detail: TutorSession }) {
  return (
    <section className="tutor-basis-panel" aria-labelledby="tutor-basis-title">
      <div className="tutor-section-title">
        <h2 id="tutor-basis-title">{detail.basisTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="tutor-basis-list" rows={detail.basisRows} />
      <p><Icon name="shieldCheck" size={17} />{detail.basisNotice}</p>
    </section>
  );
}

function TutorActionPanel({
  detail,
  onQuestionReturn,
  overviewUrl,
}: {
  readonly detail: TutorSession;
  readonly onQuestionReturn: () => void;
  readonly overviewUrl: string;
}) {
  return (
    <section className="tutor-action-panel" aria-labelledby="tutor-action-title">
      <h2 id="tutor-action-title">操作</h2>
      <div className="tutor-action-buttons">
        <a className="secondary-button" href={overviewUrl}>{detail.saveExitLabel}</a>
        <button className="secondary-button" onClick={onQuestionReturn} type="button">{detail.returnQuestionLabel}</button>
      </div>
      <a className="text-button" href={overviewUrl}>
        {detail.viewBasisLabel}
        <Icon name="chevronRight" size={16} />
      </a>
    </section>
  );
}

function updateRowsForAnswer({
  answer,
  rows,
  submitted,
}: {
  readonly answer: string;
  readonly rows: readonly DefinitionRow[];
  readonly submitted: boolean;
}): readonly DefinitionRow[] {
  return rows.map((row) => {
    if (row.id.endsWith("-answer")) {
      if (submitted) {
        return { ...row, value: "已提交演示" };
      }
      return { ...row, value: answer.trim().length > 0 ? "待提交" : "未提交" };
    }
    return row;
  });
}

function TutorRightRail({
  answer,
  detail,
  submitted,
}: {
  readonly answer: string;
  readonly detail: TutorSession;
  readonly submitted: boolean;
}) {
  const progressRows = useMemo(
    () => updateRowsForAnswer({ answer, rows: detail.railProgressRows, submitted }),
    [answer, detail.railProgressRows, submitted],
  );
  return (
    <aside className="right-rail tutor-rail" aria-label="提示优先辅导辅助信息">
      <TutorRailSection rows={progressRows} title="会话进度" />
      <TutorRailSection rows={detail.railQuestionRows} title="题面状态" />
      <TutorRailSection rows={detail.railHintRows} title="提示使用" />
      <TutorRailSection rows={detail.railBasisRows} title="内容依据" />
      <TutorRailSection rows={detail.railAiRows} title="AI 与预算" />
      <TutorRailSection rows={detail.railRecoveryRows} title="恢复与隐私" />
      <TutorRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="tutor-service-code">{detail.serviceCode}</p>
      <p className="tutor-rail-boundary">题面、回答与辅导记录仅在授权家庭范围内使用。</p>
    </aside>
  );
}

function TutorRailSection({
  rows,
  title,
}: {
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `tutor-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className="tutor-rail-section" aria-labelledby={titleId}>
      <div className="tutor-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="tutor-rail-list" rows={rows} />
    </section>
  );
}

function TutorRailCompact({
  answer,
  detail,
  submitted,
}: {
  readonly answer: string;
  readonly detail: TutorSession;
  readonly submitted: boolean;
}) {
  return (
    <details className="right-rail-collapsible tutor-collapsible">
      <summary>
        <span>会话、证据与服务</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <TutorRightRail answer={answer} detail={detail} submitted={submitted} />
      </div>
    </details>
  );
}

export interface TutorSessionRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly onQuestionReturn: () => void;
  readonly overviewUrl: string;
  readonly sessionId: string | null;
}

export function TutorSessionRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  knowledgePointId,
  onQuestionReturn,
  overviewUrl,
  sessionId,
}: TutorSessionRouteProps) {
  const detail = course.tutorSessions?.find((item) => item.tutorSessionId === sessionId) ??
    course.tutorSessions?.find((item) => item.knowledgePointId === knowledgePointId) ??
    (sessionId === null && knowledgePointId === null ? course.tutorSessions?.[0] : undefined);
  const [answer, setAnswer] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [smallerStepMessage, setSmallerStepMessage] = useState<string | null>(null);

  if (detail === undefined) {
    return (
      <TutorSessionServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端辅导会话文档；生产环境不会用开发 Fixture 补 tutorSessionId、提示步骤、AI 结果或证据。"
        title="提示优先辅导"
      />
    );
  }

  if (detail.status !== "FIRST_HINT") {
    const copy = serviceStateCopy[detail.status];
    return (
      <TutorSessionServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.description}
        title={copy.title}
      />
    );
  }

  const activeDetail = detail;

  function handleSubmit(): void {
    if (answer.trim().length === 0 || submitMessage !== null) {
      return;
    }
    setSubmitMessage(activeDetail.submitUnavailableMessage);
  }

  function requestSmallerStep(): void {
    setSmallerStepMessage("TUTOR_SESSION_SERVICE_UNAVAILABLE：更小步骤提示服务未接入；当前不会生成新的 AI 提示或学习证据。");
  }

  const submitted = submitMessage !== null;

  return (
    <div className="app-shell tutor-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <TutorMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas tutor-canvas" id="main-content">
        <TutorPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          demoActive={demoActive}
          detail={activeDetail}
          overviewUrl={overviewUrl}
        />
        <div className="content-grid tutor-grid">
          <article className="main-column tutor-main" aria-label="提示优先辅导">
            <TutorQuestionPanel detail={activeDetail} onQuestionReturn={onQuestionReturn} />
            <TutorProgress detail={activeDetail} />
            <div className="tutor-session-grid">
              <HintPanel
                answer={answer}
                detail={activeDetail}
                onAnswerChange={setAnswer}
                onSmallerStep={requestSmallerStep}
                onSubmit={handleSubmit}
                smallerStepMessage={smallerStepMessage}
                submitMessage={submitMessage}
              />
              <LockedSteps detail={activeDetail} />
            </div>
            <div className="tutor-lower-grid">
              <TutorBasis detail={activeDetail} />
              <TutorActionPanel detail={activeDetail} onQuestionReturn={onQuestionReturn} overviewUrl={overviewUrl} />
            </div>
            <p className="tutor-source-boundary">{activeDetail.sourceBoundary}</p>
          </article>

          <TutorRightRail answer={answer} detail={activeDetail} submitted={submitted} />
          <TutorRailCompact answer={answer} detail={activeDetail} submitted={submitted} />
        </div>
      </main>
    </div>
  );
}

export interface TutorSessionServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function TutorSessionServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: TutorSessionServiceUnavailableProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="当前没有真实提示优先辅导服务端文档；不会把开发 Fixture、本地回答、提示步骤或页面点击伪装成 TutorSession、AI 结果、预算扣减或学习证据。"
          title="提示优先辅导服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
