import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { TaskDetailRightRail, TaskDetailRightRailContent } from "./TaskDetailRightRail";
import type { CompletionCriterion, TaskDetailDocument, TaskDetailLoadState, TaskDetailStep } from "./types";
import { useTaskDetail } from "./use-task-detail";

function TodayTaskHeader({ document }: { readonly document: TaskDetailDocument }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { titleRef.current?.focus(); }, []);
  return (
    <header className="task-detail-header" data-od-id="task-detail-header">
      <div className="task-detail-heading">
        <nav aria-label="面包屑" className="task-detail-breadcrumb">
          <span>今日学习</span><i aria-hidden="true">/</i><span>今日任务</span>
        </nav>
        <h1 data-od-id="task-detail-title" ref={titleRef} tabIndex={-1}>今日任务</h1>
        <div className="task-detail-subtitle">
          <p>数学 · 二次函数的图像与性质</p>
          <span>Fixture 演示</span>
        </div>
      </div>
      <time className="task-detail-date" dateTime={document.date}>
        <strong>{document.date}</strong>
        <span>{document.weekdayEnglish}</span>
        <small>{document.lunarDate}　{document.weekdayChinese}</small>
      </time>
    </header>
  );
}

function TaskStatusLine({ document }: { readonly document: TaskDetailDocument }) {
  return (
    <p className="task-detail-status-line" data-od-id="task-detail-status">
      <strong>进行中</strong>
      <span aria-hidden="true">·</span>
      <span>第 {document.currentStep} 步 / 共 {document.totalSteps} 步</span>
      <span aria-hidden="true">·</span>
      <span>总时长 {document.totalMinutes} 分钟</span>
      <span aria-hidden="true">·</span>
      <span>预计还需 {document.remainingMinutes} 分钟</span>
    </p>
  );
}

function PriorityTaskHero({
  document,
  entering,
  onContinue,
}: {
  readonly document: TaskDetailDocument;
  readonly entering: boolean;
  readonly onContinue: () => void;
}) {
  return (
    <section aria-labelledby="priority-task-title" className="priority-task-hero" data-od-id="priority-task-hero">
      <div className="priority-number-block">
        <span>今日重点</span>
        <strong aria-label="今日优先级第一项">1</strong>
      </div>
      <div className="priority-task-copy">
        <h2 id="priority-task-title">{document.title}</h2>
        <p className="priority-course-meta">{document.subjectLabel} · {document.textbookLabel} · {document.gradeLabel} {document.chapterLabel}</p>
        <p className="priority-goal">{document.learningGoal}</p>
        <TaskStatusLine document={document} />
        <div className="priority-task-actions">
          <button className="primary-button" data-od-id="task-detail-continue" disabled={entering} onClick={onContinue} type="button">
            {entering ? "正在进入…" : "继续例题讲解"}
          </button>
          <small>从上次停留位置继续；当前演示进度不会同步。</small>
        </div>
      </div>
    </section>
  );
}

function TaskRationale({ document }: { readonly document: TaskDetailDocument }) {
  return (
    <section aria-labelledby="task-rationale-title" className="task-rationale" data-od-id="task-rationale">
      <h2 id="task-rationale-title">为什么今天先做</h2>
      <p>{document.rationale}</p>
      <p>{document.rationaleBasis}</p>
      <p className="caution-copy">{document.rationaleCaveat}</p>
    </section>
  );
}

function TaskStepRow({ step }: { readonly step: TaskDetailStep }) {
  const stateText = step.state === "COMPLETED" ? "已完成" : step.state === "CURRENT" ? "当前" : "待开始";
  return (
    <li className={`task-path-step is-${step.state.toLowerCase()}`}>
      <span className="task-path-mark" aria-hidden="true">
        {step.state === "COMPLETED" ? <Icon name="check" size={13} /> : step.number}
      </span>
      <div {...(step.state === "CURRENT" ? { "aria-current": "step" as const } : {})}>
        <p><strong>{step.number}　{step.label}</strong><span>{stateText}</span></p>
        <small>{step.description}</small>
      </div>
    </li>
  );
}

