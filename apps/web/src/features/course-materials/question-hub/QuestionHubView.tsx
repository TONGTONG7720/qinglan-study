import { useId, useState } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  KnowledgePointActionKind,
  NonAiFallbackLink,
  QuestionHub,
  QuestionHubStatus,
  QuestionModeKind,
  QuestionModeOption,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<QuestionHubStatus, { readonly title: string; readonly description: string }> = {
  MODES_AVAILABLE: {
    title: "提问中心",
    description: "提问方式已由服务端返回。",
  },
  MISSING_CONTEXT: {
    title: "缺少学习上下文",
    description: "无法确认学科、章节或知识点；页面不会猜测 subjectCode、chapterId 或 knowledgePointId。",
  },
  AI_UNAVAILABLE: {
    title: "AI 暂不可用",
    description: "文字和图片提问入口暂不可进入；课程内容、练习和笔记入口仍可继续使用。",
  },
  BUDGET_EXHAUSTED: {
    title: "AI 预算已用完",
    description: "不会锁死学生工作区；请先使用非 AI 学习入口，或等待家庭预算恢复。",
  },
  OFFLINE: {
    title: "离线只读",
    description: "当前只能查看已缓存的上下文，不能创建提问草稿、上传图片或进入辅导。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后再读取本人提问上下文。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "提问范围不可用",
    description: "当前上下文不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function QuestionHubMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="question-hub-mobile-menu">
      <summary aria-label="打开移动端提问导航">
        <span>
          <strong>清朗学习</strong>
          <small>AI 辅导</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端提问功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <a aria-current="page" href="/student/learn?view=question-hub">AI 辅导</a>
        <span>文字提问 · 未接入</span>
        <span>单题图片 · 未接入</span>
      </nav>
    </details>
  );
}

