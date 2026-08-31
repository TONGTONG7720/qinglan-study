import { useState } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  TextbookChapterRow,
  TextbookDetail,
  TextbookDetailStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<TextbookDetailStatus, { readonly title: string; readonly description: string }> = {
  CONFIRMED_TEXTBOOK: {
    title: "教材详情",
    description: "教材目录已由服务端确认。",
  },
  GENERIC_GUIDANCE: {
    title: "教材尚未确认",
    description: "当前只可展示通用学习指引；不会生成具体章节目录、页码范围或“已对齐”状态。",
  },
  PENDING_VERIFICATION: {
    title: "教材正在核验",
    description: "资料仍在处理，候选识别结果不能当作已确认目录；请等待服务端确认。",
  },
  RETURNED_MATERIALS: {
    title: "教材材料需补充",
    description: "已退回的材料不会展示为可用教材；学生端只保留返回课程的路径。",
  },
  CATALOG_UNAVAILABLE: {
    title: "目录暂时不可用",
    description: "教材可以识别，但目录页码未由服务端返回；页面不猜测章节范围。",
  },
  OFFLINE_READONLY: {
    title: "离线只读",
    description: "当前只能查看已缓存的只读信息，不能提交教材修改或学习证据。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后再读取本人教材详情。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "教材范围不可用",
    description: "当前教材不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function TextbookMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="textbook-mobile-menu">
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
        <span>教材核验 · 只读</span>
        <span>章节详情 · 未接入</span>
        <span>AI 辅导 · 未接入</span>
      </nav>
    </details>
  );
}

