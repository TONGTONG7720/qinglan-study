import { useState } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import type { IconName } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  ChapterCompletionConditionRow,
  ChapterDetail,
  ChapterDetailStatus,
  ChapterEvidenceStatusRow,
  ChapterFlowStepRow,
  ChapterKnowledgePointRow,
  ChapterResourceRow,
  CourseSummary,
  DefinitionRow,
  MaterialType,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<ChapterDetailStatus, { readonly title: string; readonly description: string }> = {
  NORMAL: {
    title: "章节详情",
    description: "章节内容已由服务端返回。",
  },
  LONG_CONTENT: {
    title: "章节详情",
    description: "章节内容较长，页面保留完整语义并允许换行阅读。",
  },
  GENERIC_GUIDANCE_MAPPING: {
    title: "章节尚未确认",
    description: "当前只有通用学习映射；不会生成具体知识点顺序、页码依据或已对齐状态。",
  },
  EMPTY_CHAPTER: {
    title: "章节暂无内容",
    description: "服务端没有返回知识点列表；页面不补造知识点、练习或学习证据。",
  },
  CHAPTER_ADJUSTED: {
    title: "章节版本已调整",
    description: "教材版本或章节顺序已更新，请刷新安全目标后再继续本课。",
  },
  CONTENT_UNAVAILABLE: {
    title: "章节内容暂时不可用",
    description: "当前无法读取本章内容依据；不会使用开发 Fixture 替代服务端结果。",
  },
  OFFLINE_READONLY: {
    title: "离线只读",
    description: "当前只能查看已缓存的只读章节摘要，不能打开新知识点或提交学习证据。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后再读取本人章节详情。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "章节范围不可用",
    description: "当前章节不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function materialIcon(materialType: MaterialType): IconName {
  if (materialType === "TEXTBOOK") {
    return "bookOpen";
  }
  if (materialType === "LECTURE_NOTE") {
    return "fileText";
  }
  if (materialType === "EXERCISE") {
    return "check";
  }
  return "upload";
}

function ChapterMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="chapter-mobile-menu">
      <summary>
        <span>
          <strong>清朗学习</strong>
          <small>课程与资料</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端学习功能">
        <a href="/student/today">今日学习</a>
        <a aria-current="page" href={overviewUrl}>课程与资料</a>
        <span>教材原文 · 只读</span>
        <span>知识点详情 · 未接入</span>
        <span>AI 辅导 · 未接入</span>
      </nav>
    </details>
  );
}

