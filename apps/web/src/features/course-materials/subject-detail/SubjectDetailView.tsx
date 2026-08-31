import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import type { IconName } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  MaterialType,
  SubjectChapterRow,
  SubjectDetail,
  SubjectEvidenceRow,
  SubjectRecentLearningRow,
  SubjectResourceRow,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

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

function SubjectDetailPageHeader({
  detail,
  dateFootnote,
  dateTime,
}: {
  readonly detail: SubjectDetail;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
}) {
  return (
    <header className="page-header subject-detail-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <a href="/student/learn">课程与资料</a>
          <span aria-hidden="true">/</span>
          <span>{detail.breadcrumbSubject}</span>
        </nav>
        <h1>{detail.title}</h1>
        <p>{detail.subtitle}</p>
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

function SubjectMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="subject-mobile-menu">
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
        <span>AI 辅导 · 未接入</span>
        <span>OCR 与证据 · 未接入</span>
        <span>错题复习 · 未接入</span>
      </nav>
    </details>
  );
}

function SubjectHero({
  detail,
  onChapterOpen,
  onTextbookOpen,
}: {
  readonly detail: SubjectDetail;
  readonly onChapterOpen: (chapter: SubjectChapterRow) => void;
  readonly onTextbookOpen: () => void;
}) {
  const currentChapter = detail.chapters.find((chapter) => chapter.status === "CURRENT") ?? detail.chapters[0];

  return (
    <section className="subject-hero" aria-labelledby="subject-current-chapter-title">
      <div className="subject-chapter-number" aria-hidden="true">{detail.chapterNumberLabel}</div>
      <div className="subject-hero-copy">
        <h2 id="subject-current-chapter-title">{detail.chapterTitle}</h2>
        <p className="subject-textbook-line">{detail.textbookLine}</p>
        <p className="subject-progress-copy">{detail.chapterProgressLabel}</p>
        <p className="subject-current-copy">{detail.currentLessonLabel}</p>
        <div
          aria-label={`本章进度 ${String(detail.progressPercent)}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={detail.progressPercent}
          className="subject-progress-track"
          role="progressbar"
        >
          <span style={{ width: `${String(detail.progressPercent)}%` }} />
          <i aria-hidden="true" className="subject-progress-dot" style={{ left: `${String(detail.progressPercent)}%` }} />
          <i aria-hidden="true" className="subject-progress-tick first" />
          <i aria-hidden="true" className="subject-progress-tick second" />
        </div>
        <div className="subject-action-row">
          <button
            className="primary-button"
            onClick={() => {
              if (currentChapter !== undefined) {
                onChapterOpen(currentChapter);
              }
            }}
            type="button"
          >
            <span>继续本章学习</span>
            <Icon name="arrowRight" size={18} />
          </button>
          <button className="text-link-button" onClick={onTextbookOpen} type="button">
            <span>查看教材</span>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}

function ChapterList({
  chapters,
  onChapterOpen,
}: {
  readonly chapters: readonly SubjectChapterRow[];
  readonly onChapterOpen: (chapter: SubjectChapterRow) => void;
}) {
  return (
    <section className="subject-section" aria-labelledby="subject-chapters-title">
      <div className="section-title">
        <h2 id="subject-chapters-title">章节目录</h2>
        <span aria-hidden="true" />
      </div>
      <ol className="subject-chapter-list">
        {chapters.map((chapter, index) => (
          <li className={`subject-chapter-item is-${chapter.status.toLowerCase()}`} key={chapter.id}>
            <button
              aria-current={chapter.status === "CURRENT" ? "step" : undefined}
              aria-label={`${chapter.ordinalLabel} ${chapter.title}，${chapter.summary}，${chapter.durationLabel}，${chapter.statusLabel}`}
              className="subject-chapter-row"
              onClick={() => { onChapterOpen(chapter); }}
              type="button"
            >
              <span className="subject-chapter-marker" aria-hidden="true">
                {chapter.status === "COMPLETED" ? <Icon name="check" size={15} /> : String(index + 1)}
              </span>
              <span className="subject-chapter-code">{chapter.ordinalLabel}</span>
              <strong>{chapter.title}</strong>
              <span className="subject-chapter-summary">{chapter.summary}</span>
              <span className="subject-chapter-duration">{chapter.durationLabel}</span>
              <span className="subject-chapter-status">{chapter.statusLabel}</span>
              <Icon className="subject-chapter-arrow" name="chevronRight" size={16} />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function GoalsList({ goals }: { readonly goals: readonly string[] }) {
  return (
    <section className="subject-section subject-goals" aria-labelledby="subject-goals-title">
      <div className="section-title">
        <h2 id="subject-goals-title">本章学习目标</h2>
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

function RailTitle({
  actionLabel,
  title,
}: {
  readonly actionLabel?: string;
  readonly title: string;
}) {
  return (
    <div className="subject-rail-title">
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

function ResourceRow({ resource }: { readonly resource: SubjectResourceRow }) {
  return (
    <div className="subject-rail-row">
      <Icon name={materialIcon(resource.materialType)} size={20} />
      <dt>{resource.label}</dt>
      <dd>{resource.value}</dd>
    </div>
  );
}

function RecentLearningRow({ recent }: { readonly recent: SubjectRecentLearningRow }) {
  return (
    <div className="subject-rail-row subject-recent-row">
      <Icon name={materialIcon(recent.materialType)} size={20} />
      <dt>{recent.label}</dt>
      <dd>{recent.happenedAtLabel}</dd>
    </div>
  );
}

function EvidenceRow({ evidence }: { readonly evidence: SubjectEvidenceRow }) {
  return (
    <div className="subject-rail-row">
      <Icon name={materialIcon(evidence.materialType)} size={20} />
      <dt>{evidence.label}</dt>
      <dd>{evidence.value}</dd>
    </div>
  );
}

function SubjectDetailRightRail({
  detail,
  onTutorOpen,
}: {
  readonly detail: SubjectDetail;
  readonly onTutorOpen: () => void;
}) {
  return (
    <aside className="right-rail subject-detail-rail" aria-label="数学学科辅助信息">
      <RailTitle actionLabel="查看全部资料" title="本章资料" />
      <dl className="subject-rail-list">
        {detail.resources.map((resource) => <ResourceRow key={resource.id} resource={resource} />)}
      </dl>

      <RailTitle actionLabel="查看全部" title="最近学习" />
      <dl className="subject-rail-list">
        {detail.recentLearning.map((recent) => <RecentLearningRow key={recent.id} recent={recent} />)}
      </dl>

      <RailTitle actionLabel="查看本章证据" title="学习证据" />
      <dl className="subject-rail-list">
        {detail.evidence.map((evidence) => <EvidenceRow evidence={evidence} key={evidence.id} />)}
      </dl>

      <section className="subject-ai-card" aria-labelledby="subject-ai-title">
        <h2 id="subject-ai-title">
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
    </aside>
  );
}

function SubjectDetailRailCompact({
  detail,
  onTutorOpen,
}: {
  readonly detail: SubjectDetail;
  readonly onTutorOpen: () => void;
}) {
  return (
    <details className="right-rail-collapsible subject-detail-collapsible">
      <summary>
        <span>本章资料与学习证据</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content subject-detail-collapsible-content">
        <SubjectDetailRightRail detail={detail} onTutorOpen={onTutorOpen} />
      </div>
    </details>
  );
}

function DetailMissingState({
  course,
  overviewUrl,
}: {
  readonly course: CourseSummary;
  readonly overviewUrl: string;
}) {
  const isGeneral = course.textbookStatus === "GENERAL_GUIDANCE";
  return (
    <div className="subject-detail-empty">
      <StatusPanel
        description={
          isGeneral
            ? "当前教材尚未由服务端确认。本页只显示通用学习指引，不生成章节目录、页码或掌握百分比。"
            : "当前课程已可见，但章节目录、资料和最近学习聚合服务尚未接入；页面不会用前端 Fixture 替代真实服务端结果。"
        }
        title={isGeneral ? "教材确认后才能展示学科详情" : "学科详情服务暂时不可用"}
      />
      <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
    </div>
  );
}

export interface SubjectDetailRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly onChapterOpen: (chapter: SubjectChapterRow) => void;
  readonly onTextbookOpen: () => void;
  readonly onTutorOpen: () => void;
}

export function SubjectDetailRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  onChapterOpen,
  onTextbookOpen,
  onTutorOpen,
  overviewUrl,
}: SubjectDetailRouteProps) {
  const detail = course.subjectDetail;

  if (detail === undefined) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
        <main className="paper-canvas service-state-page" id="main-content">
          <header className="page-header compact">
            <div>
              <h1>{course.subjectLabel}课程详情</h1>
              <p>{course.textbookLabel}</p>
            </div>
            <span className="page-header-rule" aria-hidden="true" />
          </header>
          <DetailMissingState course={course} overviewUrl={overviewUrl} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell subject-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
      <SubjectMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas subject-detail-canvas" id="main-content">
        <SubjectDetailPageHeader dateFootnote={dateFootnote} dateTime={dateTime} detail={detail} />

        <div className="content-grid subject-detail-grid">
          <section className="main-column subject-detail-main" aria-label="数学学科详情">
            <SubjectHero detail={detail} onChapterOpen={onChapterOpen} onTextbookOpen={onTextbookOpen} />
            <ChapterList chapters={detail.chapters} onChapterOpen={onChapterOpen} />
            <GoalsList goals={detail.goals} />
            <p className="subject-source-boundary">{detail.sourceBoundary}</p>
          </section>

          <SubjectDetailRightRail detail={detail} onTutorOpen={onTutorOpen} />
          <SubjectDetailRailCompact detail={detail} onTutorOpen={onTutorOpen} />
        </div>
      </main>
    </div>
  );
}

export interface SubjectDetailServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function SubjectDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: SubjectDetailServiceUnavailableProps) {
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
          description="当前只实现 STU-006 学科详情承载页；不会提前伪造教材详情、章节详情、AI 辅导会话或学习证据写入。"
          title="目标页面尚未接入"
        />
        <a className="secondary-button" href={overviewUrl}>返回数学课程</a>
      </main>
    </div>
  );
}