function TextbookDetailPageHeader({
  dateFootnote,
  dateTime,
  detail,
  demoActive,
  overviewUrl,
  subjectDetailUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly detail: TextbookDetail;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subjectDetailUrl: string;
}) {
  return (
    <header className="page-header textbook-detail-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <a href={overviewUrl}>课程与资料</a>
          <span aria-hidden="true">/</span>
          <a href={subjectDetailUrl}>{detail.subjectLabel}</a>
          <span aria-hidden="true">/</span>
          <span>教材</span>
        </nav>
        <h1>{detail.title}</h1>
        <div className="textbook-header-meta">
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

function VerificationStatus({ detail }: { readonly detail: TextbookDetail }) {
  return (
    <div className="textbook-verification-status" aria-label={`教材核验状态：${detail.confirmationLabel}`}>
      <span>{detail.confirmationLabel}</span>
      <p>{detail.sourceLabel}</p>
      <time>{detail.confirmedAtLabel}</time>
    </div>
  );
}

function ChapterCatalogRow({
  chapter,
  disabled,
  onChapterOpen,
}: {
  readonly chapter: TextbookChapterRow;
  readonly disabled: boolean;
  readonly onChapterOpen: (chapterId: string) => void;
}) {
  return (
    <li className={`textbook-catalog-item is-${chapter.status.toLowerCase()}`}>
      <button
        aria-current={chapter.status === "CURRENT" ? "step" : undefined}
        aria-label={`第${chapter.ordinalLabel}章 ${chapter.title}，${chapter.scope}，${chapter.pageRange}，${chapter.statusLabel}`}
        className="textbook-catalog-row"
        disabled={disabled}
        onClick={() => { onChapterOpen(chapter.chapterId); }}
        type="button"
      >
        <span className="textbook-catalog-number">{chapter.ordinalLabel}</span>
        <strong>{chapter.title}</strong>
        <span className="textbook-catalog-scope">{chapter.scope}</span>
        <span className="textbook-catalog-pages">{chapter.pageRange}</span>
        <span className="textbook-catalog-status">{chapter.statusLabel}</span>
        <Icon className="textbook-catalog-arrow" name="chevronRight" size={16} />
      </button>
    </li>
  );
}

function ChapterCatalog({
  chapters,
  lockedChapterId,
  onChapterOpen,
}: {
  readonly chapters: readonly TextbookChapterRow[];
  readonly lockedChapterId: string | null;
  readonly onChapterOpen: (chapterId: string) => void;
}) {
  return (
    <section className="textbook-section" aria-labelledby="textbook-catalog-title">
      <div className="section-title">
        <h2 id="textbook-catalog-title">教材目录</h2>
        <span aria-hidden="true" />
      </div>
      <ol className="textbook-catalog-list">
        {chapters.map((chapter) => (
          <ChapterCatalogRow
            chapter={chapter}
            disabled={lockedChapterId !== null}
            key={chapter.id}
            onChapterOpen={onChapterOpen}
          />
        ))}
      </ol>
    </section>
  );
}

function CurrentChapterSummary({
  detail,
  lockedChapterId,
  onChapterOpen,
}: {
  readonly detail: TextbookDetail;
  readonly lockedChapterId: string | null;
  readonly onChapterOpen: (chapterId: string) => void;
}) {
  return (
    <section className="textbook-current-summary" aria-labelledby="textbook-current-title">
      <div>
        <span>{detail.currentChapter.chapterLabel}</span>
        <h2 id="textbook-current-title">{detail.currentChapter.title}</h2>
        <p>{detail.currentChapter.scope}</p>
      </div>
      <dl>
        <div>
          <dt>页码范围</dt>
          <dd>{detail.currentChapter.pageRange}</dd>
        </div>
        <div>
          <dt>最近进度</dt>
          <dd>{detail.currentChapter.recentProgress}</dd>
        </div>
      </dl>
      <button
        className="primary-button"
        disabled={lockedChapterId !== null}
        onClick={() => { onChapterOpen(detail.currentChapter.chapterId); }}
        type="button"
      >
        <span>{detail.currentChapter.actionLabel}</span>
        <Icon name="arrowRight" size={18} />
      </button>
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
    <section className="textbook-rail-section" aria-labelledby={`textbook-${title}-title`}>
      <div className="subject-rail-title">
        <h2 id={`textbook-${title}-title`}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <dl className="textbook-definition-list">
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

function TextbookSourceDisclosure({ detail }: { readonly detail: TextbookDetail }) {
  return (
    <details className="textbook-source-disclosure">
      <summary>
        <span>核验说明</span>
        <Icon name="chevronRight" size={16} />
      </summary>
      <p>学生端只能读取服务端确认后的教材目录；候选识别、退回材料和待核验资料不会在此页显示为已对齐。</p>
      <p>{detail.sourceBoundary}</p>
    </details>
  );
}

function VersionSourcePanel({
  notice,
  rows,
}: {
  readonly notice: string | undefined;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <section className="textbook-version-panel" aria-labelledby="textbook-version-title">
      <div className="subject-rail-title">
        <h2 id="textbook-version-title">版本与来源</h2>
        <span aria-hidden="true" />
      </div>
      <dl className="textbook-version-list">
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {notice === undefined ? null : <p>{notice}</p>}
    </section>
  );
}

function TextbookDetailRightRail({ detail }: { readonly detail: TextbookDetail }) {
  return (
    <aside className="right-rail textbook-detail-rail" aria-label="教材详情辅助信息">
      <DefinitionList rows={detail.sourceRows} title="教材来源" />
      <DefinitionList rows={detail.verificationRows} title="核验状态" />
      <DefinitionList rows={detail.catalogRows} title="目录范围" />
      <DefinitionList rows={detail.serviceRows} title="服务与隐私" />
      <TextbookSourceDisclosure detail={detail} />
    </aside>
  );
}

function TextbookRailCompact({ detail }: { readonly detail: TextbookDetail }) {
  return (
    <details className="right-rail-collapsible textbook-detail-collapsible">
      <summary>
        <span>教材来源与核验状态</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content textbook-detail-collapsible-content">
        <TextbookDetailRightRail detail={detail} />
      </div>
    </details>
  );
}

function ServiceStateNotice({
  status,
  subjectDetailUrl,
}: {
  readonly status: TextbookDetailStatus;
  readonly subjectDetailUrl: string;
}) {
  const copy = serviceStateCopy[status];
  return (
    <div className="textbook-service-state">
      <StatusPanel description={copy.description} title={copy.title} />
      <a className="secondary-button" href={subjectDetailUrl}>返回数学课程</a>
    </div>
  );
}

function MissingTextbookState({ subjectDetailUrl }: { readonly subjectDetailUrl: string }) {
  return (
    <div className="textbook-service-state">
      <StatusPanel
        description="当前课程没有服务端教材详情文档；生产环境不会用开发 Fixture 补目录、页码或核验状态。"
        title="教材详情服务暂时不可用"
      />
      <a className="secondary-button" href={subjectDetailUrl}>返回数学课程</a>
    </div>
  );
}

function TextbookHero({
  detail,
}: {
  readonly detail: TextbookDetail;
}) {
  return (
    <section className="textbook-hero" aria-labelledby="textbook-hero-title">
      <div className="textbook-hero-primary">
        <div className="textbook-grade-anchor" aria-hidden="true">
          <div className="textbook-hero-number">{detail.heroNumberLabel}</div>
          <span>{detail.gradeLabel}</span>
        </div>
        <div className="textbook-hero-copy">
          <h2 id="textbook-hero-title">{detail.textbookLabel}</h2>
          <p>{detail.sourceLabel}</p>
          <VerificationStatus detail={detail} />
        </div>
      </div>
      <VersionSourcePanel notice={detail.sourceNotice} rows={detail.sourceRows} />
    </section>
  );
}

export interface TextbookDetailRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subjectDetailUrl: string;
  readonly onChapterOpen: (chapterId: string) => void;
}

export function TextbookDetailRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  onChapterOpen,
  overviewUrl,
  subjectDetailUrl,
}: TextbookDetailRouteProps) {
  const detail = course.textbookDetail;
  const [lockedChapterId, setLockedChapterId] = useState<string | null>(null);

  function openChapter(chapterId: string): void {
    if (lockedChapterId !== null) {
      return;
    }
    setLockedChapterId(chapterId);
    onChapterOpen(chapterId);
  }

  if (detail === undefined) {
    return (
      <div className="app-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
        <main className="paper-canvas service-state-page" id="main-content">
          <header className="page-header compact">
            <div>
              <h1>教材详情</h1>
              <p>{course.textbookLabel}</p>
            </div>
            <span className="page-header-rule" aria-hidden="true" />
          </header>
          <MissingTextbookState subjectDetailUrl={subjectDetailUrl} />
        </main>
      </div>
    );
  }

  if (detail.status !== "CONFIRMED_TEXTBOOK" || detail.chapters.length === 0) {
    const status = detail.chapters.length === 0 ? "CATALOG_UNAVAILABLE" : detail.status;
    return (
      <div className="app-shell textbook-detail-shell">
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
        <TextbookMobileMenu overviewUrl={overviewUrl} />
        <main className="paper-canvas textbook-detail-canvas" id="main-content">
          <TextbookDetailPageHeader
            dateFootnote={dateFootnote}
            dateTime={dateTime}
            detail={detail}
            demoActive={demoActive}
            overviewUrl={overviewUrl}
            subjectDetailUrl={subjectDetailUrl}
          />
          <ServiceStateNotice status={status} subjectDetailUrl={subjectDetailUrl} />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell textbook-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-learn" currentUser={currentUser} demoActive={demoActive} />
      <TextbookMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas textbook-detail-canvas" id="main-content">
        <TextbookDetailPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          detail={detail}
          demoActive={demoActive}
          overviewUrl={overviewUrl}
          subjectDetailUrl={subjectDetailUrl}
        />

        <div className="content-grid textbook-detail-grid">
          <section className="main-column textbook-detail-main" aria-label="教材详情">
            <TextbookHero detail={detail} />
            <div className="textbook-lower-grid">
              <ChapterCatalog chapters={detail.chapters} lockedChapterId={lockedChapterId} onChapterOpen={openChapter} />
              <CurrentChapterSummary detail={detail} lockedChapterId={lockedChapterId} onChapterOpen={openChapter} />
            </div>
            <p className="textbook-source-boundary">{detail.sourceBoundary}</p>
          </section>

          <TextbookDetailRightRail detail={detail} />
          <TextbookRailCompact detail={detail} />
        </div>
      </main>
    </div>
  );
}

export interface TextbookDetailServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function TextbookDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: TextbookDetailServiceUnavailableProps) {
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
          description="当前没有真实教材详情服务端文档；不会把候选识别、开发 Fixture 或未核验目录伪装成已确认教材。"
          title="教材详情服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
