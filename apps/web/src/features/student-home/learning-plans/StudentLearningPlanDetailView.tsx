import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { LearningPlanDetailRightRail, LearningPlanDetailRightRailContent } from "./LearningPlanDetailRightRail";
import type {
  LearningPlanCompletionCriterion,
  LearningPlanDetailDocument,
  LearningPlanDetailLoadState,
  LearningPlanItem,
  LearningPlanTargetView,
} from "./types";
import {
  currentLearningPlanItems,
  deriveLearningPlanProgressPercent,
  learningPlanDetailInvariantFailures,
  totalLearningPlanItemMinutes,
} from "./types";
import { useLearningPlanDetail } from "./use-learning-plan-detail";

function formatMonthDay(date: string): string {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}

function buildLearningUrl(document: LearningPlanDetailDocument, targetView: LearningPlanTargetView): string {
  const params = new URLSearchParams({
    subject: document.subjectCode,
    courseId: document.courseId,
    lessonId: document.lessonId,
    planId: document.planId,
  });
  if (targetView === "KNOWLEDGE_INTRO") {
    params.set("view", "knowledge-intro");
  } else if (targetView === "WORKED_EXAMPLE") {
    params.set("view", "example");
  } else if (targetView === "PRACTICE") {
    params.set("view", "practice");
  } else if (targetView === "SUMMARY") {
    params.set("view", "summary");
  }
  return `/student/learn?${params.toString()}`;
}

function completionCriterionValue(criterion: LearningPlanCompletionCriterion): string {
  if (criterion.status === "WAITING_FOR_PRACTICE") {
    return "练习后确认";
  }
  if (criterion.status === "WAITING_FOR_SERVICE") {
    return "待服务确认";
  }
  return `${String(criterion.currentValue ?? 0)} / ${String(criterion.totalValue ?? 0)}`;
}

function itemStateLabel(state: LearningPlanItem["state"]): string {
  if (state === "COMPLETED_IN_CURRENT_SESSION") {
    return "已完成";
  }
  if (state === "CURRENT") {
    return "当前";
  }
  return "待开始";
}

function PlanDetailHeader({ document }: { readonly document: LearningPlanDetailDocument }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <header className="learning-plan-header plan-detail-header" data-od-id="plan-detail-header">
      <div className="learning-plan-heading">
        <nav aria-label="面包屑" className="learning-plan-breadcrumb">
          <span>每日任务</span>
          <i aria-hidden="true">/</i>
          <span>学习计划</span>
          <i aria-hidden="true">/</i>
          <span>{document.subjectLabel}</span>
        </nav>
        <h1 data-od-id="plan-detail-title" ref={titleRef} tabIndex={-1}>
          {document.title}
        </h1>
        <div className="learning-plan-subtitle">
          <p>
            {document.subjectLabel} · {document.chapterLabel} · {formatMonthDay(document.startsOn)} — {formatMonthDay(document.endsOn)}
          </p>
          <span>Fixture 演示</span>
        </div>
      </div>
      <time className="learning-plan-date" dateTime={document.date}>
        <strong>{document.date}</strong>
        <span>{document.weekdayEnglish}</span>
        <small>
          {document.lunarDate}　{document.weekdayChinese}
        </small>
      </time>
    </header>
  );
}

