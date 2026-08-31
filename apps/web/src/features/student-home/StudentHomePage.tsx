import type { DailyPlanResponse, PlanCandidateSource } from "@study/contracts";
import "./student-home.css";
import "./task-detail/task-detail.css";
import "./learning-plans/learning-plans.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../api/auth";
import { Icon } from "../../components/Icon";
import { Sidebar } from "../../components/Sidebar";
import { StatusPanel } from "../../components/StatusPanel";
import { useShanghaiDateTime } from "../course-materials/use-shanghai-date-time";
import { useDocumentMetadata } from "../../hooks/use-document-metadata";
import type { StudentHomeResult, StudentHomeSnapshot } from "./types";
import { StudentLearningPlanListRoute } from "./learning-plans/StudentLearningPlanListView";
import { StudentTaskDetailRoute } from "./task-detail/StudentTaskDetailView";
import { useStudentHomeData } from "./use-student-home-data";

type PlanTask = DailyPlanResponse["tasks"][number];

const sourceLabels: Readonly<Record<PlanCandidateSource, string>> = {
  OVERDUE_REVIEW: "到期复习",
  EXAM_REMEDIATION: "考试补救",
  CURRENT_UNIT: "当前单元",
  DIAGNOSTIC: "基础检查",
};

function userName(currentUser: CurrentUserResult, demoActive: boolean): string {
  if (currentUser.status === "authenticated") {
    return currentUser.user.displayName;
  }
  return demoActive ? "开发演示同学" : "同学";
}

