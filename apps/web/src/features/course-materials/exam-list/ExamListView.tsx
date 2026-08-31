import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ExamAnalysisStatus,
  ExamListDocument,
  ExamListFilter,
  ExamListSort,
  ExamListStatus,
  ExamListSubjectFilter,
  ExamRecord,
  ExamRecordStatus,
  SubjectCode,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const filterOrder: readonly ExamListFilter[] = ["ALL", "COMPLETE", "INCOMPLETE", "ANALYSIS_PENDING"];

const filterLabels: Record<ExamListFilter, string> = {
  ALL: "全部",
  COMPLETE: "记录完整",
  INCOMPLETE: "待补录",
  ANALYSIS_PENDING: "分析处理中",
};

const filterQueryValues: Record<ExamListFilter, string> = {
  ALL: "all",
  COMPLETE: "complete",
  INCOMPLETE: "incomplete",
  ANALYSIS_PENDING: "analysis-pending",
};

const sortQueryValues: Record<ExamListSort, string> = {
  EXAM_DATE_DESC: "exam-date-desc",
  EXAM_DATE_ASC: "exam-date-asc",
  SUBJECT: "subject",
};

const statusCopy: Record<ExamRecordStatus, { readonly className: string; readonly accessibleLabel: string }> = {
  COMPLETE: {
    className: "is-complete",
    accessibleLabel: "记录完整，分数和失分项均已确认",
  },
  INCOMPLETE: {
    className: "is-incomplete",
    accessibleLabel: "待补录，必要失分项尚未完整",
  },
  ANALYSIS_PENDING: {
    className: "is-analysis-pending",
    accessibleLabel: "分析生成中，已确认事实仍可查看",
  },
};

const analysisCopy: Record<ExamAnalysisStatus, { readonly className: string; readonly accessibleLabel: string }> = {
  AVAILABLE: {
    className: "is-analysis-available",
    accessibleLabel: "分析可查看",
  },
  UNAVAILABLE: {
    className: "is-analysis-unavailable",
    accessibleLabel: "分析不可用，等待必要事实完整",
  },
  PENDING: {
    className: "is-analysis-pending",
    accessibleLabel: "分析正在生成",
  },
  FAILED: {
    className: "is-analysis-failed",
    accessibleLabel: "分析生成失败，记录仍可查看",
  },
};

const displayableStatuses: readonly ExamListStatus[] = [
  "WITH_RECORDS",
  "FILTER_EMPTY",
  "ENTRY_INCOMPLETE",
  "ANALYSIS_PENDING",
  "ANALYSIS_FAILED",
  "OFFLINE_READONLY",
  "LOADING_MORE",
  "LOAD_MORE_FAILED",
];

function parseFilter(value: string | null): ExamListFilter {
  if (value === filterQueryValues.COMPLETE) {
    return "COMPLETE";
  }
  if (value === filterQueryValues.INCOMPLETE) {
    return "INCOMPLETE";
  }
  if (value === filterQueryValues.ANALYSIS_PENDING) {
    return "ANALYSIS_PENDING";
  }
  return "ALL";
}

function parseSort(value: string | null): ExamListSort {
  if (value === sortQueryValues.EXAM_DATE_ASC) {
    return "EXAM_DATE_ASC";
  }
  if (value === sortQueryValues.SUBJECT) {
    return "SUBJECT";
  }
  return "EXAM_DATE_DESC";
}

