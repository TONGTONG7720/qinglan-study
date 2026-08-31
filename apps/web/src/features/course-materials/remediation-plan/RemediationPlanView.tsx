import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  RemediationPlanDocument,
  RemediationPlanDocumentStatus,
  RemediationPlanTaskPathItem,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly RemediationPlanDocumentStatus[] = [
  "EXECUTABLE",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "DATA_CHANGED_RECALCULATING",
  "GENERATION_FAILED",
  "BASIS_INSUFFICIENT",
  "TASK_STARTING",
  "TASK_RESUME_AVAILABLE",
  "START_RESULT_UNKNOWN",
  "OFFLINE_READONLY",
];

function isDisplayableRemediationPlan(document: RemediationPlanDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildExamAnalysisUrl(course: CourseSummary, document: RemediationPlanDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.analysisTargetId,
    term: course.term,
    view: "exam-analysis",
  });
  if (document.examId !== null) {
    params.set("exam", document.examId);
  }
  if (document.analysisId !== null) {
    params.set("analysis", document.analysisId);
  }
  return `/student/learn?${params.toString()}`;
}

function buildExamDetailUrl(course: CourseSummary, document: RemediationPlanDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.detailTargetId,
    term: course.term,
    view: "exam-detail",
  });
  if (document.examId !== null) {
    params.set("exam", document.examId);
  }
  return `/student/learn?${params.toString()}`;
}

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["remediation-plan-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="remediation-plan-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function RemediationPlanMobileMenu({
  analysisUrl,
  detailUrl,
}: {
  readonly analysisUrl: string;
  readonly detailUrl: string;
}) {
  return (
    <details className="remediation-plan-mobile-menu">
      <summary aria-label="打开移动端补救计划导航">
        <span>
          <strong>清朗学习</strong>
          <small>补救计划</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端补救计划功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={detailUrl}>考试详情</Link>
        <Link to={analysisUrl}>考试分析</Link>
        <span aria-current="page">补救计划</span>
      </nav>
    </details>
  );
}

function RemediationPlanHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: RemediationPlanDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.planStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header remediation-plan-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb remediation-plan-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="remediation-plan-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date remediation-plan-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.planStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function PlanSummary({ document }: { readonly document: RemediationPlanDocument }) {
  return (
    <section aria-label="计划总览" className="remediation-plan-summary">
      <dl>
        {document.summaryMetrics.map((metric) => (
          <div key={metric.id}>
            <dt>{metric.label}</dt>
            <dd>{metric.value}</dd>
          </div>
        ))}
      </dl>
      <div aria-label={`线性进度，已完成 ${document.summaryMetrics[0]?.value ?? ""}`} className="remediation-plan-progress">
        <span style={{ inlineSize: `${String(document.progressPercent)}%` }} />
      </div>
    </section>
  );
}

