import { useEffect, useMemo, useState } from "react";

import { Icon } from "../../../components/Icon";
import type { KnowledgeIntroDocument } from "./types";

export interface KnowledgeIntroRightRailProps {
  readonly document: KnowledgeIntroDocument;
}

function RailSection({
  className,
  title,
  children,
}: {
  readonly className: string;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={`knowledge-rail-section ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function KnowledgeIntroRightRail({ document }: KnowledgeIntroRightRailProps) {
  const storageKey = useMemo(() => `ql:knowledge-intro:notes:v1:${document.courseId}`, [document.courseId]);
  const [notes, setNotes] = useState(() => {
    try {
      return window.sessionStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, notes);
    } catch {
      // Storage can be unavailable in hardened browser contexts; the controlled value remains usable.
    }
  }, [notes, storageKey]);

  return (
    <aside className="knowledge-intro-right-rail" data-od-id="knowledge-right-rail" aria-label="知识导入辅助信息">
      <RailSection className="rail-goals" title="本步目标">
        <ul className="step-goal-list">
          {document.goals.map((goal) => (
            <li key={goal}>
              <Icon name="check" size={18} />
              <span>{goal}</span>
            </li>
          ))}
        </ul>
      </RailSection>

      <RailSection className="rail-notes" title="本课笔记">
        <label className="learning-notes-field">
          <span className="sr-only">记录本课笔记</span>
          <textarea
            aria-describedby="knowledge-notes-status"
            autoComplete="off"
            data-od-id="knowledge-notes"
            maxLength={500}
            name="knowledgeIntroNotes"
            onChange={(event) => { setNotes(event.target.value); }}
            placeholder="记录你的理解、疑问或发现……"
            value={notes}
          />
        </label>
        <div className="rail-action-row">
          <button className="secondary-button" disabled data-od-id="knowledge-save-notes" type="button">
            保存笔记
          </button>
          <span>{notes.length} / 500</span>
        </div>
        <p aria-live="polite" className="service-boundary-copy" id="knowledge-notes-status" role="status">
          {notes.length === 0
            ? "笔记服务尚未接入；输入会临时保留在当前浏览器标签页。"
            : "已保留为本机临时草稿，尚未同步到学习系统。"}
        </p>
      </RailSection>

      <RailSection className="rail-evidence" title="学习证据">
        <p>当前内容是开发 Fixture，不能写入生产学习证据。</p>
        <button className="secondary-button" disabled data-od-id="knowledge-save-evidence" type="button">
          保存为学习证据
        </button>
      </RailSection>

      <RailSection className="rail-ai" title="AI 辅导">
        <p className="service-boundary-copy">
          当前演示内容没有经过审核的教材证据与真实单元上下文，暂不能发起辅导。
        </p>
        <button className="secondary-button" disabled data-od-id="knowledge-open-tutor" type="button">
          进入辅导
        </button>
      </RailSection>

      <RailSection className="rail-resources" title="本步资料">
        <div className="step-resource-list">
          {document.resources.map((resource) =>
            resource.state === "FIXTURE_AVAILABLE" ? (
              <details data-od-id={`knowledge-resource-${resource.id}`} key={resource.id}>
                <summary>
                  <Icon name="bookOpen" size={18} />
                  <span>
                    <strong>{resource.title}</strong>
                    <small>{resource.metadata}</small>
                  </span>
                  <Icon className="resource-chevron" name="chevronRight" size={16} />
                </summary>
                <p>{resource.fixtureSummary}</p>
              </details>
            ) : (
              <div aria-disabled="true" className="step-resource-unavailable" key={resource.id}>
                <Icon name="fileText" size={18} />
                <span>
                  <strong>{resource.title}</strong>
                  <small>{resource.metadata}</small>
                </span>
              </div>
            ),
          )}
        </div>
      </RailSection>

      <div className="family-privacy-notice rail-privacy" data-od-id="knowledge-family-privacy">
        <Icon name="shieldCheck" size={20} />
        <p>笔记、提问与学习证据仅允许在授权家庭边界内使用。</p>
      </div>
    </aside>
  );
}
