import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  SubjectCode,
  WrongBookDocument,
  WrongBookFilter,
  WrongBookItemStatus,
  WrongBookRecord,
  WrongBookSort,
  WrongBookSubjectFilter,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const filterOrder: readonly WrongBookFilter[] = ["ALL", "PENDING_CORRECTION", "PENDING_REVIEW", "RECOVERED"];

const filterLabels: Record<WrongBookFilter, string> = {
  ALL: "全部",
  PENDING_CORRECTION: "待订正",
  PENDING_REVIEW: "待复习",
  RECOVERED: "已恢复",
};

const filterQueryValues: Record<WrongBookFilter, string> = {
  ALL: "all",
  PENDING_CORRECTION: "pending-correction",
  PENDING_REVIEW: "pending-review",
  RECOVERED: "recovered",
};

const sortQueryValues: Record<WrongBookSort, string> = {
  NEXT_ACTION: "next-action",
  NEWEST: "newest",
  SUBJECT: "subject",
};

const statusCopy: Record<WrongBookItemStatus, { readonly className: string; readonly accessibleLabel: string }> = {
  PENDING_CORRECTION: {
    className: "is-pending-correction",
    accessibleLabel: "待订正，需要重新独立作答并说明错因",
  },
  PENDING_REVIEW: {
    className: "is-pending-review",
    accessibleLabel: "待复习，到期后不显示旧答案",
  },
  RECOVERED: {
    className: "is-recovered",
    accessibleLabel: "已恢复，仅代表本条错题完成一次有效恢复",
  },
  EVIDENCE_MISSING: {
    className: "is-evidence-missing",
    accessibleLabel: "证据待补充，不能标记为已恢复",
  },
};

function parseFilter(value: string | null): WrongBookFilter {
  if (value === filterQueryValues.PENDING_CORRECTION) {
    return "PENDING_CORRECTION";
  }
  if (value === filterQueryValues.PENDING_REVIEW) {
    return "PENDING_REVIEW";
  }
  if (value === filterQueryValues.RECOVERED) {
    return "RECOVERED";
  }
  return "ALL";
}

function parseSort(value: string | null): WrongBookSort {
  if (value === sortQueryValues.NEWEST) {
    return "NEWEST";
  }
  if (value === sortQueryValues.SUBJECT) {
    return "SUBJECT";
  }
  return "NEXT_ACTION";
}

function parseSubjectFilter(value: string | null): WrongBookSubjectFilter {
  if (
    value === "CHINESE" ||
    value === "MATH" ||
    value === "ENGLISH" ||
    value === "MORALITY" ||
    value === "HISTORY" ||
    value === "PHYSICS" ||
    value === "CHEMISTRY"
  ) {
    return value;
  }
  return "ALL_SUBJECTS";
}

function subjectCodeFromLabel(label: string): SubjectCode | null {
  if (label === "数学") {
    return "MATH";
  }
  if (label === "英语") {
    return "ENGLISH";
  }
  if (label === "语文") {
    return "CHINESE";
  }
  if (label === "历史") {
    return "HISTORY";
  }
  if (label === "道德与法治") {
    return "MORALITY";
  }
  if (label === "物理") {
    return "PHYSICS";
  }
  if (label === "化学") {
    return "CHEMISTRY";
  }
  return null;
}

function isDisplayableWrongBook(document: WrongBookDocument): boolean {
  return document.status === "WITH_RECORDS" ||
    document.status === "PARTIAL_EVIDENCE_MISSING" ||
    document.status === "OFFLINE_READONLY" ||
    document.status === "LOADING_MORE" ||
    document.status === "LOAD_MORE_FAILED" ||
    document.status === "FILTER_EMPTY";
}

function recordMatchesFilter(record: WrongBookRecord, filter: WrongBookFilter): boolean {
  return filter === "ALL" ||
    (filter === "PENDING_CORRECTION" && record.status === "PENDING_CORRECTION") ||
    (filter === "PENDING_REVIEW" && record.status === "PENDING_REVIEW") ||
    (filter === "RECOVERED" && record.status === "RECOVERED");
}

