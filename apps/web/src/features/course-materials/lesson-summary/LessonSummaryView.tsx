import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { LearningStepper } from "../LearningStepper";
import { LessonSummaryMain } from "./LessonSummaryForm";
import { LessonSummaryRightRail } from "./LessonSummaryRightRail";
import type { LessonSummaryDocument } from "./types";
import { useLessonSummary } from "./use-lesson-summary";
import { useLessonSummarySession } from "./use-lesson-summary-session";

import "./lesson-summary.css";

export interface LessonSummaryRouteProps {
  readonly courseId: string;
  readonly currentUser: CurrentUserResult;
  readonly overviewUrl: string;
  readonly practiceUrl: string;
}

interface ElementFocusReference {
  current: HTMLElement | null;
}

function LessonSummaryLoading({ currentUser }: { readonly currentUser: CurrentUserResult }) {
  return (
    <div className="app-shell lesson-summary-shell"><Sidebar currentUser={currentUser} demoActive /><main className="lesson-summary-canvas service-state-page" id="main-content"><div aria-label="正在加载归纳总结" className="page-loading" role="status"><span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-copy" /><span className="skeleton-line skeleton-divider" /><div className="skeleton-columns"><span /><span /></div></div></main></div>
  );
}

function LessonSummaryUnavailable({ currentUser, overviewUrl, denied = false }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string; readonly denied?: boolean }) {
  return (
    <div className="app-shell lesson-summary-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a><Sidebar currentUser={currentUser} demoActive={false} />
      <main className="lesson-summary-canvas service-state-page" id="main-content">
        <header className="page-header compact"><div><h1>归纳总结</h1><p>整理顺序，留下可复习的方法</p></div><span aria-hidden="true" className="page-header-rule" /></header>
        <StatusPanel description={denied ? "该课时不存在或当前账号无法访问。为了保护学生和家庭数据，页面不会说明资源是否存在。" : "当前没有课时归纳保存适配器。生产环境不会加载开发方法、练习结果或虚构学生归纳。"} title={denied ? "内容不存在或无法访问" : "归纳保存服务尚未接入"} />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export function LessonSummaryServiceUnavailable({ currentUser, overviewUrl }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string }) {
  return <LessonSummaryUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />;
}

function SummaryDialog({ dialogRef, title, titleId, children, onClose }: { readonly dialogRef: React.RefObject<HTMLDialogElement | null>; readonly title: string; readonly titleId: string; readonly children: React.ReactNode; readonly onClose: () => void }) {
  return (
    <dialog aria-labelledby={titleId} className="summary-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} ref={dialogRef}>
      <div><header><h2 id={titleId}>{title}</h2><button aria-label={`关闭${title}`} onClick={onClose} type="button"><Icon name="close" size={18} /></button></header>{children}</div>
    </dialog>
  );
}

function LessonSummaryReady({ currentUser, document, overviewUrl, practiceUrl }: { readonly currentUser: CurrentUserResult; readonly document: LessonSummaryDocument; readonly overviewUrl: string; readonly practiceUrl: string }) {
  const navigate = useNavigate();
  const session = useLessonSummarySession(document);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resultDialogRef = useRef<HTMLDialogElement>(null);
  const contentDialogRef = useRef<HTMLDialogElement>(null);
  const leaveDialogRef = useRef<HTMLDialogElement>(null);
  const resultTriggerRef = useRef<HTMLElement | null>(null);
  const contentTriggerRef = useRef<HTMLElement | null>(null);
  const leaveTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    if (announcement === null) return undefined;
    const timer = window.setTimeout(() => { setAnnouncement(null); }, 4000);
    return () => { window.clearTimeout(timer); };
  }, [announcement]);

  function openDialog(ref: React.RefObject<HTMLDialogElement | null>, triggerRef: ElementFocusReference): void {
    triggerRef.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null;
    ref.current?.showModal();
  }
  function closeDialog(ref: React.RefObject<HTMLDialogElement | null>, triggerRef: ElementFocusReference): void {
    ref.current?.close();
    window.setTimeout(() => { triggerRef.current?.focus(); }, 0);
  }
  function continueLater(): void {
    if (session.hasDraft) {
      openDialog(leaveDialogRef, leaveTriggerRef);
      return;
    }
    void navigate(overviewUrl);
  }

  return (
    <div className="app-shell lesson-summary-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a><Sidebar currentUser={currentUser} demoActive />
      <main className="lesson-summary-canvas" data-od-id="lesson-summary-page" id="main-content">
        <div className="lesson-summary-page">
          <header className="lesson-summary-header">
            <nav aria-label="面包屑" className="knowledge-breadcrumb"><Link to={overviewUrl}>课程与资料</Link><Icon name="chevronRight" size={16} /><span>{document.subjectLabel}</span><Icon name="chevronRight" size={16} /><span>{document.lessonLabel}</span></nav>
            <div className="lesson-summary-title-row"><div><h1 ref={titleRef} tabIndex={-1}>{document.title}</h1><p>{document.subtitle}</p><span className="fixture-badge">Fixture 演示</span></div><div className="lesson-summary-date"><strong>{document.date}</strong><span>{document.weekdayEnglish} · {document.weekdayChinese}</span></div></div>
          </header>
          <LearningStepper currentStepNumber={4} estimatedMinutes={document.estimatedMinutes} odId="lesson-summary-stepper" onStepActivate={(step) => { if (step.id === "PRACTICE") openDialog(resultDialogRef, resultTriggerRef); else setAnnouncement(`${step.label}已经完成；当前归纳草稿仍保留在本页。`); }} steps={document.steps} />
          <div className="lesson-summary-layout">
            <LessonSummaryMain document={document} onContinueLater={continueLater} onOpenContent={() => { openDialog(contentDialogRef, contentTriggerRef); }} onOpenResult={() => { openDialog(resultDialogRef, resultTriggerRef); }} session={session} />
            <span aria-hidden="true" className="lesson-summary-rail-divider" />
            <LessonSummaryRightRail document={document} onOpenContent={() => { openDialog(contentDialogRef, contentTriggerRef); }} onOpenResult={() => { openDialog(resultDialogRef, resultTriggerRef); }} session={session} />
          </div>
        </div>
      </main>

      <SummaryDialog dialogRef={resultDialogRef} onClose={() => { closeDialog(resultDialogRef, resultTriggerRef); }} title="练习结果 · 本次开发会话" titleId="lesson-summary-result-dialog-title">
        <dl className="summary-dialog-list"><div><dt>题目提交</dt><dd>{document.practiceResult.submittedQuestions} / 5</dd></div><div><dt>提示后修正</dt><dd>{document.practiceResult.recoveredAfterHint}</dd></div><div><dt>解释待评审</dt><dd>{document.practiceResult.pendingReview}</dd></div><div><dt>掌握度</dt><dd>保持不变</dd></div></dl>
        <p className="service-boundary-copy">当前仅展示 Fixture 引用；不会重新提交练习、创建证据或改变掌握度。</p><button className="secondary-button" onClick={() => { closeDialog(resultDialogRef, resultTriggerRef); }} type="button">返回归纳总结</button>
      </SummaryDialog>
      <SummaryDialog dialogRef={contentDialogRef} onClose={() => { closeDialog(contentDialogRef, contentTriggerRef); }} title="本课内容索引" titleId="lesson-summary-content-dialog-title">
        <ol className="summary-content-index">{document.methodSteps.map((step) => <li key={step.id}><strong>{step.number}. {step.title}</strong><span>{step.description}</span></li>)}</ol>
        <p className="service-boundary-copy">该索引只读；关闭后焦点会回到原入口，当前归纳不会丢失。</p>
      </SummaryDialog>
      <SummaryDialog dialogRef={leaveDialogRef} onClose={() => { closeDialog(leaveDialogRef, leaveTriggerRef); }} title="稍后继续？" titleId="lesson-summary-leave-dialog-title">
        <p>当前归纳只保留在本次页面会话；离开或刷新后会丢失，尚未保存到云端。</p><div className="summary-dialog-actions"><button autoFocus className="secondary-button" onClick={() => { closeDialog(leaveDialogRef, leaveTriggerRef); }} type="button">继续归纳</button><button className="primary-button" onClick={() => { leaveDialogRef.current?.close(); void navigate(overviewUrl); }} type="button">确认离开</button></div>
      </SummaryDialog>

      {announcement === null ? null : <div className="toast" role="status"><Icon name="info" size={18} /><span>{announcement}</span><button aria-label="关闭提示" onClick={() => { setAnnouncement(null); }} type="button"><Icon name="close" size={18} /></button></div>}
      <span className="sr-only">练习结果路径保留为 {practiceUrl}；当前页面不自动导航或重新提交。</span>
    </div>
  );
}

export function LessonSummaryRoute({ courseId, currentUser, overviewUrl, practiceUrl }: LessonSummaryRouteProps) {
  const state = useLessonSummary(courseId);
  if (state.status === "LOADING") return <LessonSummaryLoading currentUser={currentUser} />;
  if (state.status === "READY_FIXTURE" || state.status === "OFFLINE_CURRENT_SESSION") return <LessonSummaryReady currentUser={currentUser} document={state.document} overviewUrl={overviewUrl} practiceUrl={practiceUrl} />;
  if (state.status === "NOT_FOUND_OR_DENIED") return <LessonSummaryUnavailable currentUser={currentUser} denied overviewUrl={overviewUrl} />;
  return <LessonSummaryUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />;
}
