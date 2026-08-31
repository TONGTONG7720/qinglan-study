import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ExamDetailDocument,
  ExamDetailLossItem,
  ExamDetailStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly ExamDetailStatus[] = [
  "COMPLETE_ANALYSIS_AVAILABLE",
  "PARTIAL_ENTRY",
  "NO_LOSS_ITEMS",
  "ANALYSIS_PENDING",
  "ANALYSIS_FAILED",
  "ANALYSIS_STALE",
  "EDITING",
  "EDIT_CONFLICT",
  "OFFLINE_READONLY",
];

function isDisplayableExamDetail(document: ExamDetailDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildExamListUrl(course: CourseSummary, document: ExamDetailDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.listTargetId,
    term: course.term,
    view: "exam-list",
  });
  return `/student/learn?${params.toString()}`;
}

function DetailDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["exam-detail-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="exam-detail-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ExamDetailMobileMenu({ examListUrl }: { readonly examListUrl: string }) {
  return (
    <details className="exam-detail-mobile-menu">
      <summary aria-label="打开移动端考试详情导航">
        <span>
          <strong>清朗学习</strong>
          <small>考试详情</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端考试详情功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={examListUrl}>考试记录</Link>
        <span aria-current="page">考试详情</span>
      </nav>
    </details>
  );
}

function ExamDetailHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: ExamDetailDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.updateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header exam-detail-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb exam-detail-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="exam-detail-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date exam-detail-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.updateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ExamFactSummary({ document }: { readonly document: ExamDetailDocument }) {
  return (
    <section className="exam-detail-facts" aria-labelledby="exam-detail-facts-title">
      <DetailSectionTitle id="exam-detail-facts-title" title="考试事实" />
      <div className="exam-detail-facts-body">
        <div className="exam-detail-score" aria-label={document.scoreAriaLabel}>
          <strong>{document.rawScore}</strong>
          <span>{document.scoreCaption}</span>
        </div>
        <div className="exam-detail-fact-copy">
          <h3>{document.examName}</h3>
          <p>{document.subjectTypeLabel}</p>
          <dl className="exam-detail-fact-list">
            <div>
              <dt>考试日期</dt>
              <dd>{document.examDateLabel}</dd>
            </div>
            <div>
              <dt>考试范围</dt>
              <dd>{document.scopeLabel}</dd>
            </div>
            <div>
              <dt>教材对齐</dt>
              <dd>{document.textbookAlignmentLabel}</dd>
            </div>
          </dl>
          <ul className="exam-detail-metrics" aria-label="考试细分事实">
            {document.metrics.map((metric) => (
              <li key={metric.id}>
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="exam-detail-score-notice">{document.scoreNotice}</p>
    </section>
  );
}

function LossItemsTable({
  document,
  editOpen,
  onEdit,
}: {
  readonly document: ExamDetailDocument;
  readonly editOpen: boolean;
  readonly onEdit: () => void;
}) {
  return (
    <section className="exam-detail-loss-section" aria-labelledby="exam-detail-loss-title">
      <DetailSectionTitle id="exam-detail-loss-title" title="失分项" />
      <div className="exam-detail-loss-table" role="region" aria-label="只读失分项">
        <div className="exam-detail-loss-head" aria-hidden="true">
          <span>题号</span>
          <span>失分</span>
          <span>知识点或范围</span>
          <span>已确认原因</span>
          <span>证据状态</span>
        </div>
        <ol className="exam-detail-loss-rows">
          {document.lossItems.map((item) => (
            <LossItemRow item={item} key={item.id} />
          ))}
        </ol>
      </div>
      <div className="exam-detail-reconciliation" aria-live="polite">
        <p>失分项合计 <strong>{document.lossSumExpression}</strong></p>
        <p className="is-consistent">{document.lossConsistencyLabel}</p>
        <button aria-expanded={editOpen} className="text-button exam-detail-edit-button" onClick={onEdit} type="button">
          {document.editActionLabel}
        </button>
      </div>
    </section>
  );
}

function LossItemRow({ item }: { readonly item: ExamDetailLossItem }) {
  return (
    <li
      aria-label={`题号 ${item.questionNumber}，失分 ${item.lossScore}，${item.scopeLabel}，${item.reasonLabel}，${item.evidenceStatusLabel}`}
      className="exam-detail-loss-row"
    >
      <span data-label="题号">{item.questionNumber}</span>
      <span data-label="失分">{item.lossScore}</span>
      <span data-label="知识点或范围">{item.scopeLabel}</span>
      <span data-label="已确认原因">{item.reasonLabel}</span>
      <span data-label="证据状态">{item.evidenceStatusLabel}</span>
    </li>
  );
}

function ControlledEditPanel({
  document,
  onCancel,
  onSave,
}: {
  readonly document: ExamDetailDocument;
  readonly onCancel: () => void;
  readonly onSave: () => void;
}) {
  return (
    <section className="exam-detail-edit-panel" aria-labelledby="exam-detail-edit-title">
      <h3 id="exam-detail-edit-title">{document.editPanelTitle}</h3>
      <p>{document.editPanelDescription}</p>
      <dl>
        <div>
          <dt>当前版本</dt>
          <dd>{document.versionLabel}</dd>
        </div>
        <div>
          <dt>保存条件</dt>
          <dd>{document.expectedVersionLabel}</dd>
        </div>
      </dl>
      <div className="exam-detail-edit-fields" aria-label="可更正字段示意">
        <label>
          <span>原始得分</span>
          <input readOnly value={document.rawScore} />
        </label>
        <label>
          <span>满分量尺</span>
          <input readOnly value={document.maximumScore} />
        </label>
        <label>
          <span>教材对齐</span>
          <input readOnly value={document.textbookAlignmentLabel} />
        </label>
      </div>
      <p className="exam-detail-warning">学生不能把教材核验状态直接设为 confirmed；并发版本变化时必须重新加载或合并允许字段。</p>
      <div className="exam-detail-edit-actions">
        <button className="exam-detail-secondary-action" onClick={onCancel} type="button">取消更正</button>
        <button className="exam-detail-primary-action" onClick={onSave} type="button">保存更正</button>
      </div>
    </section>
  );
}

function AnalysisStatusSection({
  document,
  examListUrl,
  onViewAnalysis,
}: {
  readonly document: ExamDetailDocument;
  readonly examListUrl: string;
  readonly onViewAnalysis: () => void;
}) {
  return (
    <section className="exam-detail-analysis" aria-labelledby="exam-detail-analysis-title">
      <DetailSectionTitle id="exam-detail-analysis-title" title={document.analysisStatusTitle} />
      <div className="exam-detail-analysis-copy">
        <p><strong>{document.analysisStatusLabel}</strong></p>
        <p>{document.analysisBasisLabel}</p>
        <p>{document.analysisGeneratedAtLabel}</p>
        <p>{document.analysisReliabilityLabel}</p>
      </div>
      <div className="exam-detail-actions">
        <button className="exam-detail-primary-action" onClick={onViewAnalysis} type="button">
          {document.primaryActionLabel}
          <Icon name="arrowRight" size={17} />
        </button>
        <Link className="exam-detail-secondary-action" to={examListUrl}>{document.listActionLabel}</Link>
      </div>
      <p>{document.scopeNotice}</p>
    </section>
  );
}

function ExamDetailRightRail({
  document,
  showServiceCode,
}: {
  readonly document: ExamDetailDocument;
  readonly showServiceCode: boolean;
}) {
  return (
    <aside aria-label="考试详情辅助信息" className="exam-detail-rail">
      <RailSection rows={document.recordStatusRows} title="记录状态" />
      <RailSection rows={document.completenessRows} title="录入完整度" />
      <RailSection rows={document.analysisRows} title="分析状态" />
      <RailSection rows={document.privacyRows} title="服务与隐私" />
      {showServiceCode ? <p className="exam-detail-service-code">{document.serviceCode}</p> : null}
    </aside>
  );
}

function RailSection({ rows, title }: { readonly rows: readonly DefinitionRow[]; readonly title: string }) {
  return (
    <section className="exam-detail-rail-section">
      <div className="exam-detail-rail-title">
        <h2>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DetailDefinitionList rows={rows} />
    </section>
  );
}

function ExamDetailRailCompact({
  document,
  showServiceCode,
}: {
  readonly document: ExamDetailDocument;
  readonly showServiceCode: boolean;
}) {
  return (
    <details className="exam-detail-collapsible">
      <summary>查看记录状态、完整度、分析状态与隐私边界</summary>
      <div className="exam-detail-collapsible-content">
        <ExamDetailRightRail document={document} showServiceCode={showServiceCode} />
      </div>
    </details>
  );
}

function ExamDetailReady({
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
  readonly document: ExamDetailDocument;
}) {
  const [editOpen, setEditOpen] = useState(document.status === "EDITING");
  const [message, setMessage] = useState("");
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const navigate = useNavigate();
  const examListUrl = buildExamListUrl(course, document);
  const showServiceCode = message.includes(document.serviceCode);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message.length > 0) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function viewAnalysis(): void {
    if (document.examId === null || document.analysisId === null || document.analysisTargetId === null) {
      setMessage(document.analysisBoundaryMessage);
      return;
    }
    const params = new URLSearchParams({
      analysis: document.analysisId,
      exam: document.examId,
      grade: String(course.grade),
      subject: course.subjectCode,
      target: document.analysisTargetId,
      term: course.term,
      view: "exam-analysis",
    });
    void navigate(`/student/learn?${params.toString()}`);
  }

  function openEdit(): void {
    setEditOpen((current) => !current);
    setMessage("已打开 STU-026 页内更正状态；不会新增 /student/exams/{examId}/edit 路由。");
  }

  function saveEdit(): void {
    setMessage(document.editSaveUnknownMessage);
  }

  return (
    <div className="app-shell exam-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <ExamDetailMobileMenu examListUrl={examListUrl} />
      <main className="paper-canvas exam-detail-canvas" id="main-content">
        <ExamDetailHeader dateTime={dateTime} document={document} />
        <div className="exam-detail-grid">
          <article className="exam-detail-main" aria-label="考试详情">
            <ExamFactSummary document={document} />
            <LossItemsTable document={document} editOpen={editOpen} onEdit={openEdit} />
            {editOpen ? (
              <ControlledEditPanel
                document={document}
                onCancel={() => {
                  setEditOpen(false);
                  setMessage("已取消更正；当前记录仍保持服务端版本。");
                }}
                onSave={saveEdit}
              />
            ) : null}
            <AnalysisStatusSection document={document} examListUrl={examListUrl} onViewAnalysis={viewAnalysis} />
            <p
              aria-live="polite"
              className="exam-detail-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="exam-detail-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="exam-detail-rail-divider" />
          <ExamDetailRightRail document={document} showServiceCode={showServiceCode} />
          <ExamDetailRailCompact document={document} showServiceCode={showServiceCode} />
        </div>
      </main>
    </div>
  );
}

function ExamDetailUnavailableSurface({
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
    <div className="app-shell exam-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page exam-detail-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="EXAM_DETAIL_UNAVAILABLE：当前不会展示虚构考试详情、examId、analysisId、失分项、分析、排名、百分位、LearningEvidence、Mastery 或云端笔记。"
          title="考试详情服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function ExamDetailLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell exam-detail-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas exam-detail-canvas" id="main-content">
        <div aria-label="正在加载考试详情" className="page-loading exam-detail-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface ExamDetailRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly examId: string | null;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function ExamDetailRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  examId,
  overviewUrl,
  targetId,
}: ExamDetailRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      const targetDocument = course.examDetails?.find((item) => item.targetId === targetId);
      if (targetDocument === undefined) {
        return undefined;
      }
      if (examId !== null && targetDocument.examId !== null && targetDocument.examId !== examId) {
        return undefined;
      }
      return targetDocument;
    }
    if (examId !== null) {
      return course.examDetails?.find((item) => item.examId === examId);
    }
    return course.examDetails?.[0];
  }, [course.examDetails, examId, targetId]);

  if (document === undefined) {
    return (
      <ExamDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-026 考试详情文档；生产环境不会用开发 Fixture 补考试详情、examId、analysisId 或分析状态。"
        title="考试详情"
      />
    );
  }

  if (document.status === "LOADING") {
    return <ExamDetailLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableExamDetail(document)) {
    return (
      <ExamDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="考试详情不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或猜测考试事实。"
        title="考试详情"
      />
    );
  }

  return (
    <ExamDetailReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function ExamDetailServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的考试详情服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "考试详情",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <ExamDetailUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