function recordMatchesSubject(record: WrongBookRecord, subjectFilter: WrongBookSubjectFilter): boolean {
  if (subjectFilter === "ALL_SUBJECTS") {
    return true;
  }
  return subjectCodeFromLabel(record.subjectLabel) === subjectFilter;
}

function recordServiceOrder(record: WrongBookRecord): number {
  const parsed = Number.parseInt(record.numberLabel, 10);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function compareByServiceOrder(left: WrongBookRecord, right: WrongBookRecord): number {
  const delta = recordServiceOrder(left) - recordServiceOrder(right);
  return delta === 0 ? left.title.localeCompare(right.title, "zh-Hans-CN") : delta;
}

function sortRecords(records: readonly WrongBookRecord[], sort: WrongBookSort): readonly WrongBookRecord[] {
  const copy = [...records];
  if (sort === "SUBJECT") {
    return copy.sort((left, right) => {
      const subjectDelta = left.subjectLabel.localeCompare(right.subjectLabel, "zh-Hans-CN");
      return subjectDelta === 0 ? compareByServiceOrder(left, right) : subjectDelta;
    });
  }
  return copy.sort(compareByServiceOrder);
}

function WrongBookMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="wrong-book-mobile-menu">
      <summary aria-label="打开移动端错题本导航">
        <span>
          <strong>清朗学习</strong>
          <small>错题复习</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端错题复习功能">
        <Link to="/student/today">今日学习</Link>
        <Link to={overviewUrl}>课程与资料</Link>
        <span aria-current="page">错题本</span>
        <span>错题详情 · 按顺序实现</span>
      </nav>
    </details>
  );
}

function WrongBookDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["wrong-book-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WrongBookSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="wrong-book-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function WrongBookHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: WrongBookDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-22" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  return (
    <header className="page-header wrong-book-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb wrong-book-breadcrumb">
          {document.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="wrong-book-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date wrong-book-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small>{document.updatedAtLabel}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function WrongBookFilterTabs({
  activeFilter,
  document,
  onFilterChange,
}: {
  readonly activeFilter: WrongBookFilter;
  readonly document: WrongBookDocument;
  readonly onFilterChange: (filter: WrongBookFilter) => void;
}) {
  return (
    <div aria-label="错题状态筛选" className="wrong-book-filter-tabs" role="tablist">
      {filterOrder.map((filter) => {
        const selected = filter === activeFilter;
        return (
          <button
            aria-selected={selected}
            className={selected ? "is-active" : undefined}
            key={filter}
            onClick={() => { onFilterChange(filter); }}
            role="tab"
            type="button"
          >
            {filterLabels[filter]} <span>{document.filterCounts[filter]}</span>
          </button>
        );
      })}
    </div>
  );
}