function LoadingHome() {
  return (
    <div aria-label="正在加载今日学习" className="page-loading" role="status">
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

function HomeSectionTitle({ title, caption }: { readonly title: string; readonly caption?: string }) {
  return (
    <div className="home-section-title">
      <div>
        <h2>{title}</h2>
        {caption === undefined ? null : <span>{caption}</span>}
      </div>
      <i aria-hidden="true" />
    </div>
  );
}

function StudentHomeMobileNav() {
  return (
    <details className="home-mobile-nav">
      <summary><span><strong>清朗学习</strong><small>今日学习</small></span><Icon name="chevronRight" size={18} /></summary>
      <nav aria-label="移动端学习功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to="/student/plans">每日任务</Link>
        <Link to="/student/questions">AI 辅导</Link>
        <Link to="/student/wrong-book">错题复习</Link>
        <Link to="/student/mastery">掌握证据</Link>
        <Link to="/student/exams">考试与评估</Link>
      </nav>
    </details>
  );
}

function TodayTaskRow({
  task,
  selected,
  onSelect,
}: {
  readonly task: PlanTask;
  readonly selected: boolean;
  readonly onSelect: (task: PlanTask) => void;
}) {
  return (
    <button
      aria-label={`${task.title}，${sourceLabels[task.sourceType]}，${String(task.estimatedMinutes)} 分钟`}
      aria-pressed={selected}
      className={`today-task-row${selected ? " is-selected" : ""}`}
      data-od-id={`home-task-${String(task.ordinal)}`}
      onClick={() => {
        onSelect(task);
      }}
      type="button"
    >
      <span className={`task-status-mark${task.status === "COMPLETED" ? " is-completed" : ""}`}>
        {task.status === "COMPLETED" ? <Icon name="check" size={16} /> : task.ordinal}
      </span>
      <span className="task-row-copy">
        <strong>{task.title}</strong>
        <small>{sourceLabels[task.sourceType]}</small>
      </span>
      <span className="task-duration">{task.estimatedMinutes} 分钟</span>
      <Icon className="task-row-arrow" name="arrowRight" size={18} />
    </button>
  );
}

function HomeRailContent({ snapshot }: { readonly snapshot: StudentHomeSnapshot }) {
  const fixture = snapshot.source === "DEVELOPMENT_FIXTURE";
  const evidence = fixture
    ? ["数学课堂笔记", "二次函数图像练习", "语文阅读摘抄", "英语单词听写记录"]
    : [];

  return (
    <>
      <section className="home-rail-section" aria-label="学习证据">
        <HomeSectionTitle caption={fixture ? "开发 Fixture" : "服务端最小聚合"} title="学习证据" />
        {evidence.length === 0 ? <p className="home-rail-empty">证据聚合服务尚未接入，不从浏览行为推断学习证据。</p> : (
          <ul className="home-evidence-list">
            {evidence.map((item, index) => <li key={item}><Icon name={index === 1 ? "bookOpen" : "fileText"} size={18} /><span>{item}</span><small>{index < 2 ? "今日" : "昨日"}</small></li>)}
          </ul>
        )}
      </section>
      <section className="home-rail-section">
        <HomeSectionTitle title="AI 辅导" />
        <p className="home-rail-lead">为你解答本节重点疑问</p>
        <p className="home-rail-copy">{snapshot.currentCourse.currentPosition}中，如何快速确认关键图像特征？</p>
        <small className="home-rail-boundary">提示式辅导不单独形成掌握证据</small>
      </section>
      <section className="home-rail-section home-rail-warn">
        <HomeSectionTitle title="错题复习" />
        <p className="home-rail-copy">错题聚合服务尚未接入；不会根据当前页面生成待复习数量。</p>
      </section>
      <section className="home-rail-section">
        <HomeSectionTitle title="家庭周报" />
        <p className="home-rail-copy">周报只读取服务端确认的聚合事实；当前没有可展示的真实周报。</p>
        <Link className="home-course-link" to="/guardian/overview"><span>查看家庭支持边界</span><Icon name="arrowRight" size={16} /></Link>
      </section>
    </>
  );
}

export interface StudentHomeViewProps {
  readonly snapshot: StudentHomeSnapshot;
  readonly currentUser: CurrentUserResult;
}

export function StudentHomeView({ snapshot, currentUser }: StudentHomeViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const dateTime = useShanghaiDateTime();
  const requestedTaskId = searchParams.get("task");
  const selectedTask = useMemo(
    () =>
      snapshot.dailyPlan.tasks.find((task) => task.id === requestedTaskId) ??
      snapshot.dailyPlan.tasks.find((task) => task.status === "PENDING") ??
      snapshot.dailyPlan.tasks[0],
    [requestedTaskId, snapshot.dailyPlan.tasks],
  );
  const completedCount = snapshot.dailyPlan.tasks.filter((task) => task.status === "COMPLETED").length;

  useEffect(() => {
    if (announcement === null) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setAnnouncement(null);
    }, 4_000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [announcement]);

  function selectTask(task: PlanTask): void {
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    setSearchParams(next, { replace: false });
  }

  function startTask(task: PlanTask): void {
    const next = new URLSearchParams(searchParams);
    next.set("task", task.id);
    next.set("view", "task-detail");
    setSearchParams(next, { replace: false });
  }

  return (
    <div className="app-shell student-home-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Sidebar currentUser={currentUser} demoActive={snapshot.source === "DEVELOPMENT_FIXTURE"} />
      <StudentHomeMobileNav />

      <main className="paper-canvas" data-od-id="student-home" id="main-content">
        <header className="page-header">
          <div>
            <h1 data-od-id="student-home-title">早安，{userName(currentUser, snapshot.source === "DEVELOPMENT_FIXTURE")}</h1>
            <p>持之以恒，水滴石穿</p>
          </div>
          <div className="page-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}`}>
            <span>{dateTime.weekdayEnglish}</span>
            <strong>{dateTime.date}</strong>
            <small>{dateTime.weekdayChinese} · Asia/Shanghai</small>
          </div>
          <span aria-hidden="true" className="page-header-rule" />
        </header>

        <div className="demo-data-notice" role="status">
          <Icon name="info" size={16} />
          <span>{snapshot.source === "API" ? "后端实时数据" : "开发演示数据"}</span>
          <small>
            {snapshot.source === "API"
              ? "今日计划已通过学生 OWN 权限接口读取；课程进度统计尚未接入。"
              : "当前未取得可用后端会话或今日计划；这些任务是明确标记的开发 Fixture。"}
          </small>
        </div>

        <div className="home-content-grid">
          <section aria-labelledby="today-plan-title" className="home-main-column">
            <HomeSectionTitle title="今日学习" />
            {selectedTask === undefined ? <StatusPanel description="当前没有生成可用任务。" title="今天还没有学习计划" /> : (
              <article className="home-priority" aria-labelledby="today-plan-title">
                <div className="home-priority-number"><span>今日重点</span><strong>1</strong></div>
                <div className="home-priority-copy">
                  <span>{sourceLabels[selectedTask.sourceType]}</span>
                  <h2 id="today-plan-title">{selectedTask.title}</h2>
                  <p>{snapshot.currentCourse.subjectLabel} · {snapshot.currentCourse.textbookLabel} · {snapshot.currentCourse.currentPosition}</p>
                  <p className="home-priority-goal">学习目标：完成当前服务端计划任务，并保留可追溯的任务范围。</p>
                  <button className="primary-button" data-od-id="home-start-task" disabled={selectedTask.status === "COMPLETED"} onClick={() => {
                    startTask(selectedTask);
                  }} type="button">
                    <span>{selectedTask.status === "COMPLETED" ? "已完成" : "继续学习"}</span>
                    <Icon name={selectedTask.status === "COMPLETED" ? "check" : "arrowRight"} size={18} />
                  </button>
                </div>
              </article>
            )}
            <HomeSectionTitle caption={`${String(completedCount)} 项已完成 · 服务端顺序`} title="学习路径" />
            <div aria-label="今日计划任务" className="today-task-list">
              {snapshot.dailyPlan.tasks.map((task) => (
                <TodayTaskRow
                  key={task.id}
                  onSelect={selectTask}
                  selected={selectedTask?.id === task.id}
                  task={task}
                />
              ))}
            </div>
            <p className="home-total-time"><Icon name="clock" size={18} />预计今日学习时长：{snapshot.dailyPlan.totalMinutes} 分钟</p>
          </section>

          <aside aria-label="今日学习概览" className="home-right-rail">
            <HomeRailContent snapshot={snapshot} />
          </aside>

          <details className="home-rail-collapsible">
            <summary>
              <span>今日概览与当前课程</span>
              <Icon name="chevronRight" size={18} />
            </summary>
            <div>
              <HomeRailContent snapshot={snapshot} />
            </div>
          </details>
        </div>
      </main>

      {announcement === null ? null : (
        <div className="toast" role="status">
          <Icon name="info" size={18} />
          <span>{announcement}</span>
          <button
            aria-label="关闭提示"
            onClick={() => {
              setAnnouncement(null);
            }}
            type="button"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function ReadyHome({
  homeResult,
  currentUser,
}: {
  readonly homeResult: StudentHomeResult;
  readonly currentUser: CurrentUserResult;
}) {
  const [searchParams] = useSearchParams();
  const view = searchParams.get("view");
  if (view === "plans" || view === "plan-detail") {
    return <StudentLearningPlanListRoute currentUser={currentUser} />;
  }
  if (view === "task-detail") {
    return <StudentTaskDetailRoute currentUser={currentUser} overviewUrl="/student/today" />;
  }
  if (homeResult.status === "unavailable") {
    const unavailableCopy = {
      NOT_AUTHENTICATED: ["需要登录学生账号", "请先建立学生会话，再读取本人今日计划。生产环境不会显示虚构任务。"],
      STUDENT_ROLE_REQUIRED: ["当前账号不是学生账号", "今日学习页只读取学生本人的 OWN 数据；家长和管理员账号不会在这里代入学生身份。"],
      NO_DAILY_PLAN: ["今天还没有学习计划", "后端已连接，但今天尚未生成计划。计划生成属于需要重新认证的写操作。"],
      DAILY_PLAN_SERVICE_UNAVAILABLE: ["今日计划暂时不可用", "学生身份已识别，但后端接口当前无法完成读取。请检查 API 与数据库状态后重试。"],
    } as const;
    const [title, description] = unavailableCopy[homeResult.reason];
    return (
      <div className="app-shell student-home-shell">
        <Sidebar currentUser={currentUser} demoActive={false} />
        <StudentHomeMobileNav />
        <main className="paper-canvas service-state-page" id="main-content">
          <header className="page-header compact">
            <div>
              <h1>今日学习</h1>
              <p>先完成最重要的，再从容进入下一步</p>
            </div>
            <span aria-hidden="true" className="page-header-rule" />
          </header>
          <StatusPanel
            actionLabel={homeResult.reason === "NOT_AUTHENTICATED" ? "前往登录" : "重新加载"}
            description={description}
            onAction={() => {
              if (homeResult.reason === "NOT_AUTHENTICATED") window.location.assign("/login");
              else window.location.reload();
            }}
            title={title}
          />
        </main>
      </div>
    );
  }

  return <StudentHomeView currentUser={currentUser} snapshot={homeResult.snapshot} />;
}

export function StudentHomePage() {
  const [searchParams] = useSearchParams();
  const taskDetailActive = searchParams.get("view") === "task-detail";
  const plansActive = searchParams.get("view") === "plans";
  const planDetailActive = searchParams.get("view") === "plan-detail";
  useDocumentMetadata(
    planDetailActive
      ? "学习计划详情 · 清朗学习系统"
      : plansActive
        ? "学习计划 · 清朗学习系统"
        : taskDetailActive
          ? "今日任务 · 清朗学习系统"
          : "今日学习 · 清朗学习系统",
    planDetailActive
      ? "清朗学习系统学习计划详情服务边界，用于承接 STU-003 打开计划意图且不伪造详情数据。"
      : plansActive
        ? "清朗学习系统学习计划列表，用于查看当前、即将开始和已完成的本人学习计划。"
        : taskDetailActive
      ? "清朗学习系统今日任务详情，用于查看当前任务目标、学习路径、完成标准与服务边界。"
      : "清朗学习系统今日学习首页，用于查看每日计划、当前任务和课程入口。",
  );
  const state = useStudentHomeData();

  if (state.status === "loading") {
    return <LoadingHome />;
  }
  if (state.status === "error") {
    return (
      <div className="service-state-page standalone">
        <StatusPanel
          actionLabel="重新加载"
          description="首页数据初始化失败。请检查本地环境后重试。"
          onAction={() => {
            window.location.reload();
          }}
          title="无法加载今日学习"
          tone="error"
        />
      </div>
    );
  }

  return <ReadyHome currentUser={state.currentUser} homeResult={state.homeResult} />;
}