function ChapterDetailPageHeader({
  dateFootnote,
  dateTime,
  detail,
  demoActive,
  overviewUrl,
  subjectDetailUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly detail: ChapterDetail;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subjectDetailUrl: string;
}) {
  return (
    <header className="page-header chapter-detail-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <a href={overviewUrl}>课程与资料</a>
          <span aria-hidden="true">/</span>
          <a href={subjectDetailUrl}>{detail.subjectLabel}</a>
          <span aria-hidden="true">/</span>
          <span>{detail.breadcrumbChapterLabel}</span>
        </nav>
        <h1>{detail.title}</h1>
        <div className="chapter-header-meta">
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

function ChapterStageRail({ labels }: { readonly labels: readonly string[] }) {
  return (
    <ol className="chapter-stage-rail" aria-label="本课学习步骤">
      {labels.map((label) => (
        <li key={label}>
          <span aria-hidden="true" />
          <p>{label}</p>
        </li>
      ))}
    </ol>
  );
}

function ChapterHero({
  detail,
  lockedTargetId,
  onKnowledgePointOpen,
  onTextbookOpen,
}: {
  readonly detail: ChapterDetail;
  readonly lockedTargetId: string | null;
  readonly onKnowledgePointOpen: (targetId: string) => void;
  readonly onTextbookOpen: () => void;
}) {
  const primaryDisabled = lockedTargetId !== null || detail.primaryTargetId === null;
  return (
    <section className="chapter-hero" aria-labelledby="chapter-hero-title">
      <div className="chapter-lesson-number" aria-hidden="true">{detail.lessonNumberLabel}</div>
      <div className="chapter-hero-copy">
        <h2 className="chapter-hero-title" id="chapter-hero-title">{detail.title}</h2>
        <dl className="chapter-hero-meta" aria-label="章节概况">
          <div>
            <dt>教材</dt>
            <dd>{detail.textbookLine}</dd>
          </div>
          <div>
            <dt>时间</dt>
            <dd>{detail.durationLabel}</dd>
          </div>
          <div>
            <dt>流程</dt>
            <dd>{detail.stepCountLabel}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{detail.progressStatusLabel}</dd>
          </div>
        </dl>
        <div className="chapter-action-row">
          <button
            className="primary-button"
            disabled={primaryDisabled}
            onClick={() => {
              if (detail.primaryTargetId !== null) {
                onKnowledgePointOpen(detail.primaryTargetId);
              }
            }}
            type="button"
          >
            <span>{detail.actionLabel}</span>
            <Icon name="arrowRight" size={18} />
          </button>
          <button className="text-link-button" onClick={onTextbookOpen} type="button">
            <span>{detail.textbookActionLabel}</span>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
      <ChapterStageRail labels={detail.stageLabels} />
    </section>
  );
}

function ChapterObjective({ goals }: { readonly goals: readonly string[] }) {
  return (
    <section className="chapter-section chapter-objective" aria-labelledby="chapter-objective-title">
      <div className="section-title">
        <h2 id="chapter-objective-title">本课学习目标</h2>
        <span aria-hidden="true" />
      </div>
      <ol>
        {goals.map((goal) => (
          <li key={goal}>{goal}</li>
        ))}
      </ol>
    </section>
  );
}

function DefinitionList({
  rows,
  title,
}: {
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  return (
    <section className="chapter-section chapter-definition-section" aria-labelledby={`chapter-${title}-title`}>
      <div className="section-title">
        <h2 id={`chapter-${title}-title`}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <dl className="chapter-definition-list">
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function KnowledgePointRow({
  lockedTargetId,
  onKnowledgePointOpen,
  point,
}: {
  readonly lockedTargetId: string | null;
  readonly onKnowledgePointOpen: (targetId: string) => void;
  readonly point: ChapterKnowledgePointRow;
}) {
  const disabled = lockedTargetId !== null || point.targetId === null;
  return (
    <li className={`chapter-knowledge-item is-${point.status.toLowerCase()}`}>
      <button
        aria-current={point.status === "CURRENT" ? "step" : undefined}
        aria-label={`${point.ordinalLabel} ${point.title}，${point.summary}，${point.basisLabel}，${point.durationLabel}，${point.statusLabel}`}
        className="chapter-knowledge-row"
        disabled={disabled}
        onClick={() => {
          if (point.targetId !== null) {
            onKnowledgePointOpen(point.targetId);
          }
        }}
        type="button"
      >
        <span className="chapter-knowledge-marker" aria-hidden="true">{point.ordinalLabel}</span>
        <strong>{point.title}</strong>
        <span className="chapter-knowledge-summary">{point.summary}</span>
        <span className="chapter-knowledge-basis">{point.basisLabel}</span>
        <span className="chapter-knowledge-duration">{point.durationLabel}</span>
        <span className="chapter-knowledge-status">{point.statusLabel}</span>
        <Icon className="chapter-knowledge-arrow" name="chevronRight" size={16} />
      </button>
    </li>
  );
}

function KnowledgePointSequence({
  lockedTargetId,
  onKnowledgePointOpen,
  points,
}: {
  readonly lockedTargetId: string | null;
  readonly onKnowledgePointOpen: (targetId: string) => void;
  readonly points: readonly ChapterKnowledgePointRow[];
}) {
  return (
    <section className="chapter-section" aria-labelledby="chapter-knowledge-title">
      <div className="section-title">
        <h2 id="chapter-knowledge-title">知识点顺序</h2>
        <span aria-hidden="true" />
      </div>
      <ol className="chapter-knowledge-list">
        {points.map((point) => (
          <KnowledgePointRow
            key={point.id}
            lockedTargetId={lockedTargetId}
            onKnowledgePointOpen={onKnowledgePointOpen}
            point={point}
          />
        ))}
      </ol>
    </section>
  );
}

function ChapterFlowRow({
  lockedTargetId,
  onKnowledgePointOpen,
  step,
}: {
  readonly lockedTargetId: string | null;
  readonly onKnowledgePointOpen: (targetId: string) => void;
  readonly step: ChapterFlowStepRow;
}) {
  const disabled = lockedTargetId !== null || step.targetId === null;
  return (
    <li className="chapter-flow-item">
      <button
        aria-label={`${step.ordinalLabel} ${step.title}，${step.summary}，${step.durationLabel}`}
        className="chapter-flow-row"
        disabled={disabled}
        onClick={() => {
          if (step.targetId !== null) {
            onKnowledgePointOpen(step.targetId);
          }
        }}
        type="button"
      >
        <span className="chapter-flow-marker" aria-hidden="true">{step.ordinalLabel}</span>
        <strong>{step.title}</strong>
        <span>{step.summary}</span>
        <time>{step.durationLabel}</time>
        <Icon name="chevronRight" size={16} />
      </button>
    </li>
  );
}

function ChapterFlow({
  lockedTargetId,
  onKnowledgePointOpen,
  steps,
}: {
  readonly lockedTargetId: string | null;
  readonly onKnowledgePointOpen: (targetId: string) => void;
  readonly steps: readonly ChapterFlowStepRow[];
}) {
  return (
    <section className="chapter-section" aria-labelledby="chapter-flow-title">
      <div className="section-title">
        <h2 id="chapter-flow-title">本课流程</h2>
        <span aria-hidden="true" />
      </div>
      <ol className="chapter-flow-list">
        {steps.map((step) => (
          <ChapterFlowRow
            key={step.id}
            lockedTargetId={lockedTargetId}
            onKnowledgePointOpen={onKnowledgePointOpen}
            step={step}
          />
        ))}
      </ol>
    </section>
  );
}

function RailTitle({
  actionLabel,
  title,
}: {
  readonly actionLabel?: string;
  readonly title: string;
}) {
  return (
    <div className="chapter-rail-title">
      <h2>{title}</h2>
      {actionLabel === undefined ? null : (
        <button className="text-button" disabled type="button">
          {actionLabel}
          <Icon name="chevronRight" size={14} />
        </button>
      )}
      <span aria-hidden="true" />
    </div>
  );
}

function ChapterResourceRows({ resources }: { readonly resources: readonly ChapterResourceRow[] }) {
  return (
    <dl className="chapter-rail-list">
      {resources.map((resource) => (
        <div className="chapter-rail-row" key={resource.id}>
          <Icon name={materialIcon(resource.materialType)} size={20} />
          <dt>{resource.label}</dt>
          <dd>{resource.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CompletionConditionRows({
  rows,
}: {
  readonly rows: readonly ChapterCompletionConditionRow[];
}) {
  return (
    <dl className="chapter-condition-list">
      {rows.map((row) => (
        <div key={row.id}>
          <dt>
            <span>{row.label}</span>
            <small>{row.statusLabel}</small>
          </dt>
          <dd>
            <Icon name={row.completed ? "check" : "circleAlert"} size={17} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ChapterEvidenceRows({ rows }: { readonly rows: readonly ChapterEvidenceStatusRow[] }) {
  return (
    <dl className="chapter-rail-list">
      {rows.map((row) => (
        <div className="chapter-rail-row" key={row.id}>
          <Icon name={materialIcon(row.materialType)} size={20} />
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChapterServiceRows({ rows }: { readonly rows: readonly DefinitionRow[] }) {
  return (
    <dl className="chapter-service-list">
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChapterDetailRightRail({
  detail,
  onTutorOpen,
}: {
  readonly detail: ChapterDetail;
  readonly onTutorOpen: () => void;
}) {
  return (
    <aside className="right-rail chapter-detail-rail" aria-label="章节详情辅助信息">
      <RailTitle actionLabel="查看全部资料" title="本课资料" />
      <ChapterResourceRows resources={detail.resources} />

      <RailTitle title="完成条件" />
      <CompletionConditionRows rows={detail.completionConditions} />

      <RailTitle actionLabel="查看全部证据" title="学习证据" />
      <ChapterEvidenceRows rows={detail.evidence} />
      <button className="chapter-evidence-button" disabled type="button">
        <span>添加学习证据</span>
        <Icon name="upload" size={16} />
      </button>

      <section className="chapter-ai-card" aria-labelledby="chapter-ai-title">
        <h2 id="chapter-ai-title">
          <Icon name="sparkles" size={21} />
          <span>AI 辅导</span>
        </h2>
        <div>
          <p>{detail.aiTutorQuestion}</p>
          <button className="secondary-button" onClick={onTutorOpen} type="button">
            <span>进入辅导</span>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </section>

      <RailTitle title="服务与隐私" />
      <ChapterServiceRows rows={detail.serviceRows} />
      <p className="chapter-rail-boundary">{detail.sourceBoundary}</p>
    </aside>
  );
}

function ChapterRailCompact({
  detail,
  onTutorOpen,
}: {
  readonly detail: ChapterDetail;
  readonly onTutorOpen: () => void;
}) {
  return (
    <details className="right-rail-collapsible chapter-detail-collapsible">
      <summary>
        <span>本课资料、证据与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content chapter-detail-collapsible-content">
        <ChapterDetailRightRail detail={detail} onTutorOpen={onTutorOpen} />
      </div>
    </details>
  );
}

function ServiceStateNotice({
  overviewUrl,
  status,
}: {
  readonly overviewUrl: string;
  readonly status: ChapterDetailStatus;
}) {
  const copy = serviceStateCopy[status];
  return (
    <div className="chapter-service-state">
      <StatusPanel description={copy.description} title={copy.title} />
      <a className="secondary-button" href={overviewUrl}>返回数学课程</a>
    </div>
  );
}

function MissingChapterState({ subjectDetailUrl }: { readonly subjectDetailUrl: string }) {
  return (
    <div className="chapter-service-state">
      <StatusPanel
        description="当前课程没有服务端章节详情文档；生产环境不会用开发 Fixture 补知识点顺序、页码依据或学习证据。"
        title="章节详情服务暂时不可用"
      />
      <a className="secondary-button" href={subjectDetailUrl}>返回数学课程</a>
    </div>
  );
}

export interface ChapterDetailRouteProps {
  readonly chapterId: string | null;
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subjectDetailUrl: string;
  readonly onKnowledgePointOpen: (targetId: string) => void;
  readonly onTextbookOpen: () => void;
  readonly onTutorOpen: () => void;
}

export function ChapterDetailRoute({
  chapterId,
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  onKnowledgePointOpen,
  onTextbookOpen,
  onTutorOpen,
  overviewUrl,
  subjectDetailUrl,
}: ChapterDetailRouteProps) {
  const detail = course.chapterDetails?.find((item) => item.chapterId === chapterId) ??
    (chapterId === null ? course.chapterDetails?.[0] : undefined);
  const [lockedTargetId, setLockedTargetId] = useState<string | null>(null);

  function openKnowledgePoint(targetId: string): void {
    if (lockedTargetId !== null) {
      return;
    }
    setLockedTargetId(targetId);
    onKnowledgePointOpen(targetId);
  }

  if (detail === undefined) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
        <main className="paper-canvas service-state-page" id="main-content">
          <header className="page-header compact">
            <div>
              <h1>章节详情</h1>
              <p>{course.currentChapter}</p>
            </div>
            <span className="page-header-rule" aria-hidden="true" />
          </header>
          <MissingChapterState subjectDetailUrl={subjectDetailUrl} />
        </main>
      </div>
    );
  }

  if (
    (detail.status !== "NORMAL" && detail.status !== "LONG_CONTENT") ||
    detail.knowledgePoints.length === 0 ||
    detail.flowSteps.length === 0
  ) {
    const status = detail.knowledgePoints.length === 0 || detail.flowSteps.length === 0
      ? "EMPTY_CHAPTER"
      : detail.status;
    return (
      <div className="app-shell chapter-detail-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
        <ChapterMobileMenu overviewUrl={overviewUrl} />
        <main className="paper-canvas chapter-detail-canvas" id="main-content">
          <ChapterDetailPageHeader
            dateFootnote={dateFootnote}
            dateTime={dateTime}
            detail={detail}
            demoActive={demoActive}
            overviewUrl={overviewUrl}
            subjectDetailUrl={subjectDetailUrl}
          />
          <ServiceStateNotice overviewUrl={subjectDetailUrl} status={status} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell chapter-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
      <ChapterMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas chapter-detail-canvas" id="main-content">
        <ChapterDetailPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          detail={detail}
          demoActive={demoActive}
          overviewUrl={overviewUrl}
          subjectDetailUrl={subjectDetailUrl}
        />

        <div className="content-grid chapter-detail-grid">
          <article className="main-column chapter-detail-main" aria-label="章节详情">
            <ChapterHero
              detail={detail}
              lockedTargetId={lockedTargetId}
              onKnowledgePointOpen={openKnowledgePoint}
              onTextbookOpen={onTextbookOpen}
            />

            <div className="chapter-two-column">
              <ChapterObjective goals={detail.goals} />
              <DefinitionList rows={detail.coreKnowledgeRows} title="核心知识点" />
            </div>

            <ChapterFlow
              lockedTargetId={lockedTargetId}
              onKnowledgePointOpen={openKnowledgePoint}
              steps={detail.flowSteps}
            />
            <KnowledgePointSequence
              lockedTargetId={lockedTargetId}
              onKnowledgePointOpen={openKnowledgePoint}
              points={detail.knowledgePoints}
            />
            <DefinitionList rows={detail.basisRows} title="内容依据" />
            <p className="chapter-source-boundary">{detail.sourceBoundary}</p>
          </article>

          <ChapterDetailRightRail detail={detail} onTutorOpen={onTutorOpen} />
          <ChapterRailCompact detail={detail} onTutorOpen={onTutorOpen} />
        </div>
      </main>
    </div>
  );
}

export interface ChapterDetailServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function ChapterDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: ChapterDetailServiceUnavailableProps) {
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
          description="当前没有真实章节详情服务端文档；不会把开发 Fixture、通用映射或未确认知识点伪装成已确认章节。"
          title="章节详情服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
