import { useId, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  QuestionModeKind,
  TextQuestionCheckRow,
  TextQuestionComposer,
  TextQuestionComposerStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<TextQuestionComposerStatus, { readonly title: string; readonly description: string }> = {
  EMPTY: {
    title: "文字提问",
    description: "文字提问空表单已由服务端返回。",
  },
  DRAFT_LOCAL: {
    title: "本地草稿",
    description: "当前只保留本页面会话草稿，不跨账号、不跨设备。",
  },
  DRAFT_SERVER: {
    title: "云端草稿",
    description: "云端草稿需要 version / ETag 校验；当前前端不会自行合并不同版本。",
  },
  BUDGET_EXHAUSTED: {
    title: "预算暂不可用",
    description: "不会清空问题草稿；应保留非 AI 学习入口，等待服务端预算状态恢复。",
  },
  RESULT_UNKNOWN: {
    title: "提交结果待确认",
    description: "不能自动重复提交；需要查询原 operation 后再决定下一步。",
  },
  OFFLINE_DRAFT: {
    title: "离线草稿",
    description: "当前只能保留本设备页面会话内输入，不能创建提问或辅导会话。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后，再继续本人文字提问草稿。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "提问范围不可用",
    description: "当前上下文不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function TextQuestionMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="text-question-mobile-menu">
      <summary aria-label="打开移动端文字提问导航">
        <span>
          <strong>清朗学习</strong>
          <small>文字提问</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端文字提问功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <span aria-current="page">文字提问</span>
        <span>单题图片 · 未接入</span>
      </nav>
    </details>
  );
}

function TextQuestionPageHeader({
  dateFootnote,
  dateTime,
  demoActive,
  detail,
  overviewUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: TextQuestionComposer;
  readonly overviewUrl: string;
}) {
  return (
    <header className="page-header text-question-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
          <span aria-hidden="true">/</span>
          <a href={overviewUrl}>课程与资料</a>
        </nav>
        <h1>{detail.title}</h1>
        <div className="text-question-header-meta">
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

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["text-question-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TextQuestionContext({
  detail,
  onHubReturn,
}: {
  readonly detail: TextQuestionComposer;
  readonly onHubReturn: () => void;
}) {
  return (
    <section className="text-question-context-panel" aria-labelledby="text-question-context-title">
      <div className="text-question-section-title">
        <h2 id="text-question-context-title">{detail.contextTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="text-question-context-list" rows={detail.contextRows} />
      <div className="text-question-context-foot">
        <p><Icon name="info" size={17} />{detail.contextNotice}</p>
        <button className="text-button" onClick={onHubReturn} type="button">
          {detail.returnHubLabel}
        </button>
      </div>
    </section>
  );
}

function CharacterCount({
  current,
  max,
}: {
  readonly current: number;
  readonly max: number;
}) {
  return (
    <span className={current > max ? "text-question-count is-over" : "text-question-count"}>
      {current} / {max}
    </span>
  );
}

function TextQuestionField({
  help,
  label,
  maxLength,
  onChange,
  placeholder,
  privacyHint,
  value,
}: {
  readonly help: string;
  readonly label: string;
  readonly maxLength: number;
  readonly onChange: (value: string) => void;
  readonly placeholder: string;
  readonly privacyHint: string;
  readonly value: string;
}) {
  const fieldId = useId();
  const helpId = `${fieldId}-help`;
  return (
    <div className="text-question-field">
      <div className="text-question-field-heading">
        <label htmlFor={fieldId}>
          {label}
          <span>＊ 必填</span>
        </label>
        <CharacterCount current={value.length} max={maxLength} />
      </div>
      <p id={helpId}>{help}</p>
      <textarea
        aria-describedby={helpId}
        id={fieldId}
        maxLength={maxLength}
        onChange={(event) => { onChange(event.currentTarget.value); }}
        placeholder={placeholder}
        value={value}
      />
      <p className="text-question-privacy-hint">
        <Icon name="lock" size={15} />
        {privacyHint}
      </p>
    </div>
  );
}

function buildDynamicChecks({
  attemptComplete,
  descriptionComplete,
  privacyConfirmed,
  rows,
}: {
  readonly attemptComplete: boolean;
  readonly descriptionComplete: boolean;
  readonly privacyConfirmed: boolean;
  readonly rows: readonly TextQuestionCheckRow[];
}): readonly TextQuestionCheckRow[] {
  return rows.map((row) => {
    if (row.id.endsWith("-description")) {
      return { ...row, completed: descriptionComplete, value: descriptionComplete ? "已完成" : "未完成" };
    }
    if (row.id.endsWith("-attempt")) {
      return { ...row, completed: attemptComplete, value: attemptComplete ? "已完成" : "未完成" };
    }
    if (row.id.endsWith("-privacy")) {
      return { ...row, completed: privacyConfirmed, value: privacyConfirmed ? "已确认" : "请在提交前确认" };
    }
    return row;
  });
}

function PreSubmitCheck({
  rows,
}: {
  readonly rows: readonly TextQuestionCheckRow[];
}) {
  return (
    <section className="text-question-check-panel" aria-labelledby="text-question-check-title">
      <div className="text-question-section-title">
        <h2 id="text-question-check-title">提交前检查</h2>
        <span aria-hidden="true" />
      </div>
      <dl>
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>
              {row.value}
              <span aria-label={row.completed ? "已完成" : "未完成"}>
                {row.completed ? <Icon name="check" size={15} /> : null}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p>完成全部必填项后才能提交。</p>
    </section>
  );
}

function SubmitQuestionAction({
  canSubmit,
  detail,
  onImageModeOpen,
  onKnowledgeReturn,
  submitMessage,
}: {
  readonly canSubmit: boolean;
  readonly detail: TextQuestionComposer;
  readonly onImageModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly onKnowledgeReturn: () => void;
  readonly submitMessage: string | null;
}) {
  return (
    <section className="text-question-action-panel" aria-labelledby="text-question-action-title">
      <div className="text-question-section-title">
        <h2 id="text-question-action-title">操作</h2>
        <span aria-hidden="true" />
      </div>
      <button className="primary-button" disabled={!canSubmit} type="submit">
        {detail.submitButtonLabel}
      </button>
      <p aria-live="polite">{submitMessage ?? (canSubmit ? detail.submitReadyHint : detail.submitDisabledHint)}</p>
      <div className="text-question-secondary-actions">
        <button
          className="text-button"
          disabled={detail.imageTargetId === null}
          onClick={() => {
            if (detail.imageTargetId !== null) {
              onImageModeOpen(detail.imageTargetId, "IMAGE");
            }
          }}
          type="button"
        >
          {detail.imageModeLabel}
          <Icon name="chevronRight" size={16} />
        </button>
        <button className="secondary-button" onClick={onKnowledgeReturn} type="button">
          {detail.returnKnowledgeLabel}
        </button>
      </div>
    </section>
  );
}

function TextQuestionHero({
  detail,
}: {
  readonly detail: TextQuestionComposer;
}) {
  return (
    <section className="text-question-hero" aria-labelledby="text-question-hero-title">
      <div className="text-question-hero-count" aria-label={`${detail.heroCountLabel} ${detail.heroTitle}`}>
        <strong>{detail.heroCountLabel}</strong>
      </div>
      <div>
        <h2 id="text-question-hero-title">{detail.heroTitle}</h2>
        <p>{detail.heroDescription}</p>
        <p className="text-question-draft-label">{detail.draftStateLabel}</p>
      </div>
    </section>
  );
}

function TextQuestionRailSection({
  className,
  rows,
  title,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `text-question-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className={["text-question-rail-section", className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <div className="text-question-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="text-question-rail-list" rows={rows} />
    </section>
  );
}

function TextQuestionPrivacyRules({ detail }: { readonly detail: TextQuestionComposer }) {
  return (
    <section className="text-question-privacy-panel" aria-labelledby="text-question-privacy-title">
      <h2 id="text-question-privacy-title">隐私规则</h2>
      <ul>
        {detail.privacyRules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}

function TextQuestionSubmitFlow({ detail }: { readonly detail: TextQuestionComposer }) {
  return (
    <section className="text-question-submit-flow" aria-labelledby="text-question-flow-title">
      <h2 id="text-question-flow-title">提交后流程</h2>
      <ul>
        {detail.submitFlowRows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </section>
  );
}

function TextQuestionRightRail({
  detail,
  dynamicDraftRows,
  dynamicFillRows,
}: {
  readonly detail: TextQuestionComposer;
  readonly dynamicDraftRows: readonly DefinitionRow[];
  readonly dynamicFillRows: readonly DefinitionRow[];
}) {
  return (
    <aside className="right-rail text-question-rail" aria-label="文字提问辅助信息">
      <TextQuestionRailSection rows={detail.railContextRows} title="当前上下文" />
      <TextQuestionRailSection rows={dynamicFillRows} title="填写状态" />
      <TextQuestionRailSection rows={dynamicDraftRows} title="草稿状态" />
      <TextQuestionRailSection rows={detail.aiBudgetRows} title="AI 与预算" />
      <TextQuestionSubmitFlow detail={detail} />
      <TextQuestionPrivacyRules detail={detail} />
      <TextQuestionRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="text-question-service-code">{detail.serviceCode}</p>
      <p className="text-question-rail-boundary">问题草稿与辅导记录仅在授权家庭范围内使用。</p>
    </aside>
  );
}

function TextQuestionRailCompact({
  detail,
  dynamicDraftRows,
  dynamicFillRows,
}: {
  readonly detail: TextQuestionComposer;
  readonly dynamicDraftRows: readonly DefinitionRow[];
  readonly dynamicFillRows: readonly DefinitionRow[];
}) {
  return (
    <details className="right-rail-collapsible text-question-collapsible">
      <summary>
        <span>上下文、草稿与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <TextQuestionRightRail
          detail={detail}
          dynamicDraftRows={dynamicDraftRows}
          dynamicFillRows={dynamicFillRows}
        />
      </div>
    </details>
  );
}

function buildFillRows({
  attemptLength,
  descriptionLength,
  detail,
  privacyConfirmed,
  submitted,
}: {
  readonly attemptLength: number;
  readonly descriptionLength: number;
  readonly detail: TextQuestionComposer;
  readonly privacyConfirmed: boolean;
  readonly submitted: boolean;
}): readonly DefinitionRow[] {
  return detail.fillStatusRows.map((row) => {
    if (row.id.endsWith("-description")) {
      return { ...row, value: `${String(descriptionLength)} / ${String(detail.descriptionMaxLength)}` };
    }
    if (row.id.endsWith("-attempt")) {
      return { ...row, value: `${String(attemptLength)} / ${String(detail.attemptMaxLength)}` };
    }
    if (row.id.endsWith("-privacy")) {
      return { ...row, value: privacyConfirmed ? "已确认" : "未完成" };
    }
    if (row.id.endsWith("-submit")) {
      return { ...row, value: submitted ? "服务未接入" : "不可用" };
    }
    return row;
  });
}

function buildDraftRows({
  detail,
  hasDraft,
}: {
  readonly detail: TextQuestionComposer;
  readonly hasDraft: boolean;
}): readonly DefinitionRow[] {
  return detail.draftStatusRows.map((row) => {
    if (row.id.endsWith("-current")) {
      return { ...row, value: hasDraft ? "本次会话" : "空" };
    }
    return row;
  });
}

export interface TextQuestionComposerRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly onHubReturn: () => void;
  readonly onImageModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly onKnowledgeReturn: () => void;
  readonly overviewUrl: string;
}

export function TextQuestionComposerRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  knowledgePointId,
  onHubReturn,
  onImageModeOpen,
  onKnowledgeReturn,
  overviewUrl,
}: TextQuestionComposerRouteProps) {
  const detail = course.textQuestionComposers?.find((item) => item.knowledgePointId === knowledgePointId) ??
    (knowledgePointId === null ? course.textQuestionComposers?.[0] : undefined);
  const [description, setDescription] = useState("");
  const [attempt, setAttempt] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const descriptionComplete = description.trim().length > 0;
  const attemptComplete = attempt.trim().length > 0;
  const canSubmit = descriptionComplete && attemptComplete && privacyConfirmed;
  const hasDraft = description.length > 0 || attempt.length > 0;

  const dynamicChecks = useMemo(
    () => detail === undefined
      ? []
      : buildDynamicChecks({
        attemptComplete,
        descriptionComplete,
        privacyConfirmed,
        rows: detail.preSubmitRows,
      }),
    [attemptComplete, descriptionComplete, detail, privacyConfirmed],
  );
  const dynamicFillRows = useMemo(
    () => detail === undefined
      ? []
      : buildFillRows({
        attemptLength: attempt.length,
        descriptionLength: description.length,
        detail,
        privacyConfirmed,
        submitted: submitMessage !== null,
      }),
    [attempt.length, description.length, detail, privacyConfirmed, submitMessage],
  );
  const dynamicDraftRows = useMemo(
    () => detail === undefined ? [] : buildDraftRows({ detail, hasDraft }),
    [detail, hasDraft],
  );

  if (detail === undefined) {
    return (
      <TextQuestionComposerServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端文字提问文档；生产环境不会用开发 Fixture 补问题草稿、预算或辅导会话。"
        title="文字提问"
      />
    );
  }

  if (detail.status !== "EMPTY") {
    const copy = serviceStateCopy[detail.status];
    return (
      <TextQuestionComposerServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.description}
        title={copy.title}
      />
    );
  }

  const activeDetail = detail;

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSubmitMessage(activeDetail.submitUnavailableMessage);
  }

  return (
    <div className="app-shell text-question-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <TextQuestionMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas text-question-canvas" id="main-content">
        <TextQuestionPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          demoActive={demoActive}
          detail={activeDetail}
          overviewUrl={overviewUrl}
        />

        <div className="content-grid text-question-grid">
          <form className="main-column text-question-main" onSubmit={handleSubmit}>
            <TextQuestionContext detail={activeDetail} onHubReturn={onHubReturn} />
            <TextQuestionHero detail={activeDetail} />

            <section className="text-question-form-panel" aria-label="文字提问表单">
              <TextQuestionField
                help={activeDetail.descriptionHelp}
                label={activeDetail.descriptionLabel}
                maxLength={activeDetail.descriptionMaxLength}
                onChange={setDescription}
                placeholder={activeDetail.descriptionPlaceholder}
                privacyHint={activeDetail.descriptionPrivacyHint}
                value={description}
              />
              <TextQuestionField
                help={activeDetail.attemptHelp}
                label={activeDetail.attemptLabel}
                maxLength={activeDetail.attemptMaxLength}
                onChange={setAttempt}
                placeholder={activeDetail.attemptPlaceholder}
                privacyHint={activeDetail.attemptPrivacyHint}
                value={attempt}
              />
              <label className="text-question-privacy-confirmation">
                <input
                  checked={privacyConfirmed}
                  onChange={(event) => { setPrivacyConfirmed(event.currentTarget.checked); }}
                  type="checkbox"
                />
                <span>{activeDetail.privacyConfirmationLabel}</span>
              </label>
            </section>

            <div className="text-question-lower-grid">
              <PreSubmitCheck rows={dynamicChecks} />
              <SubmitQuestionAction
                canSubmit={canSubmit}
                detail={activeDetail}
                onImageModeOpen={onImageModeOpen}
                onKnowledgeReturn={onKnowledgeReturn}
                submitMessage={submitMessage}
              />
            </div>

            <div className="text-question-bottom-actions" aria-label="文字提问底部操作">
              <button className="text-button" onClick={onKnowledgeReturn} type="button">
                {activeDetail.returnKnowledgeLabel}
                <Icon name="chevronRight" size={16} />
              </button>
              <button className="text-button" onClick={onHubReturn} type="button">
                {activeDetail.returnHubLabel}
                <Icon name="chevronRight" size={16} />
              </button>
            </div>

            <p className="text-question-source-boundary">{activeDetail.sourceBoundary}</p>
            <p className="text-question-draft-scope">{activeDetail.draftScopeLabel}</p>
          </form>

          <TextQuestionRightRail
            detail={activeDetail}
            dynamicDraftRows={dynamicDraftRows}
            dynamicFillRows={dynamicFillRows}
          />
          <TextQuestionRailCompact
            detail={activeDetail}
            dynamicDraftRows={dynamicDraftRows}
            dynamicFillRows={dynamicFillRows}
          />
        </div>
      </main>
    </div>
  );
}

export interface TextQuestionComposerServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function TextQuestionComposerServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: TextQuestionComposerServiceUnavailableProps) {
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
          description="当前没有真实文字提问服务端文档；不会把开发 Fixture、前端草稿、未确认预算或页面点击伪装成 TutorSession。"
          title="文字提问服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
