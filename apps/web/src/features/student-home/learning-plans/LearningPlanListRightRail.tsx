import { Icon } from "../../../components/Icon";
import type { LearningPlanCounts, LearningPlanSummary } from "./types";

export type LearningPlanRailRowTone = "accent" | "warning" | "default";

interface LearningPlanListRightRailContentProps {
  readonly counts: LearningPlanCounts;
  readonly currentPlan: LearningPlanSummary | undefined;
  readonly weekLabel: string;
  readonly openingPlanId: string | null;
  readonly onOpenPlan: (plan: LearningPlanSummary) => void;
}

export function LearningPlanRailSection({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <section className="learning-plan-rail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function LearningPlanRailRows({ rows }: { readonly rows: readonly (readonly [string, string, LearningPlanRailRowTone])[] }) {
  return (
    <dl className="learning-plan-rail-rows">
      {rows.map(([label, value, tone]) => (
        <div key={`${label}-${value}`}>
          <dt>{label}</dt>
          <dd className={`is-${tone}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function LearningPlanListRightRailContent({
  counts,
  currentPlan,
  weekLabel,
  openingPlanId,
  onOpenPlan,
}: LearningPlanListRightRailContentProps) {
  const currentPlanOpening = currentPlan?.id === openingPlanId;

  return (
    <>
      <LearningPlanRailSection title="计划概览">
        <LearningPlanRailRows
          rows={[
            ["全部计划", String(counts.total), "default"],
            ["当前", String(counts.current), "accent"],
            ["即将开始", String(counts.upcoming), "accent"],
            ["已完成", String(counts.completed), "default"],
            ["筛选范围", "本周", "default"],
          ]}
        />
      </LearningPlanRailSection>

      <LearningPlanRailSection title="当前计划">
        {currentPlan === undefined ? (
          <p className="learning-plan-rail-muted">当前没有正在进行的计划。</p>
        ) : (
          <>
            <LearningPlanRailRows
              rows={[
                ["学科", currentPlan.subjectLabel, "default"],
                ["计划", currentPlan.title, "default"],
                ["进度", `${String(currentPlan.completedItems)} / ${String(currentPlan.totalItems)} 项`, "default"],
                ["预计剩余", `${String(currentPlan.remainingMinutes ?? 0)} 分钟`, "default"],
              ]}
            />
            <button
              className="learning-plan-rail-link"
              data-od-id="plan-right-rail-continue"
              disabled={openingPlanId !== null}
              onClick={() => {
                onOpenPlan(currentPlan);
              }}
              type="button"
            >
              <span>{currentPlanOpening ? "正在打开…" : "继续计划"}</span>
              <Icon name="chevronRight" size={16} />
            </button>
          </>
        )}
      </LearningPlanRailSection>

      <LearningPlanRailSection title="本周范围">
        <LearningPlanRailRows
          rows={[
            [weekLabel, "", "default"],
            ["已安排学科", String(counts.scheduledSubjects), "default"],
            ["预计总时长", `${String(counts.totalEstimatedMinutes)} 分钟`, "default"],
            ["计划顺序", "当前优先", "default"],
          ]}
        />
      </LearningPlanRailSection>

      <LearningPlanRailSection title="计划依据">
        <LearningPlanRailRows
          rows={[
            ["年级与学科", "演示配置", "default"],
            ["课程位置", "演示状态", "default"],
            ["独立证据", "尚未产生", "default"],
            ["掌握判断", "不可用", "warning"],
          ]}
        />
        <p className="learning-plan-rail-caution">计划排序不根据页面停留、提示点击或 AI 对话推断掌握。</p>
      </LearningPlanRailSection>

      <LearningPlanRailSection title="服务状态">
        <LearningPlanRailRows
          rows={[
            ["计划列表", "演示数据", "default"],
            ["计划同步", "未接入", "warning"],
            ["计划生成", "未接入", "warning"],
            ["完成记录", "待确认", "warning"],
          ]}
        />
        <code>LEARNING_PLAN_LIST_SERVICE_UNAVAILABLE</code>
        <p className="learning-plan-rail-caution">生产环境不得回退到演示计划。</p>
      </LearningPlanRailSection>

      <div className="learning-plan-privacy-note">
        <Icon name="lock" size={18} />
        <p>计划、任务与学习证据仅在授权家庭范围内使用。</p>
      </div>
    </>
  );
}

export function LearningPlanListRightRail(props: LearningPlanListRightRailContentProps) {
  return (
    <aside aria-label="计划与服务信息" className="learning-plan-right-rail" data-od-id="learning-plan-right-rail">
      <LearningPlanListRightRailContent {...props} />
    </aside>
  );
}
