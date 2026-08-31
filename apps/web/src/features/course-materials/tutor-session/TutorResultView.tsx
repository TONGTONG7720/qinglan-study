import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject, SyntheticEvent } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  TutorResult,
  TutorResultReportStatus,
  TutorResultStatus,
  TutorResultTimelineState,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const resultStateCopy: Record<TutorResultStatus, { readonly title: string; readonly description: string }> = {
  LOADING: {
    title: "辅导结果加载中",
    description: "保留页面骨架，等待服务端返回本次 tutorSessionId 的结果文档。",
  },
  COMPLETED_UNDERSTOOD: {
    title: "辅导结果",
    description: "本次提示辅导已经结束，但独立证据仍为 0。",
  },
  COMPLETED_NEEDS_PRACTICE: {
    title: "辅导结果",
    description: "理解检查尚需继续巩固，下一步仍应完成无提示独立练习。",
  },
  EVIDENCE_UNAVAILABLE: {
    title: "证据服务不可用",
    description: "当前无法确认过程记录或证据状态，不能把旧数据标成当前结果。",
  },
  RESULT_UNKNOWN: {
    title: "辅导结果未知",
    description: "会话存在但结果无法确认，不能在前端推断结论、错题或掌握证据。",
  },
  SESSION_EXPIRED_READONLY: {
    title: "历史辅导结果",
    description: "当前只读展示历史过程，不允许继续提交或创建新的学习证据。",
  },
  OFFLINE: {
    title: "离线只读",
    description: "保留已加载内容；联网前不能声称过程、报告或掌握证据已经保存。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "辅导结果不可用",
    description: "当前资源不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function isCompletedResult(status: TutorResultStatus): boolean {
  return status === "COMPLETED_UNDERSTOOD" || status === "COMPLETED_NEEDS_PRACTICE";
}

function TutorResultMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="tutor-mobile-menu tutor-result-mobile-menu">
      <summary aria-label="打开移动端辅导结果导航">
        <span>
          <strong>清朗学习</strong>
          <small>AI 辅导</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端辅导结果功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <span>提示辅导</span>
        <span aria-current="page">辅导结果</span>
      </nav>
    </details>
  );
}