function TaskLearningPath({ steps }: { readonly steps: readonly TaskDetailStep[] }) {
  return (
    <section aria-labelledby="task-path-title" className="task-path" data-od-id="task-learning-path">
      <h2 id="task-path-title">学习路径</h2>
      <ol aria-label="四步学习路径">
        {steps.map((step) => <TaskStepRow key={step.id} step={step} />)}
      </ol>
    </section>
  );
}

function criterionValue(criterion: CompletionCriterion): string {
  if (criterion.status === "WAITING_FOR_PRACTICE") {
    return "练习后确认";
  }
  if (criterion.status === "WAITING_FOR_SERVICE") {
    return "待服务确认";
  }
  return `${String(criterion.currentValue ?? 0)} / ${String(criterion.totalValue ?? 0)}${criterion.id === "learning-steps" ? " 已完成" : ""}`;
}

function CompletionCriteriaList({ criteria }: { readonly criteria: readonly CompletionCriterion[] }) {
  return (
    <section aria-labelledby="completion-criteria-title" className="completion-criteria" data-od-id="completion-criteria">
      <h2 id="completion-criteria-title">完成标准</h2>
      <ul>
        {criteria.map((criterion) => (
          <li key={criterion.id}>
            <span>{criterion.label}</span>
            <strong>{criterionValue(criterion)}</strong>
          </li>
        ))}
      </ul>
      <p className="caution-copy">学习证据与掌握度须由服务端确认。</p>
    </section>
  );
}

function TaskPreparationRow({ remainingMinutes }: { readonly remainingMinutes: number }) {
  return (
    <section aria-labelledby="task-preparation-title" className="task-preparation" data-od-id="task-preparation">
      <h2 id="task-preparation-title">开始前准备</h2>
      <ul>
        <li><Icon name="fileText" size={20} /><span>草稿纸</span></li>
        <li><Icon name="clock" size={20} /><span>约 {remainingMinutes} 分钟</span></li>
        <li><Icon name="monitor" size={20} /><span>安静的学习环境</span></li>
      </ul>
    </section>
  );
}

function TaskDetailActions({
  entering,
  onContinue,
  onReturn,
}: {
  readonly entering: boolean;
  readonly onContinue: () => void;
  readonly onReturn: () => void;
}) {
  return (
    <footer className="task-detail-actions" data-od-id="task-detail-actions">
      <button className="primary-button" data-od-id="task-detail-continue-bottom" disabled={entering} onClick={onContinue} type="button">
        {entering ? "正在进入…" : "继续例题讲解"}
      </button>
      <button className="task-detail-secondary" data-od-id="task-detail-return" onClick={onReturn} type="button">返回今日学习</button>
      <button className="task-detail-text-action" data-od-id="task-detail-later" onClick={onReturn} type="button">稍后继续</button>
    </footer>
  );
}

export interface StudentTaskDetailViewProps {
  readonly currentUser: CurrentUserResult;
  readonly document: TaskDetailDocument;
  readonly overviewUrl: string;
}

