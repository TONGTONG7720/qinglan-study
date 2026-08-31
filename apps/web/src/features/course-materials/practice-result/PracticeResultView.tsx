import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  PracticeResult,
  PracticeResultAnswerItem,
  PracticeResultAnswerState,
  PracticeResultMetric,
  PracticeResultStatus,
  PracticeResultWrongReview,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const resultStateCopy: Record<PracticeResultStatus, { readonly title: string; readonly description: string }> = {
  LOADING: {
    title: "练习结果加载中",
    description: "保留结果页骨架，等待服务端返回本次 attempt 的判题结果。",
  },
  ALL_CORRECT_CONFIRMED: {
    title: "练习结果",
    description: "全部结果已经确认；仍不能因一次练习直接宣称掌握。",
  },
  INCORRECT_WRONG_ITEM_CREATED: {
    title: "练习结果",
    description: "错误结果和错题创建均已由服务端确认。",
  },
  INCORRECT_WRONG_ITEM_PENDING: {
    title: "错题创建待确认",
    description: "错误已经确认，但 wrongItemId 尚未返回，不能展示已创建或导航虚构错题。",
  },
  PARTIALLY_JUDGED: {
    title: "部分结果已判定",
    description: "明确区分可判和不可判题，不把不可判题计为正确或错误。",
  },
  RESULT_UNKNOWN: {
    title: "练习结果未知",
    description: "PRACTICE_RESULT_UNKNOWN：需要查询原 attempt，不能由前端猜测结果、错题或掌握证据。",
  },
  EXPLANATION_FAILED: {
    title: "解析暂不可用",
    description: "判定结果可以展示，但解析需要单独重试，不能重新提交 attempt。",
  },
  OFFLINE_READONLY: {
    title: "离线只读结果",
    description: "只显示已经可信缓存并标明时间的结果；离线时不能创建错题或更新证据。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "练习结果不可用",
    description: "当前 attempt 不在学生 OWN 范围内，按无权和不存在统一不泄露语义处理。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请刷新学生身份后重新读取同一结果；失败时返回练习中心。",
  },
};

function isDisplayableResult(status: PracticeResultStatus): boolean {
  return status === "ALL_CORRECT_CONFIRMED" ||
    status === "INCORRECT_WRONG_ITEM_CREATED" ||
    status === "INCORRECT_WRONG_ITEM_PENDING" ||
    status === "PARTIALLY_JUDGED" ||
    status === "EXPLANATION_FAILED" ||
    status === "OFFLINE_READONLY";
}

function answerStateClassName(state: PracticeResultAnswerState): string {
  return state === "WRONG"
    ? "is-wrong"
    : state === "UNJUDGEABLE"
    ? "is-unjudgeable"
    : state === "EXPLANATION_UNAVAILABLE"
    ? "is-explanation-unavailable"
    : "is-correct";
}