function ResultDefinitionList({
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

function TutorResultHeader({
  dateTime,
  demoActive,
  detail,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: TutorResult;
}) {
  return (
    <header className="page-header tutor-header tutor-result-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
        </nav>
        <h1>{detail.title}</h1>
        <div className="tutor-header-meta">
          <p>{detail.subtitle}</p>
          {demoActive && detail.fixtureBadgeLabel !== undefined ? <span>{detail.fixtureBadgeLabel}</span> : null}
        </div>
      </div>
      <div className="page-date tutor-result-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}，${detail.completedAtLabel}`}>
        <strong>{dateTime.date}</strong>
        <small>{dateTime.weekdayChinese}</small>
        <small>{detail.completedAtLabel}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ResultSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="tutor-section-title tutor-result-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function TutorResultUnderstanding({ detail }: { readonly detail: TutorResult }) {
  const titleId = useId();
  return (
    <section className="tutor-result-understanding" aria-labelledby={titleId}>
      <ResultSectionTitle id={titleId} title="本次理解" />
      <div className="tutor-result-understanding-grid">
        <div className="tutor-result-metric" aria-label={`${detail.metricValue} ${detail.metricUnitLabel}`}>
          <strong>{detail.metricValue}</strong>
          <span>{detail.metricUnitLabel}</span>
        </div>
        <div className="tutor-result-conclusion-block">
          <p className="tutor-result-formula" aria-label={`公式：${detail.formula}`}>
            {detail.formula}
          </p>
          <ol className="tutor-result-conclusions" aria-label="本次理解结论">
            {detail.conclusions.map((row) => (
              <li key={row.id}>
                <span className="tutor-result-conclusion-title">
                  <span aria-hidden="true">{row.ordinalLabel}</span>
                  <strong>{row.title}</strong>
                </span>
                <span className="tutor-result-conclusion-status">{row.statusLabel}</span>
                <span className="tutor-result-conclusion-copy">{row.conclusion}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <p className="tutor-result-evidence-notice">
        <span aria-hidden="true" />
        {detail.evidenceBoundary}
      </p>
    </section>
  );
}

function timelineClassName(state: TutorResultTimelineState): string {
  return state === "COMPLETED"
    ? "is-complete"
    : state === "USED"
    ? "is-used"
    : state === "ERROR"
    ? "is-error"
    : "is-pending";
}

function timelineIconName(state: TutorResultTimelineState): "check" | "circleAlert" {
  return state === "PENDING" || state === "ERROR" ? "circleAlert" : "check";
}

function TutorResultTimeline({ detail }: { readonly detail: TutorResult }) {
  const titleId = useId();
  return (
    <section className="tutor-result-timeline-panel" aria-labelledby={titleId}>
      <ResultSectionTitle id={titleId} title={detail.timelineTitle} />
      <ol className="tutor-result-timeline" aria-label="本次提示式辅导过程">
        {detail.timelineItems.map((item) => (
          <li className={timelineClassName(item.state)} key={item.id}>
            <span className="tutor-result-timeline-mark" aria-hidden="true">
              <Icon name={timelineIconName(item.state)} size={15} />
            </span>
            <strong>{item.title}</strong>
            <span>{item.statusLabel}</span>
            <small>{item.description}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ReportDialog({
  detail,
  onClose,
  openerRef,
}: {
  readonly detail: TutorResult;
  readonly onClose: () => void;
  readonly openerRef: RefObject<HTMLButtonElement | null>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const typeId = useId();
  const noteId = useId();
  const [reportType, setReportType] = useState(detail.reportTypeOptions[0] ?? "结论与提示不一致");
  const [description, setDescription] = useState("");
  const [reportStatus, setReportStatus] = useState<TutorResultReportStatus>("REPORT_IDLE");
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);
  const canSubmit = description.trim().length > 0 && reportStatus !== "REPORT_SUBMITTING";

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  function closeAndReturnFocus(): void {
    onClose();
    window.setTimeout(() => {
      openerRef.current?.focus();
    }, 0);
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndReturnFocus();
    }
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setReportStatus("REPORT_FAILURE");
  }

  const statusCopy = reportStatus === "REPORT_FAILURE"
    ? detail.reportUnavailableMessage
    : reportStatus === "REPORT_SUBMITTING"
    ? "正在提交辅导问题报告……"
    : "提交前请只描述本次辅导问题，不要填写无关个人信息。";

  return (
    <div className="tutor-result-dialog-backdrop">
      <div
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="tutor-result-dialog"
        onKeyDown={handleDialogKeyDown}
        role="dialog"
      >
        <form onSubmit={handleSubmit}>
          <div className="tutor-result-dialog-head">
            <div>
              <h2 id={titleId}>报告辅导问题</h2>
              <p id={descriptionId}>报告只用于检查本次提示过程；当前不会创建真实服务端工单。</p>
            </div>
            <button aria-label="关闭报告问题" className="text-button" onClick={closeAndReturnFocus} type="button">
              <Icon name="close" size={18} />
            </button>
          </div>
          <label htmlFor={typeId}>问题类型</label>
          <select
            id={typeId}
            onChange={(event) => { setReportType(event.currentTarget.value); }}
            ref={firstFieldRef}
            value={reportType}
          >
            {detail.reportTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <label htmlFor={noteId}>补充说明</label>
          <textarea
            id={noteId}
            maxLength={240}
            onChange={(event) => { setDescription(event.currentTarget.value); }}
            placeholder={detail.reportDescriptionPlaceholder}
            value={description}
          />
          <div className="tutor-result-dialog-actions">
            <button className="secondary-button" onClick={closeAndReturnFocus} type="button">取消</button>
            <button className="primary-button" disabled={!canSubmit} type="submit">提交报告</button>
          </div>
          <p aria-live="polite" className="tutor-result-dialog-status">
            {statusCopy}
          </p>
        </form>
      </div>
    </div>
  );
}

function TutorResultNextActions({
  detail,
  knowledgePointUrl,
}: {
  readonly detail: TutorResult;
  readonly knowledgePointUrl: string;
}) {
  const titleId = useId();
  const analysisPanelId = useId();
  const analysisButtonRef = useRef<HTMLButtonElement | null>(null);
  const analysisPanelRef = useRef<HTMLDivElement | null>(null);
  const reportButtonRef = useRef<HTMLButtonElement | null>(null);
  const [practiceMessage, setPracticeMessage] = useState<string | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (analysisOpen) {
      analysisPanelRef.current?.focus();
    }
  }, [analysisOpen]);

  function closeAnalysis(): void {
    setAnalysisOpen(false);
    window.setTimeout(() => {
      analysisButtonRef.current?.focus();
    }, 0);
  }

  function handleAnalysisKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAnalysis();
    }
  }

  function handlePrimaryAction(): void {
    if (practiceMessage !== null) {
      return;
    }
    setPracticeMessage(detail.primaryUnavailableMessage);
  }

  function closeReport(): void {
    setReportOpen(false);
  }

  return (
    <section className="tutor-result-actions-panel" aria-labelledby={titleId}>
      <ResultSectionTitle id={titleId} title={detail.nextTitle} />
      <div className="tutor-result-actions-row">
        <button className="primary-button tutor-result-primary" onClick={handlePrimaryAction} type="button">
          <span>{detail.primaryActionLabel}</span>
          <Icon name="arrowRight" size={17} />
        </button>
        <a className="text-button" href={knowledgePointUrl}>{detail.returnKnowledgeLabel}</a>
        <button
          aria-controls={analysisPanelId}
          aria-expanded={analysisOpen}
          className="text-button"
          onClick={() => { setAnalysisOpen((current) => !current); }}
          ref={analysisButtonRef}
          type="button"
        >
          {detail.analysisLabel}
        </button>
        <button
          className="text-button tutor-result-report-trigger"
          onClick={() => { setReportOpen(true); }}
          ref={reportButtonRef}
          type="button"
        >
          {detail.reportLabel}
        </button>
      </div>
      <p className="tutor-result-next-copy">{detail.nextSupportCopy}</p>
      <p aria-live="polite" className="tutor-result-action-message">
        {practiceMessage}
      </p>
      {analysisOpen ? (
        <div
          className="tutor-result-analysis"
          id={analysisPanelId}
          onKeyDown={handleAnalysisKeyDown}
          ref={analysisPanelRef}
          tabIndex={-1}
        >
          <div>
            <h3>{detail.analysisTitle}</h3>
            <button className="text-button" onClick={closeAnalysis} type="button">收起解析</button>
          </div>
          {detail.analysisLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {reportOpen ? <ReportDialog detail={detail} onClose={closeReport} openerRef={reportButtonRef} /> : null}
    </section>
  );
}

function TutorResultRailSection({
  rows,
  title,
}: {
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `tutor-result-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className="tutor-rail-section tutor-result-rail-section" aria-labelledby={titleId}>
      <div className="tutor-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <ResultDefinitionList className="tutor-rail-list" rows={rows} />
    </section>
  );
}

function TutorResultRightRail({
  compact = false,
  detail,
}: {
  readonly compact?: boolean;
  readonly detail: TutorResult;
}) {
  return (
    <aside className="right-rail tutor-rail tutor-result-rail" aria-label={compact ? "辅导结果折叠辅助信息" : "辅导结果辅助信息"}>
      <TutorResultRailSection rows={detail.summaryRows} title="会话摘要" />
      <TutorResultRailSection rows={detail.basisRows} title="内容依据" />
      <TutorResultRailSection rows={detail.evidenceRows} title="证据状态" />
      <TutorResultRailSection rows={detail.privacyRows} title="服务与隐私" />
      <p className="tutor-rail-boundary">仅显示本次会话与当前学生的数据；家庭隔离由服务端权限强制执行。</p>
    </aside>
  );
}

function TutorResultRailCompact({ detail }: { readonly detail: TutorResult }) {
  return (
    <details className="right-rail-collapsible tutor-collapsible tutor-result-collapsible">
      <summary>
        <span>结果、依据与证据</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <TutorResultRightRail compact detail={detail} />
      </div>
    </details>
  );
}

function TutorResultLoadingSurface({
  currentUser,
  demoActive,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
}) {
  return (
    <div className="app-shell tutor-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <TutorResultMobileMenu overviewUrl={overviewUrl} />
      <main className="paper-canvas tutor-canvas" id="main-content">
        <div className="page-loading tutor-result-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns">
            <span />
            <span />
          </div>
        </div>
      </main>
    </div>
  );
}

export interface TutorResultRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly knowledgePointUrl: string;
  readonly overviewUrl: string;
  readonly sessionId: string | null;
}

export function TutorResultRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  knowledgePointId,
  knowledgePointUrl,
  overviewUrl,
  sessionId,
}: TutorResultRouteProps) {
  const detail = useMemo(
    () => course.tutorResults?.find((item) => item.tutorSessionId === sessionId) ??
      course.tutorResults?.find((item) => item.knowledgePointId === knowledgePointId) ??
      (sessionId === null && knowledgePointId === null ? course.tutorResults?.[0] : undefined),
    [course.tutorResults, knowledgePointId, sessionId],
  );

  if (detail === undefined) {
    return (
      <TutorResultServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端辅导结果文档；生产环境不会用开发 Fixture 补 tutorSessionId、学生结论、错题或掌握证据。"
        title="辅导结果"
      />
    );
  }

  if (detail.status === "LOADING") {
    return <TutorResultLoadingSurface currentUser={currentUser} demoActive={demoActive} overviewUrl={overviewUrl} />;
  }

  if (!isCompletedResult(detail.status)) {
    const copy = resultStateCopy[detail.status];
    return (
      <TutorResultServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.description}
        title={copy.title}
      />
    );
  }

  return (
    <div className="app-shell tutor-shell tutor-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <TutorResultMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas tutor-canvas tutor-result-canvas" id="main-content">
        <TutorResultHeader dateTime={dateTime} demoActive={demoActive} detail={detail} />
        <div className="content-grid tutor-grid tutor-result-grid">
          <article className="main-column tutor-main tutor-result-main" aria-label="辅导结果">
            <TutorResultUnderstanding detail={detail} />
            <TutorResultTimeline detail={detail} />
            <TutorResultNextActions detail={detail} knowledgePointUrl={knowledgePointUrl} />
            <p className="tutor-source-boundary">{detail.sourceBoundary}</p>
          </article>

          <TutorResultRightRail detail={detail} />
          <TutorResultRailCompact detail={detail} />
        </div>
      </main>
    </div>
  );
}

export interface TutorResultServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function TutorResultServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: TutorResultServiceUnavailableProps) {
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
          description="TUTOR_RESULT_SERVICE_UNAVAILABLE：当前没有真实辅导结果服务端文档；不会把开发 Fixture、本地点击、提示理解或页面输入伪装成 TutorSession 结果、错题记录、掌握证据或云端报告。"
          title="辅导结果服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
