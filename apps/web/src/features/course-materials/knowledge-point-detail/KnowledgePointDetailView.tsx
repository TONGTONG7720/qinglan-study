import { useId, useState } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { FunctionPlot } from "../knowledge-intro/FunctionPlot";
import type {
  CourseSummary,
  DefinitionRow,
  KnowledgePointActionKind,
  KnowledgePointActionRow,
  KnowledgePointDetail,
  KnowledgePointDetailStatus,
  KnowledgePointExampleRow,
  KnowledgePointRuleStep,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<KnowledgePointDetailStatus, { readonly title: string; readonly description: string }> = {
  NORMAL: {
    title: "知识点详情",
    description: "知识点内容已由服务端返回。",
  },
  LONG_FORMULA_OR_PASSAGE: {
    title: "知识点详情",
    description: "公式或解释较长，页面保留完整数学语义与阅读顺序。",
  },
  EVIDENCE_UNAVAILABLE: {
    title: "证据暂不可用",
    description: "可以查看知识点解释，但不会生成或推断掌握证据。",
  },
  EMPTY_CONTENT: {
    title: "知识点暂无内容",
    description: "服务端没有返回知识点解释；页面不补造公式、例题、页码或学习证据。",
  },
  GENERIC_GUIDANCE: {
    title: "通用指导",
    description: "当前只有通用学习建议；不会假称已映射到教材页码或具体知识点。",
  },
  CONTENT_UNAVAILABLE: {
    title: "知识点内容暂时不可用",
    description: "当前无法读取受控内容库；不会用开发 Fixture 替代服务端结果。",
  },
  OFFLINE_READONLY: {
    title: "离线只读",
    description: "当前只能查看已缓存的只读摘要，不能开始练习、提问或生成证据。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后再读取本人知识点详情。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "知识点范围不可用",
    description: "当前知识点不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function KnowledgePointMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="knowledge-point-mobile-menu">
      <summary aria-label="打开移动端知识点导航">
        <span>
          <strong>清朗学习</strong>
          <small>课程与资料</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端知识点功能">
        <a href="/student/today">今日学习</a>
        <a aria-current="page" href={overviewUrl}>课程与资料</a>
        <span>当前点练习 · 未接入</span>
        <span>掌握证据 · 未接入</span>
      </nav>
    </details>
  );
}

function KnowledgePointPageHeader({
  dateFootnote,
  dateTime,
  detail,
  demoActive,
  overviewUrl,
  subjectDetailUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly detail: KnowledgePointDetail;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subjectDetailUrl: string;
}) {
  return (
    <header className="page-header knowledge-point-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <a href={overviewUrl}>课程与资料</a>
          <span aria-hidden="true">/</span>
          <a href={subjectDetailUrl}>{detail.subjectLabel}</a>
          <span aria-hidden="true">/</span>
          <span>{detail.breadcrumbChapterLabel}</span>
          <span aria-hidden="true">/</span>
          <span>{detail.breadcrumbKnowledgeLabel}</span>
        </nav>
        <h1>{detail.title}</h1>
        <div className="knowledge-point-header-meta">
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

function MathExpression({
  ariaLabel,
  className,
  expression,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly expression: string;
}) {
  return (
    <span aria-label={ariaLabel} className={["math-expression", className].filter(Boolean).join(" ")} role="math">
      {expression}
    </span>
  );
}

function KnowledgePointHero({
  detail,
  lockedTargetId,
  onActionOpen,
  onChapterReturn,
  onTextbookOpen,
}: {
  readonly detail: KnowledgePointDetail;
  readonly lockedTargetId: string | null;
  readonly onActionOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
  readonly onChapterReturn: () => void;
  readonly onTextbookOpen: () => void;
}) {
  const primaryDisabled = detail.primaryTargetId === null || lockedTargetId !== null;
  return (
    <section className="knowledge-point-hero" aria-labelledby="knowledge-point-hero-title">
      <div className="knowledge-point-key-count" aria-label={`${detail.keyCountLabel} ${detail.keyCountCaption}`}>
        <strong>{detail.keyCountLabel}</strong>
        <span>{detail.keyCountCaption}</span>
      </div>
      <div className="knowledge-point-hero-copy">
        <h2 id="knowledge-point-hero-title">顶点式把信息写在式子里</h2>
        <MathExpression
          ariaLabel={detail.formulaAriaLabel}
          className="knowledge-point-formula"
          expression={detail.formula}
        />
        <p>{detail.formulaDescription}</p>
        <dl className="knowledge-point-hero-meta">
          <div>
            <dt>内容来源</dt>
            <dd>{detail.textbookLine}</dd>
          </div>
          <div>
            <dt>预计时间</dt>
            <dd>{detail.durationLabel}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{detail.progressStatusLabel}</dd>
          </div>
        </dl>
        <div className="knowledge-point-action-row">
          <button
            className="primary-button"
            disabled={primaryDisabled}
            onClick={() => {
              if (detail.primaryTargetId !== null) {
                onActionOpen(detail.primaryTargetId, "PRACTICE");
              }
            }}
            type="button"
          >
            {lockedTargetId === detail.primaryTargetId ? "正在确认目标…" : detail.primaryActionLabel}
            <Icon name="arrowRight" size={18} />
          </button>
          <button className="secondary-button" onClick={onChapterReturn} type="button">
            {detail.returnChapterLabel}
          </button>
          <button className="text-button" onClick={onTextbookOpen} type="button">
            {detail.textbookActionLabel}
          </button>
        </div>
      </div>
      <RuleExplanation steps={detail.ruleSteps} />
    </section>
  );
}

function RuleExplanation({ steps }: { readonly steps: readonly KnowledgePointRuleStep[] }) {
  return (
    <section className="knowledge-rule-panel" aria-labelledby="knowledge-rule-title">
      <h2 id="knowledge-rule-title">按顺序读出三个特征</h2>
      <ol className="knowledge-rule-list">
        {steps.map((step) => (
          <li key={step.id}>
            <span aria-hidden="true">{step.ordinalLabel}</span>
            <div>
              <strong>{step.title}</strong>
              <MathExpression ariaLabel={step.tokenLabel} expression={step.tokenLabel} />
              <p>{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="knowledge-point-warning">符号与括号必须按顶点式结构读取，不要把 x - h 误读成 x + h。</p>
    </section>
  );
}

function WorkedExample({
  detail,
}: {
  readonly detail: KnowledgePointDetail;
}) {
  return (
    <section className="knowledge-example-section" aria-labelledby="knowledge-example-title">
      <div className="knowledge-section-title">
        <h2 id="knowledge-example-title">{detail.exampleTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <div className="knowledge-example-grid">
        <div className="knowledge-example-steps">
          <MathExpression
            ariaLabel={detail.exampleFormulaAriaLabel}
            className="knowledge-example-formula"
            expression={detail.exampleFormula}
          />
          <dl className="knowledge-example-list">
            {detail.exampleRows.map((row) => (
              <ExampleRow key={row.id} row={row} />
            ))}
          </dl>
        </div>
        <div className="knowledge-point-plot">
          <FunctionPlot
            accessibleDescription={detail.examplePlotDescription}
            config={{ a: -2, h: 1, k: 3, xMin: -2, xMax: 4, yMin: -6, yMax: 4 }}
            formula={detail.exampleFormula}
            points={[{ x: 1, y: 3 }]}
          />
        </div>
      </div>
    </section>
  );
}

function ExampleRow({ row }: { readonly row: KnowledgePointExampleRow }) {
  return (
    <div>
      <dt>{row.expression}</dt>
      <dd>{row.result}</dd>
    </div>
  );
}

function ContentBasis({
  rows,
  sourceBoundary,
}: {
  readonly rows: readonly DefinitionRow[];
  readonly sourceBoundary: string;
}) {
  return (
    <section className="knowledge-basis-section" aria-labelledby="knowledge-basis-title">
      <div className="knowledge-section-title">
        <h2 id="knowledge-basis-title">内容依据</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="knowledge-basis-list" rows={rows} />
      <p className="knowledge-point-source-boundary">{sourceBoundary}</p>
    </section>
  );
}

function KnowledgeActionBar({
  actions,
  lockedTargetId,
  onActionOpen,
}: {
  readonly actions: readonly KnowledgePointActionRow[];
  readonly lockedTargetId: string | null;
  readonly onActionOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
}) {
  return (
    <section className="knowledge-next-actions" aria-labelledby="knowledge-actions-title">
      <div className="knowledge-section-title">
        <h2 id="knowledge-actions-title">接下来可以</h2>
        <span aria-hidden="true" />
      </div>
      <ul>
        {actions.map((action) => (
          <li key={action.id}>
            <div>
              <strong>{action.label}</strong>
              <p>{action.summary}</p>
            </div>
            <button
              className="text-button"
              disabled={action.targetId === null || lockedTargetId !== null}
              onClick={() => {
                if (action.targetId !== null) {
                  onActionOpen(action.targetId, action.kind);
                }
              }}
              type="button"
            >
              {lockedTargetId === action.targetId ? "确认中…" : action.actionLabel}
              <Icon name="arrowRight" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function KnowledgeBottomActions({
  detail,
  lockedTargetId,
  onActionOpen,
  onChapterReturn,
  onTextbookOpen,
}: {
  readonly detail: KnowledgePointDetail;
  readonly lockedTargetId: string | null;
  readonly onActionOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
  readonly onChapterReturn: () => void;
  readonly onTextbookOpen: () => void;
}) {
  return (
    <div className="knowledge-bottom-actions" aria-label="知识点底部操作">
      <button
        className="primary-button"
        disabled={detail.primaryTargetId === null || lockedTargetId !== null}
        onClick={() => {
          if (detail.primaryTargetId !== null) {
            onActionOpen(detail.primaryTargetId, "PRACTICE");
          }
        }}
        type="button"
      >
        {lockedTargetId === detail.primaryTargetId ? "正在确认目标…" : detail.primaryActionLabel}
      </button>
      <button className="secondary-button" onClick={onChapterReturn} type="button">
        {detail.returnChapterLabel}
      </button>
      <button className="text-button" onClick={onTextbookOpen} type="button">
        {detail.textbookActionLabel}
        <Icon name="arrowRight" size={16} />
      </button>
    </div>
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
    <dl className={["knowledge-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function KnowledgeRailSection({
  className,
  rows,
  title,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `knowledge-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className={["knowledge-rail-section", className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <div className="knowledge-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="knowledge-rail-list" rows={rows} />
    </section>
  );
}

function KnowledgePointRightRail({
  detail,
  lockedTargetId,
  onTutorOpen,
}: {
  readonly detail: KnowledgePointDetail;
  readonly lockedTargetId: string | null;
  readonly onTutorOpen: (targetId: string | null) => void;
}) {
  return (
    <aside className="right-rail knowledge-point-rail" aria-label="知识点辅助信息">
      <KnowledgeRailSection rows={detail.infoRows} title="知识点信息" />
      <KnowledgeRailSection rows={detail.keyRows} title="三个关键" />
      <KnowledgeRailSection className="is-boundary" rows={detail.contentRows} title="内容依据" />
      <p className="knowledge-rail-boundary">本页为受控内容演示，生产环境必须由服务端确认。</p>
      <KnowledgeRailSection rows={detail.relatedStatusRows} title="关联状态" />
      <section className="knowledge-tutor-card" aria-labelledby="knowledge-tutor-title">
        <h2 id="knowledge-tutor-title"><Icon name="sparkles" size={18} />学习帮助</h2>
        <p>{detail.tutorQuestion}</p>
        <button
          className="secondary-button"
          disabled={lockedTargetId !== null}
          onClick={() => {
            onTutorOpen(detail.tutorTargetId);
          }}
          type="button"
        >
          {detail.tutorActionLabel}
        </button>
        <small>{detail.tutorBoundary}</small>
      </section>
      <KnowledgeRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="knowledge-service-code">KNOWLEDGE_POINT_DETAIL_SERVICE_UNAVAILABLE</p>
      <p className="knowledge-rail-boundary">隐私信息仅本人可见。成长有效线索需由服务端确认。</p>
    </aside>
  );
}

function KnowledgeRailCompact({
  detail,
  lockedTargetId,
  onTutorOpen,
}: {
  readonly detail: KnowledgePointDetail;
  readonly lockedTargetId: string | null;
  readonly onTutorOpen: (targetId: string | null) => void;
}) {
  return (
    <details className="right-rail-collapsible knowledge-point-collapsible">
      <summary>
        <span>知识点辅助信息</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <KnowledgePointRightRail detail={detail} lockedTargetId={lockedTargetId} onTutorOpen={onTutorOpen} />
      </div>
    </details>
  );
}

function ServiceStateNotice({
  overviewUrl,
  status,
}: {
  readonly overviewUrl: string;
  readonly status: KnowledgePointDetailStatus;
}) {
  const copy = serviceStateCopy[status];
  return (
    <div className="knowledge-point-service-state">
      <StatusPanel description={copy.description} title={copy.title} />
      <a className="secondary-button" href={overviewUrl}>返回数学课程</a>
    </div>
  );
}

export interface KnowledgePointDetailRouteProps {
  readonly chapterId: string | null;
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly overviewUrl: string;
  readonly subjectDetailUrl: string;
  readonly onActionOpen: (targetId: string, actionKind: KnowledgePointActionKind) => void;
  readonly onChapterReturn: (chapterId: string | null) => void;
  readonly onTextbookOpen: () => void;
  readonly onTutorOpen: (targetId: string | null) => void;
}

export function KnowledgePointDetailRoute({
  chapterId,
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  knowledgePointId,
  onActionOpen,
  onChapterReturn,
  onTextbookOpen,
  onTutorOpen,
  overviewUrl,
  subjectDetailUrl,
}: KnowledgePointDetailRouteProps) {
  const detail = course.knowledgePointDetails?.find((item) =>
    item.knowledgePointId === knowledgePointId && (chapterId === null || item.chapterId === chapterId)
  ) ?? (knowledgePointId === null ? course.knowledgePointDetails?.[0] : undefined);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);

  function openAction(targetId: string, actionKind: KnowledgePointActionKind): void {
    if (lockedTargetId !== null) {
      return;
    }
    setLockedTargetId(targetId);
    onActionOpen(targetId, actionKind);
  }

  function openTutor(targetId: string | null): void {
    if (lockedTargetId !== null) {
      return;
    }
    setLockedTargetId(targetId ?? "knowledge-point-ai-tutor");
    onTutorOpen(targetId);
  }

  function returnToChapter(): void {
    onChapterReturn(chapterId ?? detail?.chapterId ?? null);
  }

  if (detail === undefined) {
    return (
      <KnowledgePointDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={subjectDetailUrl}
        subtitle="当前课程没有服务端知识点详情文档；生产环境不会用开发 Fixture 补公式、例题、页码或证据。"
        title="知识点详情"
      />
    );
  }

  if (detail.status !== "NORMAL" && detail.status !== "LONG_FORMULA_OR_PASSAGE") {
    return (
      <div className="app-shell knowledge-point-detail-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
        <KnowledgePointMobileMenu overviewUrl={overviewUrl} />
        <main className="paper-canvas knowledge-point-detail-canvas" id="main-content">
          <KnowledgePointPageHeader
            dateFootnote={dateFootnote}
            dateTime={dateTime}
            detail={detail}
            demoActive={demoActive}
            overviewUrl={overviewUrl}
            subjectDetailUrl={subjectDetailUrl}
          />
          <ServiceStateNotice overviewUrl={subjectDetailUrl} status={detail.status} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell knowledge-point-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
      <KnowledgePointMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas knowledge-point-detail-canvas" id="main-content">
        <KnowledgePointPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          detail={detail}
          demoActive={demoActive}
          overviewUrl={overviewUrl}
          subjectDetailUrl={subjectDetailUrl}
        />

        <div className="content-grid knowledge-point-detail-grid">
          <article className="main-column knowledge-point-main" aria-label="知识点详情">
            <KnowledgePointHero
              detail={detail}
              lockedTargetId={lockedTargetId}
              onActionOpen={openAction}
              onChapterReturn={returnToChapter}
              onTextbookOpen={onTextbookOpen}
            />
            <WorkedExample detail={detail} />
            <ContentBasis rows={detail.basisRows} sourceBoundary={detail.sourceBoundary} />
            <KnowledgeActionBar actions={detail.actionRows} lockedTargetId={lockedTargetId} onActionOpen={openAction} />
            <KnowledgeBottomActions
              detail={detail}
              lockedTargetId={lockedTargetId}
              onActionOpen={openAction}
              onChapterReturn={returnToChapter}
              onTextbookOpen={onTextbookOpen}
            />
          </article>

          <KnowledgePointRightRail detail={detail} lockedTargetId={lockedTargetId} onTutorOpen={openTutor} />
          <KnowledgeRailCompact detail={detail} lockedTargetId={lockedTargetId} onTutorOpen={openTutor} />
        </div>
      </main>
    </div>
  );
}

export interface KnowledgePointDetailServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function KnowledgePointDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: KnowledgePointDetailServiceUnavailableProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="当前没有真实知识点详情服务端文档；不会把开发 Fixture、通用解释、未确认目标或前端点击伪装成学习进度与掌握证据。"
          title="知识点详情服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