export function StudentTaskDetailView({ currentUser, document, overviewUrl }: StudentTaskDetailViewProps) {
  const navigate = useNavigate();
  const [entering, setEntering] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (timerRef.current !== null) { window.clearTimeout(timerRef.current); }
  }, []);

  function continueLearning(): void {
    if (entering) { return; }
    setEntering(true);
    timerRef.current = window.setTimeout(() => {
      const params = new URLSearchParams({
        view: "example",
        subject: document.subjectCode,
        courseId: document.courseId,
        lessonId: document.lessonId,
      });
      void navigate(`/student/learn?${params.toString()}`);
    }, 180);
  }

  function returnToday(): void { void navigate(overviewUrl); }

  function relatedEntry(label: string): void {
    setAnnouncement(`${label}将在对应服务接入后开放；当前任务状态未改变。`);
  }

  return (
    <div className="app-shell task-detail-shell">
      <a className="skip-link" href="#task-detail-main">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive />
      <main className="task-detail-canvas" data-od-id="student-task-detail" id="task-detail-main">
        <div className="task-detail-layout">
          <div className="task-detail-primary">
            <TodayTaskHeader document={document} />
            <PriorityTaskHero document={document} entering={entering} onContinue={continueLearning} />
            <div className="task-detail-work-grid">
              <div className="task-detail-rationale-column">
                <TaskRationale document={document} />
              </div>
              <TaskLearningPath steps={document.steps} />
              <CompletionCriteriaList criteria={document.criteria} />
            </div>
            <TaskPreparationRow remainingMinutes={document.remainingMinutes} />
            <TaskDetailActions entering={entering} onContinue={continueLearning} onReturn={returnToday} />
            <details className="task-detail-rail-collapsible">
              <summary><span>任务与服务信息</span><Icon name="chevronRight" size={18} /></summary>
              <div><TaskDetailRightRailContent document={document} onRelatedEntry={relatedEntry} /></div>
            </details>
          </div>
          <TaskDetailRightRail document={document} onRelatedEntry={relatedEntry} />
        </div>
      </main>
      {announcement === null ? null : (
        <div className="toast" role="status">
          <Icon name="info" size={18} /><span>{announcement}</span>
          <button aria-label="关闭提示" onClick={() => { setAnnouncement(null); }} type="button"><Icon name="close" size={18} /></button>
        </div>
      )}
    </div>
  );
}

function TaskDetailStateSurface({ currentUser, state, overviewUrl }: {
  readonly currentUser: CurrentUserResult;
  readonly state: Exclude<TaskDetailLoadState, { status: "READY_FIXTURE" } | { status: "LOADING" }>;
  readonly overviewUrl: string;
}) {
  const copy = state.status === "NOT_FOUND_OR_DENIED"
    ? ["任务不存在或无法访问", "无法确认该任务属于当前学生，或任务已经不可用。"] as const
    : state.status === "SESSION_EXPIRED"
      ? ["学生会话已过期", "请重新建立学生会话后再继续；当前页面不会代入其他身份。"] as const
      : state.status === "OFFLINE_READ_ONLY"
        ? ["当前处于离线只读状态", state.cachedDocument === null ? "没有可验证的当前任务缓存。" : "缓存内容仅供查看，不能表示最新进度。"] as const
        : ["任务详情暂时不可用", "当前没有真实 TaskDetail adapter；生产环境不会回退到演示任务。"] as const;
  return (
    <div className="app-shell task-detail-shell">
      <a className="skip-link" href="#task-detail-main">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive={false} />
      <main className="paper-canvas service-state-page" id="task-detail-main">
        <header className="page-header compact"><div><h1>今日任务</h1><p>数学 · 二次函数的图像与性质</p></div><span className="page-header-rule" aria-hidden="true" /></header>
        <StatusPanel description={copy[1]} title={copy[0]} />
        {state.status === "SERVICE_UNAVAILABLE" ? <code className="task-detail-service-code">{state.reason}</code> : null}
        <button className="secondary-button" onClick={() => { window.location.assign(overviewUrl); }} type="button">返回今日学习</button>
      </main>
    </div>
  );
}

export function StudentTaskDetailRoute({ currentUser, overviewUrl }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string }) {
  const [searchParams] = useSearchParams();
  const state = useTaskDetail(searchParams.get("task"));
  if (state.status === "LOADING") {
    return <div aria-label="正在加载任务详情" className="page-loading" role="status"><span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-divider" /><div className="skeleton-columns"><span /><span /></div></div>;
  }
  if (state.status === "READY_FIXTURE") {
    return <StudentTaskDetailView currentUser={currentUser} document={state.document} overviewUrl={overviewUrl} />;
  }
  return <TaskDetailStateSurface currentUser={currentUser} overviewUrl={overviewUrl} state={state} />;
}