function WrongBookControls({
  document,
  onSortChange,
  onSubjectChange,
  sort,
  subjectFilter,
}: {
  readonly document: WrongBookDocument;
  readonly onSortChange: (sort: WrongBookSort) => void;
  readonly onSubjectChange: (subject: WrongBookSubjectFilter) => void;
  readonly sort: WrongBookSort;
  readonly subjectFilter: WrongBookSubjectFilter;
}) {
  return (
    <div className="wrong-book-controls" aria-label="错题本次级筛选">
      <label>
        <span>科目</span>
        <select
          onChange={(event) => { onSubjectChange(parseSubjectFilter(event.currentTarget.value)); }}
          value={subjectFilter}
        >
          {document.subjectOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <span aria-hidden="true" />
      <label>
        <span>排序</span>
        <select
          onChange={(event) => { onSortChange(parseSort(event.currentTarget.value)); }}
          value={sort}
        >
          {document.sortOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function WrongBookSummary({
  activeFilter,
  document,
  onFilterChange,
}: {
  readonly activeFilter: WrongBookFilter;
  readonly document: WrongBookDocument;
  readonly onFilterChange: (filter: WrongBookFilter) => void;
}) {
  return (
    <section className="wrong-book-summary" aria-labelledby="wrong-book-summary-title">
      <WrongBookSectionTitle id="wrong-book-summary-title" title="需要处理" />
      <div className="wrong-book-summary-layout">
        <div className="wrong-book-total" aria-label={`${document.totalValue} ${document.totalCaption}`}>
          <strong>{document.totalValue}</strong>
          <span>{document.totalCaption}</span>
        </div>
        <WrongBookFilterTabs activeFilter={activeFilter} document={document} onFilterChange={onFilterChange} />
      </div>
    </section>
  );
}

function WrongBookRecordRow({
  onOpenDetail,
  record,
}: {
  readonly onOpenDetail: (record: WrongBookRecord) => void;
  readonly record: WrongBookRecord;
}) {
  const status = statusCopy[record.status];
  return (
    <li
      aria-label={`${record.numberLabel}，${record.title}，${status.accessibleLabel}，下一行动 ${record.nextActionLabel}`}
      className="wrong-book-row"
    >
      <span className="wrong-book-row-number">{record.numberLabel}</span>
      <div className="wrong-book-row-title">
        {record.markerLabel === undefined ? null : <span>{record.markerLabel}</span>}
        <h3>{record.title}</h3>
        <p>{record.subjectLabel} · {record.scopeLabel}</p>
      </div>
      <div className="wrong-book-row-evidence">
        <p>{record.summary}</p>
        <small>{record.sourceLabel}</small>
      </div>
      <div className="wrong-book-row-action">
        <strong className={status.className}>{record.statusLabel}</strong>
        <small>{record.timeLabel}</small>
        <button
          className="text-button wrong-book-detail-button"
          disabled={record.wrongItemId === null}
          onClick={() => { onOpenDetail(record); }}
          type="button"
        >
          {record.detailActionLabel}
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </li>
  );
}

function WrongBookList({
  records,
  onOpenDetail,
}: {
  readonly records: readonly WrongBookRecord[];
  readonly onOpenDetail: (record: WrongBookRecord) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="wrong-book-empty" role="status">
        <h3>当前筛选无结果</h3>
        <p>其他状态计数保持不变；清除筛选后继续查看服务端返回的错题摘要。</p>
      </div>
    );
  }
  return (
    <ol className="wrong-book-list">
      {records.map((record) => (
        <WrongBookRecordRow key={record.id} onOpenDetail={onOpenDetail} record={record} />
      ))}
    </ol>
  );
}

function WrongBookRightRail({
  document,
  onStartFirst,
}: {
  readonly document: WrongBookDocument;
  readonly onStartFirst: () => void;
}) {
  return (
    <aside className="wrong-book-rail" aria-label="错题本辅助信息">
      <section className="wrong-book-rail-section" aria-labelledby="wrong-book-today-title">
        <WrongBookSectionTitle id="wrong-book-today-title" title="今日处理" />
        <WrongBookDefinitionList rows={document.todayRows} />
        <button className="text-button wrong-book-start-button" onClick={onStartFirst} type="button">
          {document.startActionLabel}
          <Icon name="chevronRight" size={17} />
        </button>
      </section>
      <section className="wrong-book-rail-section" aria-labelledby="wrong-book-status-title">
        <WrongBookSectionTitle id="wrong-book-status-title" title="状态说明" />
        <WrongBookDefinitionList rows={document.statusRows} />
      </section>
      <section className="wrong-book-rail-section" aria-labelledby="wrong-book-evidence-title">
        <WrongBookSectionTitle id="wrong-book-evidence-title" title="证据概况" />
        <WrongBookDefinitionList rows={document.evidenceRows} />
        <p className="wrong-book-rail-note">每条记录进入独立错题详情。</p>
      </section>
      <section className="wrong-book-rail-section" aria-labelledby="wrong-book-privacy-title">
        <WrongBookSectionTitle id="wrong-book-privacy-title" title="服务与隐私" />
        <WrongBookDefinitionList rows={document.privacyRows} />
        <p className="wrong-book-service-code">{document.serviceCode}</p>
      </section>
    </aside>
  );
}

function WrongBookRailCompact({
  document,
  onStartFirst,
}: {
  readonly document: WrongBookDocument;
  readonly onStartFirst: () => void;
}) {
  return (
    <details className="wrong-book-collapsible">
      <summary>今日处理、状态与隐私</summary>
      <div className="wrong-book-collapsible-content">
        <WrongBookRightRail document={document} onStartFirst={onStartFirst} />
      </div>
    </details>
  );
}

function WrongBookReady({
  currentUser,
  dateTime,
  demoActive,
  document,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: WrongBookDocument;
  readonly overviewUrl: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const activeFilter = parseFilter(searchParams.get("wrongStatus"));
  const subjectFilter = parseSubjectFilter(searchParams.get("wrongSubject"));
  const sort = parseSort(searchParams.get("wrongSort"));
  const visibleRecords = useMemo(() => {
    const filtered = document.records.filter((record) => recordMatchesFilter(record, activeFilter) && recordMatchesSubject(record, subjectFilter));
    return sortRecords(filtered, sort);
  }, [activeFilter, document.records, sort, subjectFilter]);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message !== null) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function updateQuery(mutator: (params: URLSearchParams) => void): void {
    const nextParams = new URLSearchParams(searchParams);
    mutator(nextParams);
    setSearchParams(nextParams, { replace: false });
  }

  function changeFilter(filter: WrongBookFilter): void {
    updateQuery((params) => {
      if (filter === "ALL") {
        params.delete("wrongStatus");
      } else {
        params.set("wrongStatus", filterQueryValues[filter]);
      }
    });
  }

  function changeSubject(subject: WrongBookSubjectFilter): void {
    updateQuery((params) => {
      if (subject === "ALL_SUBJECTS") {
        params.delete("wrongSubject");
      } else {
        params.set("wrongSubject", subject);
      }
    });
  }

  function changeSort(nextSort: WrongBookSort): void {
    updateQuery((params) => {
      if (nextSort === "NEXT_ACTION") {
        params.delete("wrongSort");
      } else {
        params.set("wrongSort", sortQueryValues[nextSort]);
      }
    });
  }

  function openDetail(record: WrongBookRecord): void {
    if (record.status === "PENDING_REVIEW" && record.reviewTargetId !== undefined && record.wrongItemId !== null) {
      const reviewTargetId = record.reviewTargetId;
      const wrongItemId = record.wrongItemId;
      updateQuery((params) => {
        params.set("view", "scheduled-review-attempt");
        params.set("target", reviewTargetId);
        params.set("wrongItem", wrongItemId);
        params.delete("wrongStatus");
        params.delete("wrongSubject");
        params.delete("wrongSort");
      });
      return;
    }
    if (record.detailTargetId !== undefined && record.wrongItemId !== null) {
      const detailTargetId = record.detailTargetId;
      const wrongItemId = record.wrongItemId;
      updateQuery((params) => {
        params.set("view", "wrong-item-detail");
        params.set("target", detailTargetId);
        params.set("wrongItem", wrongItemId);
        params.delete("wrongStatus");
        params.delete("wrongSubject");
        params.delete("wrongSort");
      });
      return;
    }
    const idLabel = record.wrongItemId ?? "未返回 wrongItemId";
    setMessage(`${document.detailUnavailableMessage} 当前记录：${record.title}；wrongItemId：${idLabel}。`);
  }

  function startFirst(): void {
    const firstProcessable = sortRecords(
      document.records.filter((record) => record.status === "PENDING_CORRECTION" || record.status === "PENDING_REVIEW"),
      "NEXT_ACTION",
    )[0];
    if (firstProcessable?.detailTargetId !== undefined && firstProcessable.wrongItemId !== null) {
      const detailTargetId = firstProcessable.detailTargetId;
      const wrongItemId = firstProcessable.wrongItemId;
      updateQuery((params) => {
        params.set("view", "wrong-item-detail");
        params.set("target", detailTargetId);
        params.set("wrongItem", wrongItemId);
        params.delete("wrongStatus");
        params.delete("wrongSubject");
        params.delete("wrongSort");
      });
      return;
    }
    const idLabel = firstProcessable?.wrongItemId ?? "没有可处理 wrongItemId";
    setMessage(`${document.startUnavailableMessage} 首条可处理 wrongItemId：${idLabel}。`);
  }

  return (
    <div className="app-shell wrong-book-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <WrongBookMobileMenu overviewUrl={overviewUrl} />
      <main className="paper-canvas wrong-book-canvas" id="main-content">
        <WrongBookHeader dateTime={dateTime} document={document} />
        <div className="wrong-book-grid">
          <article className="wrong-book-main" aria-label="错题本列表">
            <WrongBookSummary activeFilter={activeFilter} document={document} onFilterChange={changeFilter} />
            <WrongBookControls
              document={document}
              onSortChange={changeSort}
              onSubjectChange={changeSubject}
              sort={sort}
              subjectFilter={subjectFilter}
            />
            <WrongBookList onOpenDetail={openDetail} records={visibleRecords} />
            <footer className="wrong-book-footer">
              <p>{document.footerStatusLine}</p>
              <p>{document.recoveryBoundary}</p>
              <button className="text-button" disabled type="button">{document.noMoreLabel}</button>
            </footer>
            <p
              aria-live="polite"
              className="wrong-book-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="wrong-book-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="wrong-book-rail-divider" />
          <WrongBookRightRail document={document} onStartFirst={startFirst} />
          <WrongBookRailCompact document={document} onStartFirst={startFirst} />
        </div>
      </main>
    </div>
  );
}

function WrongBookUnavailableSurface({
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
    <div className="app-shell wrong-book-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page wrong-book-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="WRONG_BOOK_LIST_UNAVAILABLE：当前不会展示虚构错题列表、wrongItemId、订正状态、恢复计划、LearningEvidence、Mistake、RecoveryAttempt、Mastery、预算或云端笔记。"
          title="错题本服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function WrongBookLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell wrong-book-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="wrong-answer-review" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas wrong-book-canvas" id="main-content">
        <div aria-label="正在加载错题本" className="page-loading wrong-book-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface WrongBookRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function WrongBookRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
}: WrongBookRouteProps) {
  const document = useMemo(
    () => course.wrongBooks?.find((item) => item.targetId === targetId) ??
      (targetId === null ? course.wrongBooks?.[0] : undefined),
    [course.wrongBooks, targetId],
  );

  if (document === undefined) {
    return (
      <WrongBookServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-019 错题本文档；生产环境不会用开发 Fixture 补错题列表、wrongItemId 或恢复状态。"
        title="错题本"
      />
    );
  }

  if (document.status === "LOADING") {
    return <WrongBookLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (document.status === "FIRST_EMPTY") {
    return (
      <WrongBookServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前学生本人尚无服务端确认的错题记录；页面不会用庆祝动效或开发数据制造记录。"
        title="错题本"
      />
    );
  }

  if (!isDisplayableWrongBook(document)) {
    return (
      <WrongBookServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="错题本列表不可用；请在真实服务接入后重试，当前不会回退到 Fixture。"
        title="错题本"
      />
    );
  }

  return (
    <WrongBookReady
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
      overviewUrl={overviewUrl}
    />
  );
}

export function WrongBookServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的错题本服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "错题本",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <WrongBookUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
