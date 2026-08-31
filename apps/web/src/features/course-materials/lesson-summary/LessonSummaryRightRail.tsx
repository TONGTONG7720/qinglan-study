import { Icon } from "../../../components/Icon";
import type { LessonSummaryDocument } from "./types";
import type { useLessonSummarySession } from "./use-lesson-summary-session";

type SummarySession = ReturnType<typeof useLessonSummarySession>;

function RailSection({ title, className, children }: { readonly title: string; readonly className: string; readonly children: React.ReactNode }) {
  return <section className={`summary-rail-section ${className}`}><h2>{title}</h2>{children}</section>;
}

export function LessonSummaryRightRail({
  document,
  session,
  onOpenContent,
  onOpenResult,
}: {
  readonly document: LessonSummaryDocument;
  readonly session: SummarySession;
  readonly onOpenContent: () => void;
  readonly onOpenResult: () => void;
}) {
  const statusItems = [
    { label: "开口方向", complete: session.completion.openingComplete },
    { label: "轴与顶点", complete: session.completion.axisVertexComplete },
    { label: "描点检查", complete: session.completion.plottingCheckComplete },
  ] as const;
  return (
    <aside aria-label="课时归纳辅助信息" className="lesson-summary-right-rail">
      <details className="lesson-summary-rail-details" open>
        <summary>课时与保存信息</summary>
        <div className="lesson-summary-rail-content">
          <RailSection className="summary-progress-rail" title="课时进度">
            <span>4 / 4</span>
            <ol>
              {document.steps.map((step, index) => <li className={step.state === "CURRENT" ? "is-current" : "is-complete"} key={step.id}><small>{step.label}</small><strong>{step.state === "CURRENT" ? "当前" : "已完成"}</strong><span>{index + 1}</span></li>)}
            </ol>
          </RailSection>

          <RailSection className="summary-status-rail" title="归纳状态">
            <dl>{statusItems.map((item) => <div className={item.complete ? "is-complete" : ""} key={item.label}><dt>{item.label}</dt><dd>{item.complete ? "已完成" : "未完成"}</dd></div>)}</dl>
            <p className="service-boundary-copy">完成 3 条归纳后才能结束本课。</p>
          </RailSection>

          <RailSection className="summary-result-rail" title="练习结果">
            <dl>
              <div><dt>题目提交</dt><dd>{document.practiceResult.submittedQuestions} / 5</dd></div>
              <div><dt>提示后修正</dt><dd>{document.practiceResult.recoveredAfterHint}</dd></div>
              <div><dt>解释待评审</dt><dd>{document.practiceResult.pendingReview}</dd></div>
              <div><dt>掌握度</dt><dd>保持不变</dd></div>
            </dl>
            <button className="text-button" onClick={onOpenResult} type="button">返回结果页</button>
          </RailSection>

          <RailSection className="summary-save-rail" title="保存状态">
            <dl>
              <div><dt>当前会话草稿</dt><dd>{session.completion.hasContent ? "有内容" : "空"}</dd></div>
              <div><dt>云端保存</dt><dd>未接入</dd></div>
              <div><dt>学习证据</dt><dd>待服务确认</dd></div>
            </dl>
            <p className="summary-status-code">状态码：{document.saveServiceState}</p>
            <p className="service-boundary-copy">当前内容不会同步到其他设备。</p>
          </RailSection>

          <RailSection className="summary-ai-rail" title="AI 辅助">
            <p>先写下你的归纳，再请求检查。</p><p>辅导可以检查步骤是否完整，但不会代写。</p>
            <button aria-describedby="summary-ai-helper" className="secondary-button" disabled={!session.completion.hasContent} onClick={session.requestAiCheck} type="button">检查我的归纳</button>
            <p aria-live="polite" className="service-boundary-copy" id="summary-ai-helper">{session.state.aiCheckState === "DISABLED_EMPTY" ? "至少填写一条归纳后可检查。" : session.state.aiCheckState === "TUTOR_SERVICE_UNAVAILABLE" ? "TUTOR_SERVICE_UNAVAILABLE；你的输入没有发送。" : "AI 检查服务尚未接入。"}</p>
          </RailSection>

          <RailSection className="summary-resources-rail" title="复习材料">
            <ul>
              <li><button className="text-button" onClick={onOpenContent} type="button">例题讲解</button></li>
              <li><button className="text-button" onClick={onOpenResult} type="button">五题作答回看</button></li>
              <li><button className="text-button" onClick={onOpenContent} type="button">二次函数图像笔记</button></li>
            </ul>
          </RailSection>

          <div className="family-privacy-notice summary-privacy"><Icon name="shieldCheck" size={20} /><p>归纳、作答与辅导记录仅在授权家庭范围内使用。</p></div>
        </div>
      </details>
    </aside>
  );
}