function parseSubjectFilter(value: string | null): ExamListSubjectFilter {
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

function examOrder(record: ExamRecord): number {
  const parsed = Number.parseInt(record.numberLabel, 10);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function compareByServiceOrder(left: ExamRecord, right: ExamRecord): number {
  const delta = examOrder(left) - examOrder(right);
  return delta === 0 ? left.title.localeCompare(right.title, "zh-Hans-CN") : delta;
}

function recordMatchesFilter(record: ExamRecord, filter: ExamListFilter): boolean {
  return filter === "ALL" ||
    (filter === "COMPLETE" && record.status === "COMPLETE") ||
    (filter === "INCOMPLETE" && record.status === "INCOMPLETE") ||
    (filter === "ANALYSIS_PENDING" && record.status === "ANALYSIS_PENDING");
}

function recordMatchesSubject(record: ExamRecord, subjectFilter: ExamListSubjectFilter): boolean {
  if (subjectFilter === "ALL_SUBJECTS") {
    return true;
  }
  return subjectCodeFromLabel(record.subjectLabel) === subjectFilter;
}

function sortRecords(records: readonly ExamRecord[], sort: ExamListSort): readonly ExamRecord[] {
  const copy = [...records];
  if (sort === "SUBJECT") {
    return copy.sort((left, right) => {
      const subjectDelta = left.subjectLabel.localeCompare(right.subjectLabel, "zh-Hans-CN");
      return subjectDelta === 0 ? compareByServiceOrder(left, right) : subjectDelta;
    });
  }
  if (sort === "EXAM_DATE_ASC") {
    return copy.sort((left, right) => left.dateLabel.localeCompare(right.dateLabel, "zh-Hans-CN"));
  }
  return copy.sort(compareByServiceOrder);
}

function isDisplayableExamList(document: ExamListDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function unavailableCopy(status: ExamListStatus): { readonly title: string; readonly subtitle: string } {
  if (status === "LOADING") {
    return {
      title: "考试记录",
      subtitle: "正在读取考试记录；加载时不会闪现旧账号考试、示例分数或分析内容。",
    };
  }
  if (status === "FIRST_EMPTY") {
    return {
      title: "考试记录",
      subtitle: "当前学生本人尚无考试记录；只能手工新建，页面不会用开发数据制造考试事实。",
    };
  }
  if (status === "SESSION_EXPIRED") {
    return {
      title: "考试记录",
      subtitle: "学生身份需要刷新；失败时返回安全入口，不展示缓存外考试记录。",
    };
  }
  if (status === "DENIED_AS_NOT_FOUND") {
    return {
      title: "考试记录不可用",
      subtitle: "当前考试列表不在学生 OWN 范围内；无权与不存在统一不泄露。",
    };
  }
  return {
    title: "考试记录",
    subtitle: "考试列表服务不可用；当前不会回退到 Fixture、不会补造分数、examId、失分项或分析。",
  };
}

function ExamListDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["exam-list-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExamListSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="exam-list-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ExamListMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="exam-list-mobile-menu">
      <summary aria-label="打开移动端考试记录导航">
        <span>
          <strong>清朗学习</strong>
          <small>考试与评估</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端考试与评估功能">
        <Link to="/student/today">今日学习</Link>
        <Link to={overviewUrl}>课程与资料</Link>
        <span aria-current="page">考试记录</span>
        <span>考试录入 · 按顺序实现</span>
      </nav>
    </details>
  );
}

function ExamListHeader({
  dateTime,
  document,
  onCreate,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: ExamListDocument;
  readonly onCreate: () => void;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = "记录已更新 · ";
  const updatedDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;
  return (
    <header className="page-header exam-list-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb exam-list-breadcrumb">
          {document.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="exam-list-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date exam-list-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>记录已更新</span> · {updatedDetail}</small>
      </div>
      <button className="secondary-button exam-list-new-button" onClick={onCreate} type="button">
        <span aria-hidden="true">＋</span>
        {document.newActionLabel}
      </button>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ExamListFilterTabs({
  activeFilter,
  document,
  onFilterChange,
}: {
  readonly activeFilter: ExamListFilter;
  readonly document: ExamListDocument;
  readonly onFilterChange: (filter: ExamListFilter) => void;
}) {
  return (
    <div aria-label="考试记录状态筛选" className="exam-list-filter-tabs" role="tablist">
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

function ExamListControls({
  document,
  onSortChange,
  onSubjectChange,
  sort,
  subjectFilter,
}: {
  readonly document: ExamListDocument;
  readonly onSortChange: (sort: ExamListSort) => void;
  readonly onSubjectChange: (subject: ExamListSubjectFilter) => void;
  readonly sort: ExamListSort;
  readonly subjectFilter: ExamListSubjectFilter;
}) {
  return (
    <div className="exam-list-controls" aria-label="考试记录次级筛选">
      <label>
        <span>科目</span>
        <select
          aria-label="全部科目"
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
          aria-label="考试排序"
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

function ExamListSummary({
  activeFilter,
  document,
  onFilterChange,
}: {
  readonly activeFilter: ExamListFilter;
  readonly document: ExamListDocument;
  readonly onFilterChange: (filter: ExamListFilter) => void;
}) {
  return (
    <section className="exam-list-summary" aria-labelledby="exam-list-summary-title">
      <ExamListSectionTitle id="exam-list-summary-title" title="我的考试" />
      <div className="exam-list-summary-layout">
        <div className="exam-list-total" aria-label={`${document.totalValue} ${document.totalCaption}`}>
          <strong>{document.totalValue}</strong>
          <span>{document.totalCaption}</span>
        </div>
        <ExamListFilterTabs activeFilter={activeFilter} document={document} onFilterChange={onFilterChange} />
      </div>
    </section>
  );
}

function ExamRecordRow({
  onOpen,
  record,
}: {
  readonly onOpen: (record: ExamRecord) => void;
  readonly record: ExamRecord;
}) {
  const status = statusCopy[record.status];
  const analysis = analysisCopy[record.analysisStatus];
  const subjectLine = `${record.subjectLabel} · ${record.typeLabel}`;
  return (
    <li
      aria-label={`${record.numberLabel}，${record.title}，${subjectLine}，${record.dateLabel}，${record.rawScoreLabel}，${status.accessibleLabel}，${analysis.accessibleLabel}`}
      className="exam-list-row"
    >
      <div className="exam-list-row-index">
        <span>{record.numberLabel}</span>
        <strong className={status.className}>{record.statusLabel}</strong>
      </div>
      <div className="exam-list-row-title">
        <h3>{record.title}</h3>
        <p>{subjectLine}</p>
        <small>{record.dateLabel}</small>
      </div>
      <div className="exam-list-row-score" aria-label={`${record.rawScoreLabel}，${record.scoreSourceLabel}`}>
        <strong>{record.rawScoreLabel}</strong>
        <span>{record.scoreSourceLabel}</span>
      </div>
      <div className="exam-list-row-loss">
        <strong>{record.lossLabel}</strong>
      </div>
      <div className="exam-list-row-evidence">
        <p>{record.lossItemsLabel}</p>
        {record.lossItemsDetailLabel === undefined ? null : <small>{record.lossItemsDetailLabel}</small>}
      </div>
      <div className="exam-list-row-analysis">
        <strong className={analysis.className}>{record.analysisLabel}</strong>
      </div>
      <div className="exam-list-row-action">
        <button className="text-button exam-list-action-button" onClick={() => { onOpen(record); }} type="button">
          {record.actionLabel}
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </li>
  );
}

function ExamRecordList({
  onOpen,
  records,
}: {
  readonly onOpen: (record: ExamRecord) => void;
  readonly records: readonly ExamRecord[];
}) {
  if (records.length === 0) {
    return (
      <div className="exam-list-empty" role="status">
        <h3>当前筛选无考试记录</h3>
        <p>其他聚合计数保持来自服务端；清除筛选后继续查看本人确认的考试事实。</p>
      </div>
    );
  }
  return (
    <section className="exam-list-table" aria-labelledby="exam-list-records-title">
      <h2 className="sr-only" id="exam-list-records-title">考试记录</h2>
      <div className="exam-list-table-head" aria-hidden="true">
        <span>考试</span>
        <span>本人确认量尺</span>
        <span>失分</span>
        <span>失分项与证据</span>
        <span>分析状态</span>
        <span>操作</span>
      </div>
      <ol className="exam-list-records" id="exam-list-records-title">
        {records.map((record) => <ExamRecordRow key={record.id} onOpen={onOpen} record={record} />)}
      </ol>
    </section>
  );
}

function ExamListRailSection({
  children,
  rows,
  title,
}: {
  readonly children?: ReactNode;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  return (
    <section className="exam-list-rail-section">
      <div className="exam-list-rail-title">
        <h2>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <ExamListDefinitionList rows={rows} />
      {children}
    </section>
  );
}

function ExamListRightRail({
  compact = false,
  document,
  onFocusEntry,
  showServiceCode,
}: {
  readonly compact?: boolean;
  readonly document: ExamListDocument;
  readonly onFocusEntry: () => void;
  readonly showServiceCode: boolean;
}) {
  return (
    <aside aria-label={compact ? "考试记录折叠辅助信息" : "考试记录辅助信息"} className="exam-list-rail">
      <ExamListRailSection rows={document.todayRows} title="今日关注">
        {document.focusExamId === null ? null : (
          <button className="text-button exam-list-focus-button" onClick={onFocusEntry} type="button">
            {document.focusActionLabel}
            <Icon name="chevronRight" size={17} />
          </button>
        )}
      </ExamListRailSection>
      <ExamListRailSection rows={document.inputScopeRows} title="录入范围" />
      <ExamListRailSection rows={document.analysisRuleRows} title="分析规则" />
      <ExamListRailSection rows={document.privacyRows} title="服务与隐私">
        {showServiceCode ? <p className="exam-list-service-code">{document.serviceCode}</p> : null}
      </ExamListRailSection>
    </aside>
  );
}

function ExamListRailCompact({
  document,
  onFocusEntry,
  showServiceCode,
}: {
  readonly document: ExamListDocument;
  readonly onFocusEntry: () => void;
  readonly showServiceCode: boolean;
}) {
  return (
    <details className="exam-list-collapsible">
      <summary>今日关注、录入范围与隐私</summary>
      <div className="exam-list-collapsible-content">
        <ExamListRightRail compact document={document} onFocusEntry={onFocusEntry} showServiceCode={showServiceCode} />
      </div>
    </details>
  );
}

function ExamListReady({
  currentUser,
  dateTime,
  demoActive,
  document,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: ExamListDocument;
  readonly overviewUrl: string;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const activeFilter = parseFilter(searchParams.get("examStatus"));
  const subjectFilter = parseSubjectFilter(searchParams.get("examSubject"));
  const sort = parseSort(searchParams.get("examSort"));
  const visibleRecords = useMemo(() => {
    const filtered = document.records.filter((record) => recordMatchesFilter(record, activeFilter) && recordMatchesSubject(record, subjectFilter));
    return sortRecords(filtered, sort);
  }, [activeFilter, document.records, sort, subjectFilter]);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;
  const showServiceCode = document.status === "LIST_UNAVAILABLE";

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

  function changeFilter(filter: ExamListFilter): void {
    updateQuery((params) => {
      if (filter === "ALL") {
        params.delete("examStatus");
      } else {
        params.set("examStatus", filterQueryValues[filter]);
      }
    });
  }

  function changeSubject(subject: ExamListSubjectFilter): void {
    updateQuery((params) => {
      if (subject === "ALL_SUBJECTS") {
        params.delete("examSubject");
      } else {
        params.set("examSubject", subject);
      }
    });
  }

  function changeSort(nextSort: ExamListSort): void {
    updateQuery((params) => {
      if (nextSort === "EXAM_DATE_DESC") {
        params.delete("examSort");
      } else {
        params.set("examSort", sortQueryValues[nextSort]);
      }
    });
  }

  function openExamEntry(targetId: string, examId: string | null): void {
    updateQuery((params) => {
      params.set("view", "exam-entry");
      params.set("target", targetId);
      if (examId === null) {
        params.delete("exam");
      } else {
        params.set("exam", examId);
      }
      params.delete("examStatus");
      params.delete("examSubject");
      params.delete("examSort");
    });
  }

  function openExamDetail(targetId: string, examId: string | null): void {
    updateQuery((params) => {
      params.set("view", "exam-detail");
      params.set("target", targetId);
      if (examId === null) {
        params.delete("exam");
      } else {
        params.set("exam", examId);
      }
      params.delete("examStatus");
      params.delete("examSubject");
      params.delete("examSort");
    });
  }

  function createExam(): void {
    if (document.newEntryTargetId.length === 0) {
      setMessage(document.newExamUnavailableMessage);
      return;
    }
    openExamEntry(document.newEntryTargetId, null);
  }

  function openRecord(record: ExamRecord): void {
    const examId = record.examId ?? "未返回 examId";
    if (record.status === "INCOMPLETE") {
      if (record.entryTargetId !== undefined) {
        openExamEntry(record.entryTargetId, record.examId);
        return;
      }
      setMessage(`${document.entryUnavailableMessage} 当前记录：${record.title}；examId：${examId}。`);
      return;
    }
    if (record.detailTargetId !== undefined) {
      openExamDetail(record.detailTargetId, record.examId);
      return;
    }
    setMessage(`${document.detailUnavailableMessage} 当前记录：${record.title}；examId：${examId}。`);
  }

  function focusEntry(): void {
    const focusRecord = document.records.find((record) => record.examId === document.focusExamId);
    if (focusRecord !== undefined) {
      openRecord(focusRecord);
      return;
    }
    const idLabel = document.focusExamId ?? "无待补录 examId";
    setMessage(`${document.entryUnavailableMessage} 服务端推荐记录：${idLabel}。`);
  }

  return (
    <div className="app-shell exam-list-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <ExamListMobileMenu overviewUrl={overviewUrl} />
      <main className="paper-canvas exam-list-canvas" id="main-content">
        <ExamListHeader dateTime={dateTime} document={document} onCreate={createExam} />
        <div className="exam-list-grid">
          <article className="exam-list-main" aria-label="考试记录列表">
            <ExamListSummary activeFilter={activeFilter} document={document} onFilterChange={changeFilter} />
            <ExamListControls
              document={document}
              onSortChange={changeSort}
              onSubjectChange={changeSubject}
              sort={sort}
              subjectFilter={subjectFilter}
            />
            <ExamRecordList onOpen={openRecord} records={visibleRecords} />
            <footer className="exam-list-footer">
              <p>{document.footerStatusLine}</p>
              <p>{document.factBoundary}</p>
              <button className="text-button" disabled type="button">{document.noMoreLabel}</button>
            </footer>
            <p
              aria-live="polite"
              className="exam-list-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="exam-list-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="exam-list-rail-divider" />
          <ExamListRightRail document={document} onFocusEntry={focusEntry} showServiceCode={showServiceCode} />
          <ExamListRailCompact document={document} onFocusEntry={focusEntry} showServiceCode={showServiceCode} />
        </div>
      </main>
    </div>
  );
}

function ExamListUnavailableSurface({
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
    <div className="app-shell exam-list-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page exam-list-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="EXAM_LIST_UNAVAILABLE：当前不会展示虚构考试列表、示例分数、examId、失分项、分析结果、排名、班级均分或云端笔记。"
          title="考试记录服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function ExamListLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell exam-list-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas exam-list-canvas" id="main-content">
        <div aria-label="正在加载考试记录" className="page-loading exam-list-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface ExamListRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function ExamListRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
}: ExamListRouteProps) {
  const document = useMemo(
    () => course.examLists?.find((item) => item.targetId === targetId) ??
      (targetId === null ? course.examLists?.[0] : undefined),
    [course.examLists, targetId],
  );

  if (document === undefined) {
    return (
      <ExamListServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-024 考试列表文档；生产环境不会用开发 Fixture 补考试、分数、examId 或分析状态。"
        title="考试记录"
      />
    );
  }

  if (document.status === "LOADING") {
    return <ExamListLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableExamList(document)) {
    const copy = unavailableCopy(document.status);
    return (
      <ExamListServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.subtitle}
        title={copy.title}
      />
    );
  }

  return (
    <ExamListReady
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
      overviewUrl={overviewUrl}
    />
  );
}

export function ExamListServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的考试列表服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "考试记录",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <ExamListUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
