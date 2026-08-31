import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ExamAnalysisAttribution,
  ExamAnalysisDocument,
  ExamAnalysisDocumentStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly ExamAnalysisDocumentStatus[] = [
  "ANALYSIS_AVAILABLE",
  "DATA_INSUFFICIENT",
  "RESULT_UNKNOWN",
  "GENERATION_FAILED",
  "EVIDENCE_UNAVAILABLE",
  "ANALYSIS_STALE",
  "PLAN_PENDING",
  "OFFLINE_READONLY",
];

function isDisplayableExamAnalysis(document: ExamAnalysisDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildExamDetailUrl(course: CourseSummary, document: ExamAnalysisDocument): string {
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

function buildRemediationPlanUrl(course: CourseSummary, document: ExamAnalysisDocument): string | null {
  if (document.planId === null || document.remediationPlanTargetId === null) {
    return null;
  }
  const params = new URLSearchParams({
    grade: String(course.grade),
    plan: document.planId,
    subject: course.subjectCode,
    target: document.remediationPlanTargetId,
    term: course.term,
    view: "remediation-plan",
  });
  if (document.examId !== null) {
    params.set("exam", document.examId);
  }
  if (document.analysisId !== null) {
    params.set("analysis", document.analysisId);
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
    <dl className={["exam-analysis-definition-list", className].filter(Boolean).join(" ")}>
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
    <div className="exam-analysis-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ExamAnalysisMobileMenu({ examDetailUrl }: { readonly examDetailUrl: string }) {
  return (
    <details className="exam-analysis-mobile-menu">
      <summary aria-label="打开移动端考试分析导航">
        <span>
          <strong>清朗学习</strong>
          <small>考试分析</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端考试分析功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={examDetailUrl}>考试详情</Link>
        <span aria-current="page">考试分析</span>
      </nav>
    </details>
  );
}

function ExamAnalysisHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: ExamAnalysisDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.generationStatusLabel} · `;
  const statusDetail = document.generatedAtLabel.startsWith(statusPrefix)
    ? document.generatedAtLabel.slice(statusPrefix.length)
    : document.generatedAtLabel;

  return (
    <header className="page-header exam-analysis-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb exam-analysis-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="exam-analysis-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date exam-analysis-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.generatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.generationStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ExamContextStrip({ document }: { readonly document: ExamAnalysisDocument }) {
  return (
    <section aria-label="考试上下文" className="exam-analysis-context">
      <h2>{document.examName}</h2>
      <dl>
        <div>
          <dt>评分量尺</dt>
          <dd>{document.rawScore} / {document.maximumScore}</dd>
        </div>
        <div>
          <dt>总失分</dt>
          <dd>{document.totalLoss}</dd>
        </div>
        <div>
          <dt>失分确认</dt>
          <dd>{document.confirmedLossItemsLabel}</dd>
        </div>
      </dl>
    </section>
  );
}

function AttributionSummary({ document }: { readonly document: ExamAnalysisDocument }) {
  return (
    <section className="exam-analysis-attribution" aria-labelledby="exam-analysis-attribution-title">
      <SectionTitle id="exam-analysis-attribution-title" title={document.attributionTitle} />
      <div className="exam-analysis-attribution-body">
        <div className="exam-analysis-large-number" aria-label={`${document.largeNumber}${document.largeNumberCaption}`}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <ol className="exam-analysis-attribution-list">
          {document.attributions.map((item) => (
            <AttributionRow item={item} key={item.id} />
          ))}
        </ol>
      </div>
      <div className="exam-analysis-coverage" aria-live="polite">
        <p>{document.coverageStatement}</p>
        <p>{document.dataBoundaryStatement}</p>
      </div>
    </section>
  );
}

function AttributionRow({ item }: { readonly item: ExamAnalysisAttribution }) {
  return (
    <li
      aria-label={`${item.ordinalLabel}，${item.title}，${item.questionLabel}，${item.lossLabel}，已确认原因：${item.causeLabel}，依据：${item.sourceLabel}，可靠性：${item.reliabilityLabel}`}
      className="exam-analysis-attribution-row"
    >
      <div className="exam-analysis-attribution-index">{item.ordinalLabel}</div>
      <div className="exam-analysis-attribution-topic">
        <h3>{item.title}</h3>
        <p>{item.questionLabel} · {item.lossLabel}</p>
      </div>
      <div className="exam-analysis-attribution-meta">
        <span>已确认原因</span>
        <strong>{item.causeLabel}</strong>
      </div>
      <div className="exam-analysis-attribution-meta">
        <span>依据</span>
        <strong>{item.sourceLabel}</strong>
      </div>
      <div className="exam-analysis-attribution-meta">
        <span>可靠性</span>
        <strong className="is-reliable">{item.reliabilityLabel}</strong>
      </div>
      <div className="exam-analysis-magnitude" aria-label={`原始失分相对长度，${item.lossLabel}`}>
        <span style={{ inlineSize: `${String(item.rawMagnitudePercent)}%` }} />
      </div>
    </li>
  );
}

function RemediationOrder({ document }: { readonly document: ExamAnalysisDocument }) {
  return (
    <section className="exam-analysis-remediation" aria-labelledby="exam-analysis-remediation-title">
      <SectionTitle id="exam-analysis-remediation-title" title={document.remediationTitle} />
      <ol className="exam-analysis-remediation-list">
        {document.remediationSteps.map((step) => (
          <li key={step.id}>
            <span className="exam-analysis-remediation-index">{step.ordinalLabel}</span>
            <div className="exam-analysis-remediation-topic">
              <h3>{step.title}</h3>
              <p>{step.durationLabel}</p>
            </div>
            <p><span>原因</span>{step.reason}</p>
            <p><span>行动</span>{step.actionPath}</p>
          </li>
        ))}
      </ol>
      <p className="exam-analysis-remediation-total">{document.remediationTotalLabel}</p>
    </section>
  );
}

function ExamAnalysisActionBar({
  detailUrl,
  document,
  lossOpen,
  onOpenRemediation,
  onToggleLossItems,
}: {
  readonly detailUrl: string;
  readonly document: ExamAnalysisDocument;
  readonly lossOpen: boolean;
  readonly onOpenRemediation: () => void;
  readonly onToggleLossItems: () => void;
}) {
  return (
    <section className="exam-analysis-next" aria-labelledby="exam-analysis-next-title">
      <SectionTitle id="exam-analysis-next-title" title="下一步" />
      <div className="exam-analysis-actions">
        <button className="exam-analysis-primary-action" onClick={onOpenRemediation} type="button">
          {document.primaryActionLabel}
          <Icon name="arrowRight" size={18} />
        </button>
        <Link className="exam-analysis-secondary-action" to={detailUrl}>{document.returnDetailActionLabel}</Link>
        <button
          aria-expanded={lossOpen}
          className="exam-analysis-text-action"
          onClick={onToggleLossItems}
          type="button"
        >
          {document.lossItemsActionLabel}
        </button>
      </div>
      <p>补救计划只使用当前分析版本；考试事实变化后需要重新计算。</p>
    </section>
  );
}

function LossItemsDisclosure({ document }: { readonly document: ExamAnalysisDocument }) {
  return (
    <section className="exam-analysis-loss-disclosure" aria-labelledby="exam-analysis-loss-disclosure-title">
      <h3 id="exam-analysis-loss-disclosure-title">{document.lossItemsDisclosureTitle}</h3>
      <ol>
        {document.attributions.map((item) => (
          <li key={item.id}>
            <strong>{item.questionLabel}</strong>
            <span>{item.lossLabel}</span>
            <span>{item.causeLabel}</span>
            <small>sourceLossItemId: {item.sourceLossItemId} · examVersion: {document.examVersion}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExamAnalysisRightRail({
  document,
  showServiceCode,
}: {
  readonly document: ExamAnalysisDocument;
  readonly showServiceCode: boolean;
}) {
  return (
    <aside aria-label="考试分析辅助信息" className="exam-analysis-rail">
      <RailSection rows={document.sourceRows} title="分析来源" />
      <RailSection rows={document.reliabilityRows} title="可靠性" />
      <RailSection rows={document.dataBoundaryRows} title="数据边界" />
      <RailSection rows={document.privacyRows} title="服务与隐私" />
      {showServiceCode ? <p className="exam-analysis-service-code">{document.serviceCode}</p> : null}
    </aside>
  );
}

function RailSection({ rows, title }: { readonly rows: readonly DefinitionRow[]; readonly title: string }) {
  return (
    <section className="exam-analysis-rail-section">
      <div className="exam-analysis-rail-title">
        <h2>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList rows={rows} />
    </section>
  );
}

function ExamAnalysisRailCompact({
  document,
  showServiceCode,
}: {
  readonly document: ExamAnalysisDocument;
  readonly showServiceCode: boolean;
}) {
  return (
    <details className="exam-analysis-collapsible">
      <summary>查看分析来源、可靠性、数据边界与隐私</summary>
      <div className="exam-analysis-collapsible-content">
        <ExamAnalysisRightRail document={document} showServiceCode={showServiceCode} />
      </div>
    </details>
  );
}

function ExamAnalysisReady({
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
  readonly document: ExamAnalysisDocument;
}) {
  const [lossOpen, setLossOpen] = useState(false);
  const [message, setMessage] = useState("");
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const navigate = useNavigate();
  const examDetailUrl = buildExamDetailUrl(course, document);
  const remediationPlanUrl = buildRemediationPlanUrl(course, document);
  const showServiceCode = message.includes(document.serviceCode);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message.length > 0) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function openRemediationPlan(): void {
    if (remediationPlanUrl !== null) {
      void navigate(remediationPlanUrl);
      return;
    }
    setMessage(document.remediationBoundaryMessage);
  }

  function toggleLossItems(): void {
    setLossOpen((current) => !current);
    setMessage("已展开当前分析来源链；只展示本人确认的失分项、题号、失分、原因和考试版本。");
  }

  return (
    <div className="app-shell exam-analysis-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <ExamAnalysisMobileMenu examDetailUrl={examDetailUrl} />
      <main className="paper-canvas exam-analysis-canvas" id="main-content">
        <ExamAnalysisHeader dateTime={dateTime} document={document} />
        <div className="exam-analysis-grid">
          <article className="exam-analysis-main" aria-label="考试分析">
            <ExamContextStrip document={document} />
            <AttributionSummary document={document} />
            <RemediationOrder document={document} />
            <ExamAnalysisActionBar
              detailUrl={examDetailUrl}
              document={document}
              lossOpen={lossOpen}
              onOpenRemediation={openRemediationPlan}
              onToggleLossItems={toggleLossItems}
            />
            {lossOpen ? <LossItemsDisclosure document={document} /> : null}
            <p
              aria-live="polite"
              className="exam-analysis-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="exam-analysis-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="exam-analysis-rail-divider" />
          <ExamAnalysisRightRail document={document} showServiceCode={showServiceCode} />
          <ExamAnalysisRailCompact document={document} showServiceCode={showServiceCode} />
        </div>
      </main>
    </div>
  );
}

function ExamAnalysisUnavailableSurface({
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
    <div className="app-shell exam-analysis-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page exam-analysis-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="EXAM_ANALYSIS_UNKNOWN：当前不会展示虚构考试分析、归因、可靠性、planId、补救顺序、排名、百分位、LearningEvidence、Mastery 或云端笔记。"
          title="考试分析服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function ExamAnalysisLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell exam-analysis-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas exam-analysis-canvas" id="main-content">
        <div aria-label="正在加载考试分析" className="page-loading exam-analysis-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface ExamAnalysisRouteProps {
  readonly analysisId: string | null;
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly examId: string | null;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function ExamAnalysisRoute({
  analysisId,
  course,
  currentUser,
  dateTime,
  demoActive,
  examId,
  overviewUrl,
  targetId,
}: ExamAnalysisRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      const targetDocument = course.examAnalyses?.find((item) => item.targetId === targetId);
      if (targetDocument === undefined) {
        return undefined;
      }
      if (examId !== null && targetDocument.examId !== null && targetDocument.examId !== examId) {
        return undefined;
      }
      if (analysisId !== null && targetDocument.analysisId !== null && targetDocument.analysisId !== analysisId) {
        return undefined;
      }
      return targetDocument;
    }
    if (analysisId !== null) {
      return course.examAnalyses?.find((item) => item.analysisId === analysisId);
    }
    if (examId !== null) {
      return course.examAnalyses?.find((item) => item.examId === examId);
    }
    return course.examAnalyses?.[0];
  }, [analysisId, course.examAnalyses, examId, targetId]);

  if (document === undefined) {
    return (
      <ExamAnalysisServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-027 考试分析文档；生产环境不会用开发 Fixture 补归因、analysisId、planId 或补救顺序。"
        title="考试分析"
      />
    );
  }

  if (document.status === "LOADING") {
    return <ExamAnalysisLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableExamAnalysis(document)) {
    return (
      <ExamAnalysisServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="考试分析不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或猜测归因。"
        title="考试分析"
      />
    );
  }

  return (
    <ExamAnalysisReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function ExamAnalysisServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的考试分析服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "考试分析",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <ExamAnalysisUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
