import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { LearningPlanDetailStateSurface, StudentLearningPlanDetailRoute } from "./StudentLearningPlanDetailView";
import { LearningPlanListRightRail, LearningPlanListRightRailContent } from "./LearningPlanListRightRail";
import { useLearningPlans } from "./use-learning-plans";
import type {
  LearningPlanCounts,
  LearningPlanListDocument,
  LearningPlanListLoadState,
  LearningPlanStatus,
  LearningPlanSummary,
  PlanListFilters,
  PlanRangeFilter,
  PlanStatusFilter,
  PlanSubjectFilter,
} from "./types";
import {
  filterLearningPlans,
  sortLearningPlans,
  summarizeLearningPlans,
} from "./types";

const statusTabOptions: readonly { readonly value: PlanStatusFilter; readonly label: string }[] = [
  { value: "all", label: "全部" },
  { value: "current", label: "当前" },
  { value: "upcoming", label: "即将开始" },
  { value: "completed", label: "已完成" },
];

const subjectOptions: readonly { readonly value: PlanSubjectFilter; readonly label: string }[] = [
  { value: "all", label: "全部学科" },
  { value: "CHINESE", label: "语文" },
  { value: "MATH", label: "数学" },
  { value: "ENGLISH", label: "英语" },
  { value: "MORALITY_LAW", label: "道德与法治" },
  { value: "HISTORY", label: "历史" },
  { value: "PHYSICS", label: "物理" },
  { value: "CHEMISTRY", label: "化学" },
];

function parseStatusFilter(value: string | null): PlanStatusFilter {
  return value === "current" || value === "upcoming" || value === "completed" ? value : "all";
}

function parseSubjectFilter(value: string | null): PlanSubjectFilter {
  if (
    value === "CHINESE" ||
    value === "MATH" ||
    value === "ENGLISH" ||
    value === "MORALITY_LAW" ||
    value === "HISTORY" ||
    value === "PHYSICS" ||
    value === "CHEMISTRY"
  ) {
    return value;
  }
  return "all";
}

function parseRangeFilter(value: string | null): PlanRangeFilter {
  return value === "current-week" ? "current-week" : "current-week";
}

function formatMonthDay(date: string): string {
  return `${date.slice(5, 7)}.${date.slice(8, 10)}`;
}

function dateLabel(plan: LearningPlanSummary): string {
  if (plan.status === "CURRENT") {
    return `${formatMonthDay(plan.startsOn)} — ${formatMonthDay(plan.endsOn ?? plan.startsOn)}`;
  }
  if (plan.status === "UPCOMING") {
    return `${formatMonthDay(plan.startsOn)} 开始`;
  }
  return `${formatMonthDay(plan.completedOn ?? plan.startsOn)} 完成`;
}

function taskCountLabel(plan: LearningPlanSummary): string {
  if (plan.status === "UPCOMING") {
    return `${String(plan.totalItems)} 项任务`;
  }
  return `${String(plan.completedItems)} / ${String(plan.totalItems)} 项`;
}

function timeLabel(plan: LearningPlanSummary): string {
  if (plan.status === "CURRENT") {
    return `约 ${String(plan.remainingMinutes ?? plan.estimatedMinutes)} 分钟`;
  }
  if (plan.status === "UPCOMING") {
    return `预计 ${String(plan.estimatedMinutes)} 分钟`;
  }
  return `${String(plan.estimatedMinutes)} 分钟`;
}

function statusLabel(status: LearningPlanStatus): string {
  if (status === "CURRENT") {
    return "进行中";
  }
  if (status === "UPCOMING") {
    return "待开始";
  }
  return "当前会话已完成";
}

function actionLabel(status: LearningPlanStatus): string {
  if (status === "CURRENT") {
    return "打开计划";
  }
  if (status === "UPCOMING") {
    return "查看计划";
  }
  return "查看计划";
}