function PlanProgressHero({
  document,
  entering,
  onContinue,
}: {
  readonly document: LearningPlanDetailDocument;
  readonly entering: boolean;
  readonly onContinue: () => void;
}) {
  const progress = deriveLearningPlanProgressPercent(document);
  const currentItem = currentLearningPlanItems(document.items)[0];
  const currentItemTitle = currentItem?.title ?? "当前任务";
  const continueLabel = `继续第 ${String(document.currentItemNumber)} 项`;

  return (
    <section aria-labelledby="plan-detail-progress-title" className="plan-detail-progress-hero" data-od-id="plan-detail-progress-hero">
      <div className="plan-detail-progress-number">
        <strong aria-label={`已完成${String(document.completedItems)}项，共${String(document.totalItems)}项`}>
          {document.completedItems} / {document.totalItems}
        </strong>
      </div>
      <div className="plan-detail-progress-copy">
        <div className="plan-detail-progress-title-row">
          <h2 id="plan-detail-progress-title">项任务已完成</h2>
          <span>进行中</span>
        </div>
        <p>当前进行到第 {document.currentItemNumber} 项：{currentItemTitle}</p>
        <div
          aria-label={`计划进度 ${String(progress)}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progress}
          className="plan-detail-progress-track"
          role="progressbar"
        >
          <span style={{ width: `${String(progress)}%` }} />
        </div>
        <p className="plan-detail-time-row">
          <span>总时长 {document.totalMinutes} 分钟</span>
          <span>已用 {document.usedMinutes} 分钟</span>
          <span>预计还需 {document.remainingMinutes} 分钟</span>
        </p>
      </div>
      <div className="plan-detail-hero-action">
        <button
          className="primary-button"
          data-od-id="plan-detail-continue"
          disabled={entering}
          onClick={onContinue}
          type="button"
        >
          {entering ? "正在进入…" : continueLabel}
        </button>
        <p>从当前计划位置进入例题讲解；演示进度不会同步。</p>
        <p className="learning-plan-caution">当前计划进度不等于服务端完成记录。</p>
      </div>
    </section>
  );
}

function PlanGoal({ document }: { readonly document: LearningPlanDetailDocument }) {
  return (
    <section aria-labelledby="plan-detail-goal-title" className="plan-detail-goal" data-od-id="plan-detail-goal">
      <h2 id="plan-detail-goal-title">计划目标</h2>
      <p>{document.goal}</p>
    </section>
  );
}

function PlanTaskRow({
  item,
  entering,
  onContinue,
}: {
  readonly item: LearningPlanItem;
  readonly entering: boolean;
  readonly onContinue: () => void;
}) {
  const stateLabel = itemStateLabel(item.state);
  const currentProps = item.state === "CURRENT" ? { "aria-current": "step" as const } : {};

  return (
    <li className={`plan-detail-task-row is-${item.state.toLowerCase()}`} {...currentProps}>
      <span className="plan-detail-task-marker" aria-hidden="true">
        {item.state === "COMPLETED_IN_CURRENT_SESSION" ? <Icon name="check" size={13} /> : item.number}
      </span>
      <div className="plan-detail-task-copy">
        <strong>{item.title}</strong>
        <small>{item.description}</small>
      </div>
      <span className="plan-detail-task-minutes">{item.estimatedMinutes} 分钟</span>
      <span className="plan-detail-task-state">{stateLabel}</span>
      {item.state === "CURRENT" ? (
        <button
          className="plan-detail-task-action"
          data-od-id="plan-detail-current-row-continue"
          disabled={entering}
          onClick={onContinue}
          type="button"
        >
          {entering ? "进入中" : "继续"}
        </button>
      ) : (
        <span className="plan-detail-task-action" aria-hidden="true">
          {item.state === "COMPLETED_IN_CURRENT_SESSION" ? "回看" : ""}
        </span>
      )}
    </li>
  );
}

function PlanTaskSequence({
  document,
  entering,
  onContinue,
}: {
  readonly document: LearningPlanDetailDocument;
  readonly entering: boolean;
  readonly onContinue: () => void;
}) {
  return (
    <section aria-labelledby="plan-detail-sequence-title" className="plan-detail-sequence" data-od-id="plan-detail-sequence">
      <h2 id="plan-detail-sequence-title">任务顺序</h2>
      <ol aria-label="学习计划五项任务">
        {document.items.map((item) => (
          <PlanTaskRow entering={entering} item={item} key={item.id} onContinue={onContinue} />
        ))}
      </ol>
    </section>
  );
}

function PlanBasis({ document }: { readonly document: LearningPlanDetailDocument }) {
  return (
    <section aria-labelledby="plan-detail-basis-title" className="plan-detail-basis" data-od-id="plan-detail-basis">
      <h2 id="plan-detail-basis-title">为什么这样安排</h2>
      <p>{document.basisExplanation}</p>
      <dl>
        {document.basisRows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd className={`is-${row.tone}`}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="learning-plan-caution">计划不根据页面停留、提示点击或 AI 对话推断掌握。</p>
    </section>
  );
}

function PlanCompletionCriteria({ document }: { readonly document: LearningPlanDetailDocument }) {
  return (
    <section aria-labelledby="plan-detail-criteria-title" className="plan-detail-criteria" data-od-id="plan-detail-criteria">
      <h2 id="plan-detail-criteria-title">完成标准</h2>
      <ul>
        {document.completionCriteria.map((criterion) => (
          <li key={criterion.id}>
            <span>{criterion.label}</span>
            <strong>{completionCriterionValue(criterion)}</strong>
          </li>
        ))}
      </ul>
      <p className="learning-plan-caution">不提前创建错题、学习证据或掌握判断。</p>
    </section>
  );
}

function PlanDetailActions({
  entering,
  onContinue,
  onReturnList,
  onReturnToday,
  onViewLesson,
  continueLabel,
}: {
  readonly entering: boolean;
  readonly onContinue: () => void;
  readonly onReturnList: () => void;
  readonly onReturnToday: () => void;
  readonly onViewLesson: () => void;
  readonly continueLabel: string;
}) {
  return (
    <footer className="plan-detail-actions" data-od-id="plan-detail-actions">
      <button className="primary-button" data-od-id="plan-detail-continue-bottom" disabled={entering} onClick={onContinue} type="button">
        {entering ? "正在进入…" : continueLabel}
      </button>
      <button className="learning-plan-return" data-od-id="plan-detail-return-list" onClick={onReturnList} type="button">
        返回计划列表
      </button>
      <button className="learning-plan-return" data-od-id="plan-detail-return-today" onClick={onReturnToday} type="button">
        返回今日学习
      </button>
      <button className="learning-plan-explanation-link" data-od-id="plan-detail-view-lesson" onClick={onViewLesson} type="button">
        <span>查看课时详情</span>
        <Icon name="chevronRight" size={16} />
      </button>
    </footer>
  );
}

export interface StudentLearningPlanDetailViewProps {
  readonly currentUser: CurrentUserResult;
  readonly document: LearningPlanDetailDocument;
  readonly onReturnToList: () => void;
  readonly onReturnToday: () => void;
}

export function StudentLearningPlanDetailView({
  currentUser,
  document,
  onReturnToList,
  onReturnToday,
}: StudentLearningPlanDetailViewProps) {
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const timerRef = useRef<number | null>(null);
  const invariantFailures = learningPlanDetailInvariantFailures(document);

  useEffect(() => () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  if (invariantFailures.length > 0) {
    throw new Error(`Invalid learning plan detail fixture: ${invariantFailures.join("; ")}`);
  }

  function continueCurrentTask(): void {
    if (entering) {
      return;
    }
    setEntering(true);
    timerRef.current = window.setTimeout(() => {
      void navigate(buildLearningUrl(document, "WORKED_EXAMPLE"));
    }, 180);
  }

  function viewLessonDetail(): void {
    void navigate(buildLearningUrl(document, "LESSON_DETAIL"));
  }
  const continueLabel = `继续第 ${String(document.currentItemNumber)} 项`;

  return (
    <div className="app-shell learning-plan-shell plan-detail-shell">
      <a className="skip-link" href="#learning-plan-detail-main">
        跳到主要内容
      </a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive />
      <main className="learning-plan-canvas plan-detail-canvas" data-od-id="student-learning-plan-detail" id="learning-plan-detail-main">
        <div className="learning-plan-layout plan-detail-layout">
          <div className="learning-plan-primary">
            <PlanDetailHeader document={document} />
            <PlanProgressHero document={document} entering={entering} onContinue={continueCurrentTask} />
            <PlanGoal document={document} />
            <div className="plan-detail-work-grid">
              <PlanTaskSequence document={document} entering={entering} onContinue={continueCurrentTask} />
              <div className="plan-detail-side-stack">
                <PlanBasis document={document} />
                <PlanCompletionCriteria document={document} />
              </div>
            </div>
            <p className="sr-only" data-od-id="plan-detail-derived-minutes">
              五项任务预计时长合计 {totalLearningPlanItemMinutes(document.items)} 分钟。
            </p>
            <PlanDetailActions
              entering={entering}
              onContinue={continueCurrentTask}
              onReturnList={onReturnToList}
              onReturnToday={onReturnToday}
              onViewLesson={viewLessonDetail}
              continueLabel={continueLabel}
            />
            <details className="learning-plan-rail-collapsible plan-detail-rail-collapsible">
              <summary>
                <span>计划与服务信息</span>
                <Icon name="chevronRight" size={18} />
              </summary>
              <div>
                <LearningPlanDetailRightRailContent
                  document={document}
                  entering={entering}
                  onContinue={continueCurrentTask}
                />
              </div>
            </details>
          </div>

          <LearningPlanDetailRightRail
            document={document}
            entering={entering}
            onContinue={continueCurrentTask}
          />
        </div>
      </main>
    </div>
  );
}

export function LearningPlanDetailStateSurface({
  currentUser,
  state,
  onReturnToList,
}: {
  readonly currentUser: CurrentUserResult;
  readonly state: Exclude<LearningPlanDetailLoadState, { readonly status: "READY_FIXTURE" } | { readonly status: "LOADING" }>;
  readonly onReturnToList: () => void;
}) {
  const copy = state.status === "NOT_FOUND_OR_DENIED"
    ? ["计划不存在或无法访问", "无法确认该计划属于当前学生，或计划已经不可用。"] as const
    : state.status === "SESSION_EXPIRED"
      ? ["学生会话已过期", "请重新建立学生会话后再读取本人计划；当前页面不会代入其他身份。"] as const
      : state.status === "REPLACED"
        ? ["学习计划已被替换", "旧计划已暂停，请返回计划列表查看最新顺序；当前页面不会静默覆盖已完成审计。"] as const
        : state.status === "OFFLINE_READ_ONLY"
          ? ["当前处于离线只读状态", state.cachedDocument === null ? "没有可验证的计划详情缓存。" : "缓存内容不能表示最新计划进度。"] as const
          : ["学习计划详情暂时不可用", "当前没有真实 LearningPlan Detail adapter；生产环境不会回退到演示计划详情。"] as const;
  const code = state.status === "SERVICE_UNAVAILABLE"
    ? state.reason
    : state.status === "NOT_FOUND_OR_DENIED"
      ? "NOT_FOUND_OR_DENIED"
      : undefined;

  return (
    <div className="app-shell learning-plan-shell">
      <a className="skip-link" href="#learning-plan-detail-main">
        跳到主要内容
      </a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={false} />
      <main className="paper-canvas service-state-page" id="learning-plan-detail-main">
        <header className="page-header compact">
          <div>
            <h1>学习计划详情</h1>
            <p>STU-004 · 计划详情</p>
          </div>
          <span aria-hidden="true" className="page-header-rule" />
        </header>
        <StatusPanel description={copy[1]} title={copy[0]} />
        {code === undefined ? null : <code className="learning-plan-service-code">{code}</code>}
        <button className="secondary-button" onClick={onReturnToList} type="button">
          返回学习计划
        </button>
      </main>
    </div>
  );
}

function LearningPlanDetailLoadingSurface() {
  return (
    <div aria-label="正在加载学习计划详情" className="page-loading" role="status">
      <span className="skeleton-line skeleton-title" />
      <span className="skeleton-line skeleton-copy" />
      <span className="skeleton-line skeleton-divider" />
      <div className="skeleton-columns">
        <span />
        <span />
      </div>
    </div>
  );
}

export function StudentLearningPlanDetailRoute({
  currentUser,
  planId,
  onReturnToList,
  onReturnToday,
}: {
  readonly currentUser: CurrentUserResult;
  readonly planId: string;
  readonly onReturnToList: () => void;
  readonly onReturnToday: () => void;
}) {
  const studentUserId = currentUser.status === "authenticated" && currentUser.user.roles.includes("STUDENT")
    ? currentUser.user.id
    : undefined;
  const state = useLearningPlanDetail(planId, studentUserId);

  if (state.status === "LOADING") {
    return <LearningPlanDetailLoadingSurface />;
  }
  if (state.status === "READY_FIXTURE") {
    return (
      <StudentLearningPlanDetailView
        currentUser={currentUser}
        document={state.document}
        onReturnToday={onReturnToday}
        onReturnToList={onReturnToList}
      />
    );
  }
  return <LearningPlanDetailStateSurface currentUser={currentUser} onReturnToList={onReturnToList} state={state} />;
}
