import { Icon } from "../../../components/Icon";

import type { TaskDetailDocument } from "./types";

export interface TaskDetailRightRailProps {
  readonly document: TaskDetailDocument;
  readonly onRelatedEntry: (label: string) => void;
}

function RailSection({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="task-detail-rail-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function RailRows({ rows }: { readonly rows: readonly (readonly [string, string, "accent" | "warning" | "default"] )[] }) {
  return (
    <dl className="task-detail-rail-rows">
      {rows.map(([label, value, tone]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={`is-${tone}`}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TaskDetailRightRailContent({ document, onRelatedEntry }: TaskDetailRightRailProps) {
  return (
    <>
      <RailSection title="任务摘要">
        <RailRows rows={[
          ["今日优先级", `${String(document.priority)} / ${String(document.totalPriorities)}`, "accent"],
          ["学科", document.subjectLabel, "default"],
          ["当前章节", document.lessonLabel, "default"],
          ["当前步骤", "例题讲解", "default"],
          ["总时长", `${String(document.totalMinutes)} 分钟`, "default"],
          ["预计剩余", `${String(document.remainingMinutes)} 分钟`, "default"],
        ]} />
      </RailSection>

      <RailSection title="当前进度">
        <RailRows rows={[
          ["知识导入", "已完成", "default"],
          ["例题讲解", "当前", "accent"],
          ["随堂练习", "待开始", "default"],
          ["归纳总结", "待开始", "default"],
        ]} />
      </RailSection>

      <RailSection title="任务依据">
        <RailRows rows={[
          ["课程位置", "已读取演示状态", "default"],
          ["今日排序", "Fixture", "default"],
          ["独立证据", "尚未产生", "default"],
          ["掌握判断", "不可用", "default"],
        ]} />
        <p className="task-detail-rail-caution">不根据页面停留、提示点击或 AI 对话判断掌握。</p>
      </RailSection>

      <RailSection title="相关入口">
        <div className="task-detail-rail-links">
          {["课时详情", "课程资料", "学习证据规则"].map((label) => (
            <button key={label} onClick={() => { onRelatedEntry(label); }} type="button">
              <span>{label}</span>
              <Icon name="chevronRight" size={16} />
            </button>
          ))}
        </div>
      </RailSection>

      <RailSection title="服务状态">
        <RailRows rows={[
          ["任务详情", "演示数据", "default"],
          ["进度同步", "未接入", "warning"],
          ["完成提交", "未接入", "warning"],
        ]} />
        <code>{document.serviceState}</code>
        <p className="task-detail-rail-caution">生产环境不得回退到演示任务。</p>
      </RailSection>

      <div className="task-detail-privacy-note">
        <Icon name="lock" size={18} />
        <p>任务、作答与学习证据仅在授权家庭范围内使用。</p>
      </div>
    </>
  );
}

export function TaskDetailRightRail(props: TaskDetailRightRailProps) {
  return (
    <aside aria-label="任务与服务信息" className="task-detail-right-rail" data-od-id="task-detail-right-rail">
      <TaskDetailRightRailContent {...props} />
    </aside>
  );
}