function orderedPlanNumber(plan: LearningPlanSummary, ordinalByPlanId: ReadonlyMap<string, number>): string {
  const ordinal = ordinalByPlanId.get(plan.id) ?? 0;
  return String(ordinal).padStart(2, "0");
}

function PlanListHeader({ document }: { readonly document: LearningPlanListDocument }) {
  return (
    <header className="learning-plan-header" data-od-id="learning-plan-header">
      <div className="learning-plan-heading">
        <nav aria-label="面包屑" className="learning-plan-breadcrumb">
          <span>每日任务</span>
          <i aria-hidden="true">/</i>
          <span>学习计划</span>
        </nav>
        <h1 data-od-id="learning-plan-title">学习计划</h1>
        <div className="learning-plan-subtitle">
          <p>查看当前、即将开始与已完成的学习安排</p>
          <span>Fixture 演示</span>
        </div>
      </div>
      <time className="learning-plan-date" dateTime={document.date}>
        <strong>{document.date}</strong>
        <span>{document.weekdayEnglish}</span>
        <small>{document.lunarDate}　{document.weekdayChinese}</small>
      </time>
    </header>
  );
}

function PlanSummaryHero({
  counts,
  currentPlan,
  openingPlanId,
  onOpenPlan,
}: {
  readonly counts: LearningPlanCounts;
  readonly currentPlan: LearningPlanSummary | undefined;
  readonly openingPlanId: string | null;
  readonly onOpenPlan: (plan: LearningPlanSummary) => void;
}) {
  const currentPlanOpening = currentPlan?.id === openingPlanId;

  return (
    <section aria-labelledby="plan-summary-title" className="plan-summary-hero" data-od-id="plan-summary-hero">
      <div className="plan-summary-number">
        <strong aria-label={`${String(counts.total)} 份学习计划`}>{counts.total}</strong>
      </div>
      <div className="plan-summary-copy">
        <h2 id="plan-summary-title">份学习计划</h2>
        <p>按当前学习顺序查看计划，并从正在进行的任务继续。</p>
        <dl className="plan-summary-counts" aria-label="计划分布">
          <div>
            <dt>当前</dt>
            <dd>{counts.current}</dd>
          </div>
          <div>
            <dt>即将开始</dt>
            <dd>{counts.upcoming}</dd>
          </div>
          <div>
            <dt>已完成</dt>
            <dd>{counts.completed}</dd>
          </div>
        </dl>
        <p className="learning-plan-caution">演示计划不代表真实服务端生成或掌握判断。</p>
      </div>
      <button
        className="primary-button plan-summary-primary"
        data-od-id="continue-current-plan"
        disabled={currentPlan === undefined || openingPlanId !== null}
        onClick={() => {
          if (currentPlan !== undefined) {
            onOpenPlan(currentPlan);
          }
        }}
        type="button"
      >
        {currentPlanOpening ? "正在打开…" : "继续当前计划"}
      </button>
    </section>
  );
}