function QuestionHubPageHeader({
  dateFootnote,
  dateTime,
  demoActive,
  detail,
  overviewUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: QuestionHub;
  readonly overviewUrl: string;
}) {
  return (
    <header className="page-header question-hub-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
          <span aria-hidden="true">/</span>
          <a href={overviewUrl}>{detail.title}</a>
        </nav>
        <h1>{detail.title}</h1>
        <div className="question-hub-header-meta">
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
    <dl className={["question-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function QuestionContext({
  detail,
  onContextChange,
}: {
  readonly detail: QuestionHub;
  readonly onContextChange: () => void;
}) {
  return (
    <section className="question-context-panel" aria-labelledby="question-context-title">
      <div className="question-section-title">
        <h2 id="question-context-title">{detail.contextTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="question-context-list" rows={detail.contextRows} />
      <div className="question-context-foot">
        <p><Icon name="info" size={17} />{detail.contextNotice}</p>
        <button className="text-button" onClick={onContextChange} type="button">
          {detail.contextActionLabel}
        </button>
      </div>
    </section>
  );
}

function QuestionModeSelector({
  detail,
  lockedTargetId,
  onModeOpen,
}: {
  readonly detail: QuestionHub;
  readonly lockedTargetId: string | null;
  readonly onModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
}) {
  return (
    <section className="question-mode-hero" aria-labelledby="question-mode-title">
      <div className="question-mode-count" aria-label={`${detail.modeCountLabel} ${detail.modeCountCaption}`}>
        <strong>{detail.modeCountLabel}</strong>
        <span>{detail.modeCountCaption}</span>
      </div>
      <div className="question-mode-intro">
        <h2 id="question-mode-title">{detail.modeTitle}</h2>
        <p>{detail.modeDescription}</p>
        <p className="question-mode-status">{detail.modeStatusLabel}</p>
      </div>
      <div className="question-mode-options" role="group" aria-label="选择提问方式">
        {detail.modeOptions.map((option) => (
          <QuestionModeOptionCard
            key={option.id}
            lockedTargetId={lockedTargetId}
            onModeOpen={onModeOpen}
            option={option}
          />
        ))}
      </div>
    </section>
  );
}

function QuestionModeOptionCard({
  lockedTargetId,
  onModeOpen,
  option,
}: {
  readonly lockedTargetId: string | null;
  readonly onModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly option: QuestionModeOption;
}) {
  const disabled = lockedTargetId !== null || option.targetId === null;
  return (
    <article className={`question-mode-option is-${option.kind.toLowerCase()}`} aria-labelledby={`question-${option.id}-title`}>
      {option.badgeLabel === undefined ? null : <span className="question-mode-badge">{option.badgeLabel}</span>}
      <div className="question-mode-option-copy">
        <h3 id={`question-${option.id}-title`}>{option.title}</h3>
        <p>{option.summary}</p>
      </div>
      <ol className="question-mode-steps" aria-label={`${option.title}流程`}>
        {option.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <ul className="question-mode-notes">
        {option.notes.map((note) => (
          <li key={note}><Icon name="check" size={17} />{note}</li>
        ))}
      </ul>
      <button
        className={option.kind === "TEXT" ? "primary-button" : "secondary-button"}
        disabled={disabled}
        onClick={() => {
          if (option.targetId !== null) {
            onModeOpen(option.targetId, option.kind);
          }
        }}
        type="button"
      >
        {lockedTargetId === option.targetId ? "正在确认方式…" : option.actionLabel}
        <Icon name="arrowRight" size={18} />
      </button>
    </article>
  );
}

function QuestionPrecheck({ detail }: { readonly detail: QuestionHub }) {
  return (
    <section className="question-precheck-panel" aria-labelledby="question-precheck-title">
      <div className="question-section-title">
        <h2 id="question-precheck-title">{detail.precheckTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <ol>
        {detail.precheckRows.map((row, index) => (
          <li key={row}>
            <span aria-hidden="true">{String(index + 1)}</span>
            <p>{row}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NonAiFallbackLinks({
  detail,
  lockedTargetId,
  onFallbackOpen,
  onKnowledgeReturn,
  onNotesOpen,
}: {
  readonly detail: QuestionHub;
  readonly lockedTargetId: string | null;
  readonly onFallbackOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
  readonly onKnowledgeReturn: () => void;
  readonly onNotesOpen: () => void;
}) {
  return (
    <section className="question-fallback-panel" aria-labelledby="question-fallback-title">
      <div>
        <h2 id="question-fallback-title">{detail.aiUnavailableTitle}</h2>
        <p>{detail.aiUnavailableDescription}</p>
      </div>
      <ul>
        {detail.fallbackLinks.map((link) => (
          <FallbackLinkRow
            key={link.id}
            link={link}
            lockedTargetId={lockedTargetId}
            onFallbackOpen={onFallbackOpen}
            onKnowledgeReturn={onKnowledgeReturn}
            onNotesOpen={onNotesOpen}
          />
        ))}
      </ul>
    </section>
  );
}

function FallbackLinkRow({
  link,
  lockedTargetId,
  onFallbackOpen,
  onKnowledgeReturn,
  onNotesOpen,
}: {
  readonly link: NonAiFallbackLink;
  readonly lockedTargetId: string | null;
  readonly onFallbackOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
  readonly onKnowledgeReturn: () => void;
  readonly onNotesOpen: () => void;
}) {
  function handleClick(): void {
    if (link.targetId === null) {
      onNotesOpen();
      return;
    }
    if (link.actionKind === "QUESTION") {
      onKnowledgeReturn();
      return;
    }
    onFallbackOpen(link.targetId, link.actionKind);
  }

  return (
    <li>
      <div>
        <strong>{link.label}</strong>
        <p>{link.summary}</p>
      </div>
      <button className="text-button" disabled={lockedTargetId !== null} onClick={handleClick} type="button">
        {link.actionLabel}
        <Icon name="chevronRight" size={16} />
      </button>
    </li>
  );
}

function QuestionRailSection({
  className,
  rows,
  title,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `question-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className={["question-rail-section", className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <div className="question-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="question-rail-list" rows={rows} />
    </section>
  );
}

function PrivacyBoundary({ detail }: { readonly detail: QuestionHub }) {
  return (
    <section className="question-privacy-panel" aria-labelledby="question-privacy-title">
      <h2 id="question-privacy-title">隐私规则</h2>
      <ul>
        {detail.privacyRules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}

function QuestionHubRightRail({ detail }: { readonly detail: QuestionHub }) {
  return (
    <aside className="right-rail question-hub-rail" aria-label="提问中心辅助信息">
      <QuestionRailSection rows={detail.railContextRows} title="当前上下文" />
      <QuestionRailSection rows={detail.aiStatusRows} title="AI 可用状态" />
      <QuestionRailSection rows={detail.budgetRows} title="预算与限制" />
      <QuestionRailSection rows={detail.questionRecordRows} title="提问记录" />
      <PrivacyBoundary detail={detail} />
      <QuestionRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="question-service-code">{detail.serviceCode}</p>
      <p className="question-rail-boundary">问题、图片与辅导记录仅在授权家庭范围内使用。</p>
    </aside>
  );
}

function QuestionRailCompact({ detail }: { readonly detail: QuestionHub }) {
  return (
    <details className="right-rail-collapsible question-hub-collapsible">
      <summary>
        <span>上下文、预算与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <QuestionHubRightRail detail={detail} />
      </div>
    </details>
  );
}

function ServiceStateNotice({
  overviewUrl,
  status,
}: {
  readonly overviewUrl: string;
  readonly status: QuestionHubStatus;
}) {
  const copy = serviceStateCopy[status];
  return (
    <div className="question-service-state">
      <StatusPanel description={copy.description} title={copy.title} />
      <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
    </div>
  );
}

export interface QuestionHubRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly onContextChange: () => void;
  readonly onFallbackOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
  readonly onKnowledgeReturn: () => void;
  readonly onModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly onNotesOpen: () => void;
  readonly overviewUrl: string;
}

export function QuestionHubRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  knowledgePointId,
  onContextChange,
  onFallbackOpen,
  onKnowledgeReturn,
  onModeOpen,
  onNotesOpen,
  overviewUrl,
}: QuestionHubRouteProps) {
  const detail = course.questionHubs?.find((item) => item.knowledgePointId === knowledgePointId) ??
    (knowledgePointId === null ? course.questionHubs?.[0] : undefined);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);

  function openMode(targetId: string, modeKind: QuestionModeKind): void {
    if (lockedTargetId !== null) {
      return;
    }
    setLockedTargetId(targetId);
    onModeOpen(targetId, modeKind);
  }

  function openFallback(targetId: string, actionKind: KnowledgePointActionKind): void {
    if (lockedTargetId !== null) {
      return;
    }
    setLockedTargetId(targetId);
    onFallbackOpen(targetId, actionKind);
  }

  if (detail === undefined) {
    return (
      <QuestionHubServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端提问中心文档；生产环境不会用开发 Fixture 补上下文、预算、提问记录或 AI 可用状态。"
        title="提问中心"
      />
    );
  }

  if (detail.status !== "MODES_AVAILABLE") {
    return (
      <div className="app-shell question-hub-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
        <QuestionHubMobileMenu overviewUrl={overviewUrl} />
        <main className="paper-canvas question-hub-canvas" id="main-content">
          <QuestionHubPageHeader
            dateFootnote={dateFootnote}
            dateTime={dateTime}
            demoActive={demoActive}
            detail={detail}
            overviewUrl={overviewUrl}
          />
          <ServiceStateNotice overviewUrl={overviewUrl} status={detail.status} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell question-hub-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <QuestionHubMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas question-hub-canvas" id="main-content">
        <QuestionHubPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          demoActive={demoActive}
          detail={detail}
          overviewUrl={overviewUrl}
        />

        <div className="content-grid question-hub-grid">
          <article className="main-column question-hub-main" aria-label="提问中心">
            <QuestionContext detail={detail} onContextChange={onContextChange} />
            <QuestionModeSelector detail={detail} lockedTargetId={lockedTargetId} onModeOpen={openMode} />
            <div className="question-lower-grid">
              <QuestionPrecheck detail={detail} />
              <NonAiFallbackLinks
                detail={detail}
                lockedTargetId={lockedTargetId}
                onFallbackOpen={openFallback}
                onKnowledgeReturn={onKnowledgeReturn}
                onNotesOpen={onNotesOpen}
              />
            </div>
            <div className="question-bottom-actions" aria-label="提问中心底部操作">
              {detail.modeOptions.map((option) => (
                <button
                  className={option.kind === "TEXT" ? "primary-button" : "secondary-button"}
                  disabled={lockedTargetId !== null || option.targetId === null}
                  key={option.id}
                  onClick={() => {
                    if (option.targetId !== null) {
                      openMode(option.targetId, option.kind);
                    }
                  }}
                  type="button"
                >
                  {lockedTargetId === option.targetId ? "正在确认方式…" : option.actionLabel}
                </button>
              ))}
              <button className="text-button" onClick={onKnowledgeReturn} type="button">
                返回知识点
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
            <p className="question-source-boundary">{detail.sourceBoundary}</p>
          </article>

          <QuestionHubRightRail detail={detail} />
          <QuestionRailCompact detail={detail} />
        </div>
      </main>
    </div>
  );
}

export interface QuestionHubServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function QuestionHubServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: QuestionHubServiceUnavailableProps) {
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
          description="当前没有真实提问中心服务端文档；不会把开发 Fixture、通用上下文、前端点击或未确认预算伪装成可用 AI 服务。"
          title="提问中心服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
