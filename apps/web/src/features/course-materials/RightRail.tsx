import { Icon } from "../../components/Icon";
import type { ReactNode } from "react";
import type { CourseCatalog, CourseSummary, RecentMaterial, SubjectCode } from "./types";

export interface RightRailProps {
  readonly catalog: CourseCatalog;
  readonly visibleCourses: readonly CourseSummary[];
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly onMaterialSelect: (subjectCode: SubjectCode, title: string) => void;
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace("/", "-");
}

function RecentMaterialRow({
  material,
  onSelect,
}: {
  readonly material: RecentMaterial;
  readonly onSelect: (subjectCode: SubjectCode, title: string) => void;
}) {
  return (
    <button
      className="recent-material-row"
      onClick={() => { onSelect(material.subjectCode, material.title); }}
      type="button"
    >
      <Icon name="fileText" size={20} />
      <span>
        <strong>{material.title}</strong>
        <small>{material.materialTypeLabel}</small>
      </span>
      <time dateTime={material.usedAt}>{formatShortDate(material.usedAt)}</time>
    </button>
  );
}

function RailSectionTitle({ title, action }: { readonly title: string; readonly action?: ReactNode }) {
  return (
    <div className="rail-section-title">
      <div>
        <h2>{title}</h2>
        {action}
      </div>
      <span aria-hidden="true" />
    </div>
  );
}

function RightRailContent({
  catalog,
  expanded,
  onExpandedChange,
  onMaterialSelect,
  visibleCourses,
  idPrefix,
}: RightRailProps & { readonly idPrefix: string }) {
  const visibleMaterials = expanded ? catalog.recentMaterials : catalog.recentMaterials.slice(0, 3);

  return (
    <>
      <RailSectionTitle
        action={
          <button className="text-button" onClick={() => { onExpandedChange(!expanded); }} type="button">
            {expanded ? "收起" : "查看全部"}
          </button>
        }
        title="最近使用"
      />
      <div className="recent-materials">
        {visibleMaterials.map((material) => (
          <RecentMaterialRow key={material.id} material={material} onSelect={onMaterialSelect} />
        ))}
      </div>

      <RailSectionTitle
        action={
          <button
            aria-describedby={`${idPrefix}-textbook-edit-unavailable`}
            className="text-button"
            disabled
            type="button"
          >
            编辑
          </button>
        }
        title="教材版本"
      />
      <p className="sr-only" id={`${idPrefix}-textbook-edit-unavailable`}>
        教材设置页不在本次前端实现范围内
      </p>
      <p className="textbook-period">{catalog.textbookMetadata.publisher}</p>
      <dl className="metadata-list textbook-version-list">
        {visibleCourses.map((course) => (
          <div key={`${String(course.grade)}-${course.term}-${course.subjectCode}`}>
            <dt>{course.subjectLabel}</dt>
            <dd>{course.textbookLabel.split(" · ").at(0) ?? course.textbookLabel}</dd>
          </div>
        ))}
      </dl>

      <RailSectionTitle title="资料类型" />
      <dl className="material-counts">
        {catalog.materialTypeCounts.map((item) => (
          <div key={item.materialType}>
            <dt>{item.label}</dt>
            <dd>{item.count}</dd>
          </div>
        ))}
      </dl>

      <RailSectionTitle title="服务与隐私" />
      <dl className="metadata-list service-boundary-list">
        <div>
          <dt>数据来源</dt>
          <dd>{catalog.source === "API" ? "学生 OWN 接口" : "开发演示数据"}</dd>
        </div>
        <div>
          <dt>聚合服务</dt>
          <dd>{catalog.source === "API" ? "等待进度聚合" : "未接入真实课程服务"}</dd>
        </div>
      </dl>
      <p className="rail-privacy-note">浏览课程、点击提示和打开资料不会生成掌握证据；正式学习证据必须由服务端接受。</p>
    </>
  );
}

export function RightRail(props: RightRailProps) {
  return (
    <>
      <aside className="right-rail" aria-label="课程辅助信息">
        <RightRailContent {...props} idPrefix="desktop" />
      </aside>

      <details className="right-rail-collapsible">
        <summary>
          <span>最近使用与教材信息</span>
          <Icon name="chevronRight" size={18} />
        </summary>
        <div className="right-rail-collapsible-content">
          <RightRailContent {...props} idPrefix="compact" />
        </div>
      </details>
    </>
  );
}