function CurrentTask({
  document,
  explanationOpen,
  onStartTask,
  onToggleExplanation,
}: {
  readonly document: RemediationPlanDocument;
  readonly explanationOpen: boolean;
  readonly onStartTask: () => void;
  readonly onToggleExplanation: () => void;
}) {
  return (
    <section className="remediation-plan-current" aria-labelledby="remediation-plan-current-title">
      <SectionTitle id="remediation-plan-current-title" title={document.currentTaskTitle} />
      <div className="remediation-plan-current-body">
        <div className="remediation-plan-large-number" aria-label={`${document.largeNumber}${document.largeNumberCaption}`}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <div className="remediation-plan-current-content">
          <div className="remediation-plan-current-heading">
            <div>
              <h3>{document.currentTask.title}</h3>
              <p>{document.currentTask.sourceLabel}</p>
            </div>
            <strong>{document.currentTask.durationLabel}</strong>
          </div>
          <p className="remediation-plan-rationale">{document.currentTask.rationale}</p>
          <ol className="remediation-plan-substeps">
            {document.currentTask.substeps.map((step) => (
              <li key={step.id}>
                <span>{step.title}</span>
                <strong>{step.durationLabel}</strong>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
          <p className="remediation-plan-evidence-state">{document.currentTask.evidenceStateLabel}</p>
          <div className="remediation-plan-current-actions">
            <button className="remediation-plan-primary-action" onClick={onStartTask} type="button">
              {document.primaryActionLabel}
              <Icon name="arrowRight" size={18} />
            </button>
            <button
              aria-expanded={explanationOpen}
              className="remediation-plan-secondary-action"
              onClick={onToggleExplanation}
              type="button"
            >
              {document.secondaryActionLabel}
            </button>
          </div>
          <p className="remediation-plan-task-boundary">{document.taskBoundaryNotice}</p>
          {explanationOpen ? (
            <section className="remediation-plan-task-explanation" aria-labelledby="remediation-plan-task-explanation-title">
              <h3 id="remediation-plan-task-explanation-title">{document.taskExplanationTitle}</h3>
              <p>{document.taskExplanation}</p>
              <dl>
                <div>
                  <dt>taskId</dt>
                  <dd>{document.currentTask.taskId}</dd>
                </div>
                <div>
                  <dt>targetType</dt>
                  <dd>{document.currentTask.targetType}</dd>
                </div>
                <div>
                  <dt>目标</dt>
                  <dd>{document.currentTask.targetLabel}</dd>
                </div>
                <div>
                  <dt>routeToken</dt>
                  <dd>{document.currentTask.routeToken}</dd>
                </div>
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function TaskPath({ document }: { readonly document: RemediationPlanDocument }) {
  return (
    <section className="remediation-plan-path" aria-labelledby="remediation-plan-path-title">
      <SectionTitle id="remediation-plan-path-title" title={document.pathTitle} />
      <ol>
        {document.taskPath.map((item) => (
          <TaskPathItem item={item} key={item.id} />
        ))}
      </ol>
    </section>
  );
}

function TaskPathItem({ item }: { readonly item: RemediationPlanTaskPathItem }) {
  const current = item.state === "CURRENT";
  return (
    <li
      aria-current={current ? "step" : undefined}
      className={`remediation-plan-path-item is-${item.state.toLowerCase()}`}
    >
      <span className="remediation-plan-path-marker">{item.ordinalLabel}</span>
      <div className="remediation-plan-path-topic">
        <h3>{item.title}</h3>
        <p>{item.sourceLabel}</p>
      </div>
      <strong>{item.statusLabel} · {item.durationLabel}</strong>
      <span>{item.completionLabel}</span>
    </li>
  );
}

function PlanBasis({ document }: { readonly document: RemediationPlanDocument }) {
  return (
    <section className="remediation-plan-basis" aria-labelledby="remediation-plan-basis-title">
      <SectionTitle id="remediation-plan-basis-title" title={document.basisTitle} />
      <DefinitionList rows={document.basisRows} />
      <p>{document.basisBoundary}</p>
    </section>
  );
}

function RemediationActionBar({
  analysisUrl,
  detailUrl,
  document,
}: {
  readonly analysisUrl: string;
  readonly detailUrl: string;
  readonly document: RemediationPlanDocument;
}) {
  return (
    <section className="remediation-plan-actions" aria-label="补救计划底部操作">
      <Link className="remediation-plan-outline-action" to={analysisUrl}>{document.returnAnalysisActionLabel}</Link>
      <Link className="remediation-plan-text-action" to={detailUrl}>{document.detailActionLabel}</Link>
      <p>{document.completionFlowNotice}</p>
    </section>
  );
}

function RemediationPlanRightRail({
  document,
  showServiceCode,
}: {
  readonly document: RemediationPlanDocument;
  readonly showServiceCode: boolean;
}) {
  return (
    <aside aria-label="补救计划辅助信息" className="remediation-plan-rail">
      <RailSection rows={document.statusRows} title="计划状态" />
      <RailSection rows={document.currentBasisRows} title="当前依据" />
      <RailSection rows={document.recalculationRows} title="重算规则" />
      <RailSection rows={document.privacyRows} title="服务与隐私" />
      {showServiceCode ? <p className="remediation-plan-service-code">{document.serviceCode}</p> : null}
    </aside>
  );
}

function RailSection({ rows, title }: { readonly rows: readonly DefinitionRow[]; readonly title: string }) {
  return (
    <section className="remediation-plan-rail-section">
      <div className="remediation-plan-rail-title">
        <h2>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList rows={rows} />
    </section>
  );
}

function RemediationPlanRailCompact({
  document,
  showServiceCode,
}: {
  readonly document: RemediationPlanDocument;
  readonly showServiceCode: boolean;
}) {
  return (
    <details className="remediation-plan-collapsible">
      <summary>查看计划状态、当前依据、重算规则与隐私</summary>
      <div className="remediation-plan-collapsible-content">
        <RemediationPlanRightRail document={document} showServiceCode={showServiceCode} />
      </div>
    </details>
  );
}

function RemediationPlanReady({
  course,
  currentUser,
  dateTime,
  demoActive,
  document,
}: {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: RemediationPlanDocument;
}) {
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [message, setMessage] = useState("");
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const analysisUrl = buildExamAnalysisUrl(course, document);
  const detailUrl = buildExamDetailUrl(course, document);
  const showServiceCode = message.includes(document.serviceCode);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message.length > 0) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function startTask(): void {
    setMessage(document.startUnknownMessage);
  }

  function toggleExplanation(): void {
    setExplanationOpen((current) => !current);
    setMessage("已展开任务说明；这里只展示服务端目标合同，不会用标题或序号拼接下游路由。");
  }

  return (
    <div className="app-shell remediation-plan-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <RemediationPlanMobileMenu analysisUrl={analysisUrl} detailUrl={detailUrl} />
      <main className="paper-canvas remediation-plan-canvas" id="main-content">
        <RemediationPlanHeader dateTime={dateTime} document={document} />
        <div className="remediation-plan-grid">
          <article className="remediation-plan-main" aria-label="补救计划">
            <PlanSummary document={document} />
            <CurrentTask
              document={document}
              explanationOpen={explanationOpen}
              onStartTask={startTask}
              onToggleExplanation={toggleExplanation}
            />
            <TaskPath document={document} />
            <PlanBasis document={document} />
            <RemediationActionBar analysisUrl={analysisUrl} detailUrl={detailUrl} document={document} />
            <p
              aria-live="polite"
              className="remediation-plan-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="remediation-plan-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="remediation-plan-rail-divider" />
          <RemediationPlanRightRail document={document} showServiceCode={showServiceCode} />
          <RemediationPlanRailCompact document={document} showServiceCode={showServiceCode} />
        </div>
      </main>
    </div>
  );
}

function RemediationPlanUnavailableSurface({
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
    <div className="app-shell remediation-plan-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page remediation-plan-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="REMEDIATION_PLAN_UNAVAILABLE：当前不会展示虚构补救计划、planId、taskId、routeToken、完成事件、Today 回流、LearningEvidence、Mastery、预算或云端笔记。"
          title="补救计划服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function RemediationPlanLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell remediation-plan-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas remediation-plan-canvas" id="main-content">
        <div aria-label="正在加载补救计划" className="page-loading remediation-plan-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface RemediationPlanRouteProps {
  readonly analysisId: string | null;
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly examId: string | null;
  readonly overviewUrl: string;
  readonly planId: string | null;
  readonly targetId: string | null;
}

export function RemediationPlanRoute({
  analysisId,
  course,
  currentUser,
  dateTime,
  demoActive,
  examId,
  overviewUrl,
  planId,
  targetId,
}: RemediationPlanRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      const targetDocument = course.remediationPlans?.find((item) => item.targetId === targetId);
      if (targetDocument === undefined) {
        return undefined;
      }
      if (examId !== null && targetDocument.examId !== null && targetDocument.examId !== examId) {
        return undefined;
      }
      if (analysisId !== null && targetDocument.analysisId !== null && targetDocument.analysisId !== analysisId) {
        return undefined;
      }
      if (planId !== null && targetDocument.planId !== null && targetDocument.planId !== planId) {
        return undefined;
      }
      return targetDocument;
    }
    if (planId !== null) {
      return course.remediationPlans?.find((item) => item.planId === planId);
    }
    if (analysisId !== null) {
      return course.remediationPlans?.find((item) => item.analysisId === analysisId);
    }
    if (examId !== null) {
      return course.remediationPlans?.find((item) => item.examId === examId);
    }
    return course.remediationPlans?.[0];
  }, [analysisId, course.remediationPlans, examId, planId, targetId]);

  if (document === undefined) {
    return (
      <RemediationPlanServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-028 补救计划文档；生产环境不会用开发 Fixture 补 planId、taskId、routeToken、完成事件或 Today 回流。"
        title="补救计划"
      />
    );
  }

  if (document.status === "LOADING") {
    return <RemediationPlanLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableRemediationPlan(document)) {
    return (
      <RemediationPlanServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="补救计划不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或猜测任务顺序。"
        title="补救计划"
      />
    );
  }

  return (
    <RemediationPlanReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function RemediationPlanServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的补救计划服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "补救计划",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <RemediationPlanUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