function PracticeResultMobileMenu({
  overviewUrl,
  practiceHubUrl,
}: {
  readonly overviewUrl: string;
  readonly practiceHubUrl: string;
}) {
  return (
    <details className="practice-result-mobile-menu">
      <summary aria-label="打开移动端练习结果导航">
        <span>
          <strong>清朗学习</strong>
          <small>每日任务</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端练习结果功能">
        <Link to="/student/today">今日学习</Link>
        <Link to={overviewUrl}>课程与资料</Link>
        <Link to={practiceHubUrl}>练习中心</Link>
        <span aria-current="page">练习结果</span>
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
    <dl className={["practice-result-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PracticeResultHeader({
  dateTime,
  demoActive,
  result,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly result: PracticeResult;
}) {
  const dateLabel = result.id.startsWith("demo-") ? "2026-08-22" : dateTime.date;
  const weekdayLabel = result.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  return (
    <header className="page-header practice-result-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb practice-result-breadcrumb">
          {result.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="practice-result-header-title">
          <h1>{result.title}</h1>
          <p>{result.subtitle}</p>
          {demoActive && result.fixtureBadgeLabel !== undefined ? <span className="fixture-badge">{result.fixtureBadgeLabel}</span> : null}
        </div>
      </div>
      <div className="page-date practice-result-date" aria-label={`${dateLabel}，${weekdayLabel}，${result.submittedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small>{result.submittedAtLabel}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ResultSectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="practice-result-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ResultMetric({ metric }: { readonly metric: PracticeResultMetric }) {
  return (
    <li>
      <strong>{metric.value}</strong>
      <span>{metric.label}</span>
      <small>{metric.description}</small>
    </li>
  );
}

function PracticeResultSummaryPanel({ result }: { readonly result: PracticeResult }) {
  const titleId = useId();
  return (
    <section className="practice-result-summary" aria-labelledby={titleId}>
      <ResultSectionTitle id={titleId} title="本次结果" />
      <div className="practice-result-summary-grid">
        <div className="practice-result-oversized" aria-label={`${result.metricValue} ${result.metricCaption}`}>
          <strong>{result.metricValue}</strong>
          <span>{result.metricCaption}</span>
        </div>
        <div className="practice-result-summary-copy">
          <p>{result.summaryText}</p>
          <ol aria-label="本次结果指标" className="practice-result-metrics">
            {result.metrics.map((metric) => (
              <ResultMetric key={metric.id} metric={metric} />
            ))}
          </ol>
          <p className="practice-result-evidence-boundary">
            <span aria-hidden="true" />
            {result.evidenceBoundary}
          </p>
        </div>
      </div>
    </section>
  );
}

function WrongReview({
  onWrongDetail,
  review,
  result,
}: {
  readonly onWrongDetail: () => void;
  readonly review: PracticeResultWrongReview;
  readonly result: PracticeResult;
}) {
  const titleId = useId();
  const analysisPanelId = useId();
  const analysisButtonRef = useRef<HTMLButtonElement | null>(null);
  const analysisPanelRef = useRef<HTMLDivElement | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const wrongDetailDisabled = review.wrongItemId === null || result.status === "INCORRECT_WRONG_ITEM_PENDING";

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

  return (
    <section className="practice-result-wrong" aria-labelledby={titleId}>
      <ResultSectionTitle id={titleId} title="需要订正" />
      <div className="practice-result-wrong-body">
        <p className="practice-result-wrong-kicker">{review.numberLabel} · {review.title}</p>
        <p className="practice-result-question" aria-label={`题目：${review.questionText}`}>{review.questionText}</p>
        <dl className="practice-result-answer-compare">
          <div>
            <dt>我的答案</dt>
            <dd className="is-wrong-answer">{review.studentAnswer}</dd>
          </div>
          <div>
            <dt>正确结论</dt>
            <dd className="is-correct-answer">{review.correctConclusion}</dd>
          </div>
          <div>
            <dt>错因</dt>
            <dd>{review.reason}</dd>
          </div>
          <div>
            <dt>解析</dt>
            <dd>{review.explanation}</dd>
          </div>
          <div>
            <dt>来源</dt>
            <dd>{review.sourceLabel}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd className="is-pending-correction">{review.statusLabel}</dd>
          </div>
        </dl>
        <div className="practice-result-wrong-actions">
          <button
            className="primary-button practice-result-wrong-primary"
            disabled={wrongDetailDisabled}
            onClick={onWrongDetail}
            type="button"
          >
            <span>{result.wrongDetailActionLabel}</span>
          </button>
          <button
            aria-controls={analysisPanelId}
            aria-expanded={analysisOpen}
            className="text-button practice-result-analysis-button"
            onClick={() => { setAnalysisOpen((current) => !current); }}
            ref={analysisButtonRef}
            type="button"
          >
            {result.analysisActionLabel}
          </button>
        </div>
        {analysisOpen ? (
          <div
            className="practice-result-analysis"
            id={analysisPanelId}
            onKeyDown={handleAnalysisKeyDown}
            ref={analysisPanelRef}
            tabIndex={-1}
          >
            <div>
              <h3>本题解析</h3>
              <button className="text-button" onClick={closeAnalysis} type="button">收起解析</button>
            </div>
            <p>{review.explanation}</p>
            <p>解析只复述服务端确认结果；当前不会重新提交 attempt，也不会生成新的错题记录。</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CorrectAnswerRow({ answer, expanded }: { readonly answer: PracticeResultAnswerItem; readonly expanded: boolean }) {
  return (
    <li className={answerStateClassName(answer.state)}>
      <div className="practice-result-correct-summary">
        <span>{answer.numberLabel}</span>
        <strong>{answer.title}</strong>
        <small>{answer.stateLabel}</small>
      </div>
      {expanded ? (
        <div className="practice-result-correct-detail">
          <p>{answer.questionText}</p>
          <dl>
            <div>
              <dt>本人答案</dt>
              <dd>{answer.studentAnswer}</dd>
            </div>
            <div>
              <dt>判定</dt>
              <dd>{answer.confirmedConclusion}</dd>
            </div>
            <div>
              <dt>解析</dt>
              <dd>{answer.explanation}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </li>
  );
}

function CorrectAnswerList({ result }: { readonly result: PracticeResult }) {
  const titleId = useId();
  const listId = useId();
  const listRef = useRef<HTMLOListElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) {
      listRef.current?.focus();
    }
  }, [expanded]);

  function toggleExpanded(): void {
    setExpanded((current) => {
      const next = !current;
      if (current) {
        window.setTimeout(() => {
          toggleRef.current?.focus();
        }, 0);
      }
      return next;
    });
  }

  return (
    <section className="practice-result-correct" aria-labelledby={titleId}>
      <div className="practice-result-correct-title-row">
        <ResultSectionTitle id={titleId} title="已确认正确" />
        <button
          aria-controls={listId}
          aria-expanded={expanded}
          className="text-button"
          onClick={toggleExpanded}
          ref={toggleRef}
          type="button"
        >
          {expanded ? result.correctCollapseLabel : result.correctToggleLabel}
        </button>
      </div>
      <ol className="practice-result-correct-list" id={listId} ref={listRef} tabIndex={expanded ? -1 : undefined}>
        {result.correctAnswers.map((answer) => (
          <CorrectAnswerRow answer={answer} expanded={expanded} key={answer.id} />
        ))}
      </ol>
    </section>
  );
}

function ResultActionBar({
  onContinue,
  practiceHubUrl,
  result,
}: {
  readonly onContinue: () => void;
  readonly practiceHubUrl: string;
  readonly result: PracticeResult;
}) {
  return (
    <section className="practice-result-next" aria-label="练习结果下一步">
      <div className="practice-result-next-actions">
        <Link className="secondary-button" to={practiceHubUrl}>{result.returnPracticeHubLabel}</Link>
        <button className="text-button practice-result-continue" onClick={onContinue} type="button">
          <span>{result.continueNextLabel}</span>
        </button>
      </div>
      <p>{result.nextStepNotice}</p>
    </section>
  );
}

function PracticeResultRailSection({
  children,
  rows,
  title,
}: {
  readonly children?: ReactNode;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `practice-result-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className="practice-result-rail-section" aria-labelledby={titleId}>
      <div className="practice-result-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <ResultDefinitionList className="practice-result-rail-list" rows={rows} />
      {children}
    </section>
  );
}

function PracticeResultRightRail({
  compact = false,
  result,
}: {
  readonly compact?: boolean;
  readonly result: PracticeResult;
}) {
  return (
    <aside
      aria-label={compact ? "练习结果折叠辅助信息" : "练习结果辅助信息"}
      className="right-rail practice-result-rail"
    >
      <PracticeResultRailSection rows={result.submissionRows} title="提交记录" />
      <PracticeResultRailSection rows={result.evidenceRows} title="证据状态">
        <p className="practice-result-rail-note">不会因一次练习直接标记为已掌握。</p>
      </PracticeResultRailSection>
      <PracticeResultRailSection rows={result.wrongStatusRows} title="错题状态" />
      <PracticeResultRailSection rows={result.privacyRows} title="服务与隐私">
        <p className="practice-result-service-code">{result.serviceCode}</p>
      </PracticeResultRailSection>
    </aside>
  );
}

function PracticeResultRailCompact({ result }: { readonly result: PracticeResult }) {
  return (
    <details className="right-rail-collapsible practice-result-collapsible">
      <summary>
        <span>提交、证据与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <PracticeResultRightRail compact result={result} />
      </div>
    </details>
  );
}

function PracticeResultLoadingSurface({
  currentUser,
  demoActive,
  overviewUrl,
  practiceHubUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly practiceHubUrl: string;
}) {
  return (
    <div className="app-shell practice-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <PracticeResultMobileMenu overviewUrl={overviewUrl} practiceHubUrl={practiceHubUrl} />
      <main className="paper-canvas practice-result-canvas" id="main-content">
        <div className="page-loading practice-result-loading" role="status">
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

function PracticeResultReady({
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  practiceHubUrl,
  result,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly practiceHubUrl: string;
  readonly result: PracticeResult;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const sourceBoundary = demoActive ? result.sourceBoundary : undefined;
  const wrongReview = result.wrongReview;

  function openWrongDetail(review: PracticeResultWrongReview): void {
    if (review.detailTargetId !== undefined && review.wrongItemId !== null) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("view", "wrong-item-detail");
      nextParams.set("target", review.detailTargetId);
      nextParams.set("wrongItem", review.wrongItemId);
      nextParams.delete("attempt");
      setSearchParams(nextParams, { replace: false });
      return;
    }
    setMessage(result.wrongDetailUnavailableMessage);
  }

  return (
    <div className="app-shell practice-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <PracticeResultMobileMenu overviewUrl={overviewUrl} practiceHubUrl={practiceHubUrl} />
      <main className="paper-canvas practice-result-canvas" id="main-content">
        <PracticeResultHeader dateTime={dateTime} demoActive={demoActive} result={result} />
        <div className="practice-result-layout">
          <article className="practice-result-main" aria-label="练习结果">
            <PracticeResultSummaryPanel result={result} />
            {wrongReview === null ? null : (
              <WrongReview
                onWrongDetail={() => { openWrongDetail(wrongReview); }}
                result={result}
                review={wrongReview}
              />
            )}
            <CorrectAnswerList result={result} />
            <ResultActionBar
              onContinue={() => { setMessage(result.continueUnavailableMessage); }}
              practiceHubUrl={practiceHubUrl}
              result={result}
            />
            <p aria-live="polite" className="practice-result-action-message">{message}</p>
            {sourceBoundary === undefined ? null : <p className="practice-result-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="practice-result-rail-divider" />
          <PracticeResultRightRail result={result} />
          <PracticeResultRailCompact result={result} />
        </div>
      </main>
    </div>
  );
}

function PracticeResultUnavailableSurface({
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
    <div className="app-shell practice-result-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page practice-result-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="PRACTICE_RESULT_UNKNOWN：当前不会展示虚构判题、错题创建、wrongItemId、LearningEvidence、Mistake、RecoveryAttempt、Mastery、预算或云端笔记。"
          title="练习结果服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export interface PracticeResultRouteProps {
  readonly attemptId: string | null;
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly overviewUrl: string;
  readonly practiceHubUrl: string;
  readonly targetId: string | null;
}

export function PracticeResultRoute({
  attemptId,
  course,
  currentUser,
  dateTime,
  demoActive,
  knowledgePointId,
  overviewUrl,
  practiceHubUrl,
  targetId,
}: PracticeResultRouteProps) {
  const result = useMemo(
    () => course.practiceResults?.find((item) => item.attemptId === attemptId) ??
      course.practiceResults?.find((item) => item.targetId === targetId) ??
      course.practiceResults?.find((item) => item.knowledgePointId === knowledgePointId) ??
      (attemptId === null && targetId === null && knowledgePointId === null ? course.practiceResults?.[0] : undefined),
    [attemptId, course.practiceResults, knowledgePointId, targetId],
  );

  if (result === undefined) {
    return (
      <PracticeResultServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-018 练习结果文档；生产环境不会用开发 Fixture 补判题结果、错题创建或掌握证据。"
        title="练习结果"
      />
    );
  }

  if (result.status === "LOADING") {
    return (
      <PracticeResultLoadingSurface
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        practiceHubUrl={practiceHubUrl}
      />
    );
  }

  if (!isDisplayableResult(result.status)) {
    const copy = resultStateCopy[result.status];
    return (
      <PracticeResultServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.description}
        title={copy.title}
      />
    );
  }

  return (
    <PracticeResultReady
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      practiceHubUrl={practiceHubUrl}
      result={result}
    />
  );
}

export function PracticeResultServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的练习结果服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "练习结果",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <PracticeResultUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
