import { Icon } from "../../../components/Icon";
import { LearningPlanRailRows, LearningPlanRailSection } from "./LearningPlanListRightRail";
import type { LearningPlanCompletionCriterion, LearningPlanDetailDocument, LearningPlanItem } from "./types";
import { currentLearningPlanItems } from "./types";

export interface LearningPlanDetailRightRailContentProps {
  readonly document: LearningPlanDetailDocument;
  readonly entering: boolean;
  readonly onContinue: () => void;
}

export function LearningPlanDetailRightRailContent({
  document,
  entering,
  onContinue,
}: LearningPlanDetailRightRailContentProps) {
  const currentItem = currentLearningPlanItems(document.items)[0];
  const criteriaById = new Map(document.completionCriteria.map((criterion) => [criterion.id, criterion]));

  function currentItemLabel(item: LearningPlanItem | undefined): string {
    return item === undefined ? "当前任务" : `第 ${String(item.number)} 项`;
  }

  function criterionValue(id: string): string {
    const criterion: LearningPlanCompletionCriterion | undefined = criteriaById.get(id);
    if (criterion === undefined) {
      return "不可用";
    }
    if (criterion.status === "WAITING_FOR_PRACTICE") {
      return "待练习";
    }
    if (criterion.status === "WAITING_FOR_SERVICE") {
      return "待服务确认";
    }
    return `${String(criterion.currentValue ?? 0)} / ${String(criterion.totalValue ?? 0)}`;
  }

  return (
    <>
      <LearningPlanRailSection title="计划摘要">
        <LearningPlanRailRows
          rows={[
            ["学科", document.subjectLabel, "default"],
            ["状态", "进行中", "accent"],
            ["日期", `${document.startsOn.slice(5).replace("-", ".")} — ${document.endsOn.slice(5).replace("-", ".")}`, "default"],
            ["计划进度", `${String(document.completedItems)} / ${String(document.totalItems)} 项`, "default"],
            ["总时长", `${String(document.totalMinutes)} 分钟`, "default"],
            ["预计剩余", `${String(document.remainingMinutes)} 分钟`, "default"],
          ]}
        />
      </LearningPlanRailSection>

      <LearningPlanRailSection title="当前任务">
        <LearningPlanRailRows
          rows={[
            [currentItemLabel(currentItem), "", "default"],
            [currentItem?.title ?? "任务未确认", "", "default"],
            ["预计", `${String(currentItem?.estimatedMinutes ?? 0)} 分钟`, "default"],
            ["状态", "当前", "accent"],
          ]}
        />
        <button
          className="learning-plan-rail-link"
          data-od-id="plan-detail-rail-continue"
          disabled={entering}
          onClick={onContinue}
          type="button"
        >
          <span>{entering ? "正在进入…" : `继续第 ${String(document.currentItemNumber)} 项`}</span>
          <Icon name="chevronRight" size={16} />
        </button>
      </LearningPlanRailSection>

      <LearningPlanRailSection title="完成条件">
        <LearningPlanRailRows
          rows={[
            ["任务步骤", criterionValue("task-steps"), "default"],
            ["练习提交", criterionValue("practice-submissions"), "default"],
            ["订正状态", criterionValue("mistake-correction"), "warning"],
            ["个人归纳", criterionValue("personal-summary"), "default"],
          ]}
        />
      </LearningPlanRailSection>

      <LearningPlanRailSection title="计划依据">
        <LearningPlanRailRows
          rows={[
            ["课程位置", "演示状态", "default"],
            ["计划顺序", "当前优先", "default"],
            ["掌握判断", "不可用", "warning"],
            ["最近更新", "未同步", "warning"],
          ]}
        />
        <p className="learning-plan-rail-caution">当前计划依据仅为 Fixture，不代表真实诊断。</p>
      </LearningPlanRailSection>

      <LearningPlanRailSection title="服务状态">
        <LearningPlanRailRows
          rows={[
            ["计划详情", "演示数据", "default"],
            ["进度同步", "未接入", "warning"],
            ["完成事件", "未接入", "warning"],
            ["计划替换", "不可用", "warning"],
          ]}
        />
        <code>{document.serviceState}</code>
        <p className="learning-plan-rail-caution">生产环境不得回退到演示计划详情。</p>
      </LearningPlanRailSection>

      <div className="learning-plan-privacy-note">
        <Icon name="lock" size={18} />
        <p>计划、任务与学习证据仅在授权家庭范围内使用。</p>
      </div>
    </>
  );
}

export function LearningPlanDetailRightRail(props: LearningPlanDetailRightRailContentProps) {
  return (
    <aside aria-label="计划详情与服务信息" className="learning-plan-right-rail plan-detail-right-rail" data-od-id="plan-detail-right-rail">
      <LearningPlanDetailRightRailContent {...props} />
    </aside>
  );
}