function PlanStatusTabs({
  selected,
  onChange,
}: {
  readonly selected: PlanStatusFilter;
  readonly onChange: (value: PlanStatusFilter) => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    const key = event.key;
    if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") {
      return;
    }
    event.preventDefault();
    const lastIndex = statusTabOptions.length - 1;
    const targetIndex =
      key === "Home"
        ? 0
        : key === "End"
          ? lastIndex
          : key === "ArrowRight"
            ? index === lastIndex
              ? 0
              : index + 1
            : index === 0
              ? lastIndex
              : index - 1;
    const target = statusTabOptions[targetIndex];
    if (target === undefined) {
      return;
    }
    onChange(target.value);
    window.requestAnimationFrame(() => {
      tabRefs.current[targetIndex]?.focus();
    });
  }

  return (
    <div aria-label="计划状态筛选" className="plan-status-tabs" role="tablist">
      {statusTabOptions.map((option, index) => (
        <button
          aria-selected={selected === option.value}
          className={selected === option.value ? "is-selected" : ""}
          key={option.value}
          onClick={() => {
            onChange(option.value);
          }}
          onKeyDown={(event) => {
            moveFocus(event, index);
          }}
          ref={(node) => {
            tabRefs.current[index] = node;
          }}
          role="tab"
          tabIndex={selected === option.value ? 0 : -1}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PlanFilters({
  filters,
  onFiltersChange,
}: {
  readonly filters: PlanListFilters;
  readonly onFiltersChange: (filters: PlanListFilters) => void;
}) {
  return (
    <div className="plan-filters" aria-label="计划筛选器">
      <label className="compact-select plan-filter-select">
        <span className="sr-only">选择学科</span>
        <select
          aria-label="选择学科"
          onChange={(event) => {
            onFiltersChange({ ...filters, subject: parseSubjectFilter(event.currentTarget.value) });
          }}
          value={filters.subject}
        >
          {subjectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="chevronRight" size={16} />
      </label>
      <label className="compact-select plan-filter-select">
        <span className="sr-only">选择时间范围</span>
        <select
          aria-label="选择时间范围"
          onChange={(event) => {
            onFiltersChange({ ...filters, range: parseRangeFilter(event.currentTarget.value) });
          }}
          value={filters.range}
        >
          <option value="current-week">本周</option>
        </select>
        <Icon name="chevronRight" size={16} />
      </label>
    </div>
  );
}

function PlanProgress({ plan }: { readonly plan: LearningPlanSummary }) {
  const progress = plan.totalItems === 0 ? 0 : Math.round((plan.completedItems / plan.totalItems) * 100);

  return (
    <span
      aria-label={`${plan.title}进度 ${String(plan.completedItems)} / ${String(plan.totalItems)} 项`}
      aria-valuemax={plan.totalItems}
      aria-valuemin={0}
      aria-valuenow={plan.completedItems}
      className="plan-row-progress"
      role="progressbar"
    >
      <span>{taskCountLabel(plan)}</span>
      {plan.status === "CURRENT" ? (
        <i aria-hidden="true">
          <b style={{ width: `${String(progress)}%` }} />
        </i>
      ) : null}
    </span>
  );
}

function PlanRow({
  plan,
  ordinal,
  opening,
  blocked,
  onOpenPlan,
  buttonRef,
}: {
  readonly plan: LearningPlanSummary;
  readonly ordinal: string;
  readonly opening: boolean;
  readonly blocked: boolean;
  readonly onOpenPlan: (plan: LearningPlanSummary) => void;
  readonly buttonRef: (node: HTMLButtonElement | null) => void;
}) {
  const visualAction = opening ? "正在打开…" : actionLabel(plan.status);

  return (
    <li>
      <button
        aria-label={`${ordinal}，${plan.subjectLabel}，${plan.title}，${statusLabel(plan.status)}，${actionLabel(plan.status)}`}
        className={`plan-row is-${plan.status.toLowerCase()}`}
        data-od-id={`learning-plan-${plan.id}`}
        disabled={blocked}
        onClick={() => {
          onOpenPlan(plan);
        }}
        ref={buttonRef}
        type="button"
      >
        <span className="plan-row-ordinal">{ordinal}</span>
        <span className="plan-row-subject">{plan.subjectLabel}</span>
        <span className="plan-row-title">
          <strong>{plan.title}</strong>
          {plan.supportingLabel.length === 0 ? null : <small>{plan.supportingLabel}</small>}
        </span>
        <span className="plan-row-date">{dateLabel(plan)}</span>
        <PlanProgress plan={plan} />
        <span className="plan-row-time">{timeLabel(plan)}</span>
        <span className="plan-row-state">{statusLabel(plan.status)}</span>
        <span className="plan-row-action">{visualAction}</span>
        <Icon className="plan-row-chevron" name="chevronRight" size={18} />
      </button>
    </li>
  );
}

function PlanGroup({
  id,
  title,
  plans,
  ordinalByPlanId,
  openingPlanId,
  onOpenPlan,
  registerPlanButton,
  note,
}: {
  readonly id: string;
  readonly title: string;
  readonly plans: readonly LearningPlanSummary[];
  readonly ordinalByPlanId: ReadonlyMap<string, number>;
  readonly openingPlanId: string | null;
  readonly onOpenPlan: (plan: LearningPlanSummary) => void;
  readonly registerPlanButton: (planId: string) => (node: HTMLButtonElement | null) => void;
  readonly note?: string;
}) {
  if (plans.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={id} className="plan-group">
      <h2 id={id}>{title}</h2>
      <ol aria-label={title}>
        {plans.map((plan) => (
                  <PlanRow
            blocked={openingPlanId !== null}
            buttonRef={registerPlanButton(plan.id)}
            key={plan.id}
            onOpenPlan={onOpenPlan}
            opening={openingPlanId === plan.id}
            ordinal={orderedPlanNumber(plan, ordinalByPlanId)}
            plan={plan}
          />
        ))}
      </ol>
      {note === undefined ? null : <p className="learning-plan-caution plan-group-note">{note}</p>}
    </section>
  );
}

function LearningPlanEmptyState({ onReturnToday }: { readonly onReturnToday: () => void }) {
  return (
    <section className="learning-plan-empty" data-od-id="learning-plan-empty" role="status">
      <Icon name="info" size={24} />
      <div>
        <h2>还没有学习计划</h2>
        <p>当前没有可显示的计划。计划服务可用后，系统会根据合法课程配置提供安排。</p>
        <button className="secondary-button" onClick={onReturnToday} type="button">
          返回今日学习
        </button>
      </div>
    </section>
  );
}

function LearningPlanNoResultsState({ onClearFilters }: { readonly onClearFilters: () => void }) {
  return (
    <section className="learning-plan-empty" data-od-id="learning-plan-no-results" role="status">
      <Icon name="info" size={24} />
      <div>
        <h2>当前筛选没有计划</h2>
        <p>调整状态、学科或时间范围后再查看。</p>
        <button className="secondary-button" onClick={onClearFilters} type="button">
          清除筛选
        </button>
      </div>
    </section>
  );
}

function LearningPlanActions({
  onReturnToday,
}: {
  readonly onReturnToday: () => void;
}) {
  return (
    <footer className="learning-plan-actions" data-od-id="learning-plan-actions">
      <button className="learning-plan-return" onClick={onReturnToday} type="button">
        返回今日学习
      </button>
      <details className="learning-plan-explanation">
        <summary>
          <span>查看计划说明</span>
          <Icon name="chevronRight" size={18} />
        </summary>
        <p>当前列表按计划状态、开始日期和完成日期稳定排序；筛选只改变可见结果，不修改源数据或服务端状态。</p>
      </details>
    </footer>
  );
}

function groupedPlans(plans: readonly LearningPlanSummary[]): {
  readonly current: readonly LearningPlanSummary[];
  readonly upcoming: readonly LearningPlanSummary[];
  readonly completed: readonly LearningPlanSummary[];
} {
  return {
    current: plans.filter((plan) => plan.status === "CURRENT"),
    upcoming: plans.filter((plan) => plan.status === "UPCOMING"),
    completed: plans.filter((plan) => plan.status === "COMPLETED_IN_CURRENT_SESSION"),
  };
}

export interface StudentLearningPlanListViewProps {
  readonly currentUser: CurrentUserResult;
  readonly document: LearningPlanListDocument;
  readonly onOpenPlan: (planId: string) => void;
  readonly onReturnToday: () => void;
}

export function StudentLearningPlanListView({
  currentUser,
  document,
  onOpenPlan,
  onReturnToday,
}: StudentLearningPlanListViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [openingPlanId, setOpeningPlanId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState("");
  const openingTimerRef = useRef<number | null>(null);
  const planButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const rawStatusFilter = searchParams.get("status");
  const rawSubjectFilter = searchParams.get("subject");
  const rawRangeFilter = searchParams.get("range");
  const filters = useMemo<PlanListFilters>(
    () => ({
      status: parseStatusFilter(rawStatusFilter),
      subject: parseSubjectFilter(rawSubjectFilter),
      range: parseRangeFilter(rawRangeFilter),
    }),
    [rawRangeFilter, rawStatusFilter, rawSubjectFilter],
  );

  const sortedPlans = useMemo(() => sortLearningPlans(document.plans), [document.plans]);
  const counts = useMemo(() => summarizeLearningPlans(document.plans), [document.plans]);
  const ordinalByPlanId = useMemo(() => {
    const result = new Map<string, number>();
    sortedPlans.forEach((plan, index) => {
      result.set(plan.id, index + 1);
    });
    return result;
  }, [sortedPlans]);
  const filteredPlans = useMemo(
    () => filterLearningPlans(sortedPlans, document, filters),
    [document, filters, sortedPlans],
  );
  const groups = useMemo(() => groupedPlans(filteredPlans), [filteredPlans]);
  const currentPlan = sortedPlans.find((plan) => plan.status === "CURRENT");

  useEffect(() => () => {
    if (openingTimerRef.current !== null) {
      window.clearTimeout(openingTimerRef.current);
    }
  }, []);

  useEffect(() => {
    setLiveMessage(`当前筛选显示 ${String(filteredPlans.length)} 份计划。`);
  }, [filteredPlans.length, filters.range, filters.status, filters.subject]);

  useEffect(() => {
    const focusPlanId = searchParams.get("focusPlan");
    if (focusPlanId === null) {
      return;
    }
    const target = planButtonRefs.current.get(focusPlanId);
    if (target === undefined) {
      return;
    }
    target.focus();
    const next = new URLSearchParams(searchParams);
    next.delete("focusPlan");
    setSearchParams(next, { replace: true });
  }, [filteredPlans, searchParams, setSearchParams]);

  function updateFilters(nextFilters: PlanListFilters): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "plans");
    next.set("status", nextFilters.status);
    next.set("subject", nextFilters.subject);
    next.set("range", nextFilters.range);
    next.delete("focusPlan");
    setSearchParams(next, { replace: true });
  }

  function clearFilters(): void {
    updateFilters({ status: "all", subject: "all", range: "current-week" });
  }

  function openPlan(plan: LearningPlanSummary): void {
    if (openingPlanId !== null) {
      return;
    }
    setOpeningPlanId(plan.id);
    openingTimerRef.current = window.setTimeout(() => {
      onOpenPlan(plan.id);
    }, 160);
  }

  function registerPlanButton(planId: string): (node: HTMLButtonElement | null) => void {
    return (node) => {
      if (node === null) {
        planButtonRefs.current.delete(planId);
      } else {
        planButtonRefs.current.set(planId, node);
      }
    };
  }

  return (
    <div className="app-shell learning-plan-shell">
      <a className="skip-link" href="#learning-plan-main">
        跳到主要内容
      </a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive />
      <main className="learning-plan-canvas" data-od-id="student-learning-plans" id="learning-plan-main">
        <div className="learning-plan-layout">
          <div className="learning-plan-primary">
            <PlanListHeader document={document} />
            <PlanSummaryHero
              counts={counts}
              currentPlan={currentPlan}
              onOpenPlan={openPlan}
              openingPlanId={openingPlanId}
            />

            <section aria-label="计划筛选" className="learning-plan-filter-bar">
              <PlanStatusTabs
                onChange={(status) => {
                  updateFilters({ ...filters, status });
                }}
                selected={filters.status}
              />
              <PlanFilters filters={filters} onFiltersChange={updateFilters} />
            </section>

            <div className="sr-only" role="status" aria-live="polite">
              {liveMessage}
            </div>

            {document.plans.length === 0 ? (
              <LearningPlanEmptyState onReturnToday={onReturnToday} />
            ) : filteredPlans.length === 0 ? (
              <LearningPlanNoResultsState onClearFilters={clearFilters} />
            ) : (
              <>
                <PlanGroup
                  id="current-plan-group-title"
                  onOpenPlan={openPlan}
                  openingPlanId={openingPlanId}
                  ordinalByPlanId={ordinalByPlanId}
                  plans={groups.current}
                  registerPlanButton={registerPlanButton}
                  title="当前计划"
                />
                <PlanGroup
                  id="upcoming-plan-group-title"
                  onOpenPlan={openPlan}
                  openingPlanId={openingPlanId}
                  ordinalByPlanId={ordinalByPlanId}
                  plans={groups.upcoming}
                  registerPlanButton={registerPlanButton}
                  title="即将开始"
                />
                <PlanGroup
                  id="completed-plan-group-title"
                  note="完成状态是否同步到服务端仍待确认。"
                  onOpenPlan={openPlan}
                  openingPlanId={openingPlanId}
                  ordinalByPlanId={ordinalByPlanId}
                  plans={groups.completed}
                  registerPlanButton={registerPlanButton}
                  title="已完成"
                />
              </>
            )}

            <LearningPlanActions onReturnToday={onReturnToday} />

            <details className="learning-plan-rail-collapsible">
              <summary>
                <span>计划与服务信息</span>
                <Icon name="chevronRight" size={18} />
              </summary>
              <div>
                <LearningPlanListRightRailContent
                  counts={counts}
                  currentPlan={currentPlan}
                  onOpenPlan={openPlan}
                  openingPlanId={openingPlanId}
                  weekLabel={`${document.weekStart} — ${document.weekEnd}`}
                />
              </div>
            </details>
          </div>

          <LearningPlanListRightRail
            counts={counts}
            currentPlan={currentPlan}
            onOpenPlan={openPlan}
            openingPlanId={openingPlanId}
            weekLabel={`${document.weekStart} — ${document.weekEnd}`}
          />
        </div>
      </main>
    </div>
  );
}

function LearningPlanLoadingSurface() {
  return (
    <div aria-label="正在加载学习计划" className="page-loading" role="status">
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

function LearningPlanStatePage({
  currentUser,
  title,
  description,
  code,
  onReturnToday,
}: {
  readonly currentUser: CurrentUserResult;
  readonly title: string;
  readonly description: string;
  readonly code?: string;
  readonly onReturnToday: () => void;
}) {
  return (
    <div className="app-shell learning-plan-shell">
      <a className="skip-link" href="#learning-plan-main">
        跳到主要内容
      </a>
      <Sidebar currentItemId="daily-tasks" currentUser={currentUser} demoActive={false} />
      <main className="paper-canvas service-state-page" id="learning-plan-main">
        <header className="page-header compact">
          <div>
            <h1>学习计划</h1>
            <p>查看当前、即将开始与已完成的学习安排</p>
          </div>
          <span aria-hidden="true" className="page-header-rule" />
        </header>
        <StatusPanel description={description} title={title} />
        {code === undefined ? null : <code className="learning-plan-service-code">{code}</code>}
        <button className="secondary-button" onClick={onReturnToday} type="button">
          返回今日学习
        </button>
      </main>
    </div>
  );
}

function LearningPlanLoadStateSurface({
  currentUser,
  state,
  onReturnToday,
}: {
  readonly currentUser: CurrentUserResult;
  readonly state: Exclude<LearningPlanListLoadState, { readonly status: "READY_FIXTURE" } | { readonly status: "LOADING" }>;
  readonly onReturnToday: () => void;
}) {
  if (state.status === "EMPTY") {
    return (
      <LearningPlanStatePage
        currentUser={currentUser}
        description="当前没有可显示的计划。计划服务可用后，系统会根据合法课程配置提供安排。"
        onReturnToday={onReturnToday}
        title="还没有学习计划"
      />
    );
  }
  if (state.status === "OFFLINE_READ_ONLY" && state.cachedDocument !== null) {
    return (
      <StudentLearningPlanListView
        currentUser={currentUser}
        document={state.cachedDocument}
        onOpenPlan={() => undefined}
        onReturnToday={onReturnToday}
      />
    );
  }

  const copy = state.status === "SESSION_EXPIRED"
    ? ["学生会话已过期", "请重新建立学生会话后再读取本人计划；当前页面不会代入其他身份。"] as const
    : state.status === "GENERATING"
      ? ["学习计划生成中", "计划生成是服务端写操作；当前页面不会用无限加载或虚构推荐代替真实结果。"] as const
      : state.status === "OFFLINE_READ_ONLY"
        ? ["当前处于离线只读状态", "没有可验证的学习计划缓存，因此不会把过期内容显示为最新计划。"] as const
        : state.status === "NO_FILTER_RESULTS"
          ? ["当前筛选没有计划", "调整状态、学科或时间范围后再查看。"] as const
          : ["学习计划列表暂时不可用", "当前没有真实 LearningPlan List adapter；生产环境不会回退到演示计划。"] as const;

  const codeProps = state.status === "SERVICE_UNAVAILABLE" ? { code: state.reason } : {};
  return (
    <LearningPlanStatePage
      {...codeProps}
      currentUser={currentUser}
      description={copy[1]}
      onReturnToday={onReturnToday}
      title={copy[0]}
    />
  );
}

export function StudentLearningPlanListRoute({ currentUser }: { readonly currentUser: CurrentUserResult }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isStudent = currentUser.status === "authenticated" && currentUser.user.roles.includes("STUDENT");
  const state = useLearningPlans(isStudent ? currentUser.user.id : undefined);

  function returnToday(): void {
    void navigate("/student/today");
  }

  function openPlan(planId: string): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "plan-detail");
    next.set("plan", planId);
    next.delete("focusPlan");
    setSearchParams(next, { replace: false });
  }

  function returnToList(): void {
    const planId = searchParams.get("plan");
    const next = new URLSearchParams(searchParams);
    next.set("view", "plans");
    next.delete("plan");
    if (planId !== null) {
      next.set("focusPlan", planId);
    }
    setSearchParams(next, { replace: false });
  }

  if (currentUser.status === "authenticated" && !isStudent) {
    return (
      <LearningPlanStatePage
        currentUser={currentUser}
        description="学习计划列表只读取学生本人的 OWN 数据；家长和管理员账号不会在这里代入学生身份。"
        onReturnToday={returnToday}
        title="当前账号不是学生账号"
      />
    );
  }

  if (searchParams.get("view") === "plan-detail") {
    const planId = searchParams.get("plan");
    if (planId === null) {
      return (
        <LearningPlanDetailStateSurface
          currentUser={currentUser}
          onReturnToList={returnToList}
          state={{ status: "NOT_FOUND_OR_DENIED" }}
        />
      );
    }
    return (
      <StudentLearningPlanDetailRoute
        currentUser={currentUser}
        onReturnToday={returnToday}
        onReturnToList={returnToList}
        planId={planId}
      />
    );
  }

  if (state.status === "LOADING") {
    return <LearningPlanLoadingSurface />;
  }
  if (state.status === "READY_FIXTURE") {
    return (
      <StudentLearningPlanListView
        currentUser={currentUser}
        document={state.document}
        onOpenPlan={openPlan}
        onReturnToday={returnToday}
      />
    );
  }
  return <LearningPlanLoadStateSurface currentUser={currentUser} onReturnToday={returnToday} state={state} />;
}
