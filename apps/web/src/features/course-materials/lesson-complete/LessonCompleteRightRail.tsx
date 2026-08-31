import { Icon } from "../../../components/Icon";
import type { LessonFlowCompletionDocument } from "./types";

function RailSection({ title, className, children }: { readonly title: string; readonly className: string; readonly children: React.ReactNode }) {
  return <section className={`complete-rail-section ${className}`}><h2>{title}</h2>{children}</section>;
}

export function LessonCompleteRightRail({
  document,
  onOpenContent,
  onOpenPractice,
}: {
  readonly document: LessonFlowCompletionDocument;
  readonly onOpenContent: () => void;
  readonly onOpenPractice: () => void;
}) {
  return (
    <aside aria-label="课时完成辅助信息" className="lesson-complete-right-rail">
      <details className="lesson-complete-rail-details" open>
        <summary>课时与证据信息</summary>
        <div className="lesson-complete-rail-content">
          <RailSection className="complete-status-rail" title="课时状态">
            <dl><div><dt>页面步骤</dt><dd>4 / 4</dd></div><div><dt>当前会话</dt><dd>已完成</dd></div><div><dt>云端记录</dt><dd>待确认</dd></div><div><dt>课时完成事件</dt><dd>未提交</dd></div></dl>
          </RailSection>
          <RailSection className="complete-summary-rail" title="个人归纳">
            <dl><div><dt>归纳条目</dt><dd>3 / 3</dd></div><div><dt>当前会话</dt><dd>可回看</dd></div><div><dt>云端保存</dt><dd>未接入</dd></div><div><dt>其他设备</dt><dd>不同步</dd></div></dl>
            <p className="complete-status-code">{document.serviceState}</p>
          </RailSection>
          <RailSection className="complete-practice-rail" title="练习与评审">
            <dl><div><dt>题目提交</dt><dd>{document.practiceSubmittedQuestions} / 5</dd></div><div><dt>提示后修正</dt><dd>{document.recoveredAfterHint}</dd></div><div><dt>解释待评审</dt><dd>{document.pendingExplanationReview}</dd></div><div><dt>错题记录</dt><dd>待服务确认</dd></div></dl>
          </RailSection>
          <RailSection className="complete-evidence-rail" title="证据与掌握">
            <dl><div><dt>学习证据</dt><dd>待提交</dd></div><div><dt>有效证据</dt><dd>待服务确认</dd></div><div><dt>掌握度</dt><dd>保持不变</dd></div><div><dt>正式复习时间</dt><dd>待确认</dd></div></dl>
            <p className="service-boundary-copy">不要用页面完成代替服务端证据判断。</p>
          </RailSection>
          <RailSection className="complete-resources-rail" title="复习入口">
            <ul><li><button className="text-button" onClick={onOpenContent} type="button">二次函数图像笔记</button></li><li><button className="text-button" onClick={onOpenPractice} type="button">五题作答回看</button></li><li><button className="text-button" onClick={onOpenContent} type="button">描点绘图练习</button></li></ul>
          </RailSection>
          <RailSection className="complete-privacy-rail" title="隐私与证据">
            <ul><li>原始归纳仅本人可见</li><li>家长仅查看聚合报告</li><li>有效证据由服务端确认</li></ul>
          </RailSection>
          <div className="family-privacy-notice complete-privacy"><Icon name="shieldCheck" size={20} /><p>归纳、作答与辅导记录仅在授权家庭范围内使用。</p></div>
        </div>
      </details>
    </aside>
  );
}
