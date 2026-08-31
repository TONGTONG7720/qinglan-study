import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { LearningStepper } from "../LearningStepper";
import { LessonCompleteRightRail } from "./LessonCompleteRightRail";
import type { LessonFlowCompletionDocument, PersonalSummaryEntry } from "./types";
import { useLessonComplete } from "./use-lesson-complete";

import "./lesson-complete.css";

export interface LessonCompleteRouteProps {
  readonly courseId: string;
  readonly currentUser: CurrentUserResult;
  readonly overviewUrl: string;
  readonly summaryUrl: string;
}

interface FocusReference { current: HTMLElement | null }

function LessonCompleteUnavailable({ currentUser, overviewUrl, denied = false }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string; readonly denied?: boolean }) {
  return <div className="app-shell lesson-complete-shell"><a className="skip-link" href="#main-content">跳到主要内容</a><Sidebar currentUser={currentUser} demoActive={false} /><main className="lesson-complete-canvas service-state-page" id="main-content"><header className="page-header compact"><div><h1>本课完成</h1><p>方法已整理，后续结果等待确认</p></div><span aria-hidden="true" className="page-header-rule" /></header><StatusPanel description={denied ? "该课时不存在或当前账号无法访问。为了保护学生数据，页面不会说明资源是否存在。" : "当前没有课时完成事件适配器。生产环境不会加载开发归纳、练习结果或复习建议。"} title={denied ? "内容不存在或无法访问" : "课时完成服务尚未接入"} /><Link className="knowledge-back-link" to={overviewUrl}>返回数学课程</Link></main></div>;
}

export function LessonCompleteServiceUnavailable({ currentUser, overviewUrl }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string }) {
  return <LessonCompleteUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />;
}

function CompleteDialog({ dialogRef, title, titleId, onClose, children }: { readonly dialogRef: React.RefObject<HTMLDialogElement | null>; readonly title: string; readonly titleId: string; readonly onClose: () => void; readonly children: React.ReactNode }) {
  return <dialog aria-labelledby={titleId} className="complete-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} ref={dialogRef}><div><header><h2 id={titleId}>{title}</h2><button aria-label={`关闭${title}`} onClick={onClose} type="button"><Icon name="close" size={18} /></button></header>{children}</div></dialog>;
}

function MethodRecap({ document }: { readonly document: LessonFlowCompletionDocument }) {
  return <section aria-labelledby="complete-method-title" className="complete-method-recap"><h2 id="complete-method-title">带走这套判断顺序</h2><ol>{document.methodSteps.map((step, index) => <li key={step.id}><strong>{step.title}</strong>{index < document.methodSteps.length - 1 ? <Icon aria-hidden="true" name="arrowRight" size={16} /> : null}</li>)}</ol><p>{document.methodContextNote}</p></section>;
}

function LessonCompleteReady({ currentUser, document, overviewUrl, summaryUrl }: { readonly currentUser: CurrentUserResult; readonly document: LessonFlowCompletionDocument; readonly overviewUrl: string; readonly summaryUrl: string }) {
  const navigate = useNavigate();
  const [returning, setReturning] = useState(false);
  const [summaries, setSummaries] = useState(document.personalSummaries);
  const returnTimeoutRef = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const contentDialogRef = useRef<HTMLDialogElement>(null);
  const practiceDialogRef = useRef<HTMLDialogElement>(null);
  const editTriggerRef = useRef<HTMLElement | null>(null);
  const contentTriggerRef = useRef<HTMLElement | null>(null);
  const practiceTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => { titleRef.current?.focus(); return () => { if (returnTimeoutRef.current !== null) window.clearTimeout(returnTimeoutRef.current); }; }, []);
  function openDialog(ref: React.RefObject<HTMLDialogElement | null>, trigger: FocusReference): void { trigger.current = window.document.activeElement instanceof HTMLElement ? window.document.activeElement : null; ref.current?.showModal(); }
  function closeDialog(ref: React.RefObject<HTMLDialogElement | null>, trigger: FocusReference): void { ref.current?.close(); window.setTimeout(() => { trigger.current?.focus(); }, 0); }
  function returnCourse(): void { if (returning) return; setReturning(true); returnTimeoutRef.current = window.setTimeout(() => { void navigate(overviewUrl); }, 160); }
  function updateSummary(id: PersonalSummaryEntry["id"], text: string): void { setSummaries((current) => current.map((entry) => entry.id === id ? { ...entry, text } : entry)); }

  return <div className="app-shell lesson-complete-shell"><a className="skip-link" href="#main-content">跳到主要内容</a><Sidebar currentUser={currentUser} demoActive /><main className="lesson-complete-canvas" data-od-id="lesson-complete-page" id="main-content"><div className="lesson-complete-page"><header className="lesson-complete-header"><nav aria-label="面包屑" className="knowledge-breadcrumb"><Link to={overviewUrl}>课程与资料</Link><Icon name="chevronRight" size={16} /><span>{document.subjectLabel}</span><Icon name="chevronRight" size={16} /><span>{document.lessonLabel}</span></nav><div className="lesson-complete-title-row"><div><h1 ref={titleRef} tabIndex={-1}>{document.title}</h1><p>{document.subtitle}</p><span className="fixture-badge">Fixture 演示</span></div><div className="lesson-complete-date"><strong>{document.date}</strong><span>{document.weekdayEnglish} · {document.weekdayChinese}</span></div></div></header><LearningStepper currentStepNumber={4} estimatedMinutes={0} odId="lesson-complete-stepper" steps={document.steps} /><div className="lesson-complete-layout"><article className="lesson-complete-main"><section aria-labelledby="completion-hero-title" className="lesson-completion-hero"><p aria-label="四个页面步骤均已完成" className="completion-fraction"><span aria-hidden="true">4 / 4</span></p><div><h2 id="completion-hero-title">{document.completionTitle}</h2><p>{document.completionDescription}</p><p className="completion-truth">{document.completionTruth}</p></div></section><MethodRecap document={document} /><section aria-labelledby="personal-summary-review-title" className="personal-summary-review"><header><h2 id="personal-summary-review-title">我的归纳</h2><button className="text-button" onClick={() => { openDialog(editDialogRef, editTriggerRef); }} type="button">返回编辑归纳</button></header><ol>{summaries.map((entry) => <li key={entry.id}><span>{entry.number}.</span><p>{entry.text}</p><small>当前会话已完成</small></li>)}</ol><p>以上归纳仅保留在当前演示会话，尚未同步。</p></section><section aria-labelledby="practice-recap-title" className="complete-practice-recap"><h2 id="practice-recap-title">本次练习</h2><dl><div><dt>题目提交</dt><dd>{document.practiceSubmittedQuestions} / 5</dd></div><div><dt>提示后修正</dt><dd>{document.recoveredAfterHint}</dd></div><div><dt>解释待评审</dt><dd>{document.pendingExplanationReview}</dd></div><div><dt>掌握度</dt><dd>保持不变</dd></div></dl><button className="text-button" onClick={() => { openDialog(practiceDialogRef, practiceTriggerRef); }} type="button">查看练习结果</button></section><section aria-labelledby="review-recommendation-title" className="review-recommendation"><h2 id="review-recommendation-title">后续复习</h2><p>{document.reviewRecommendationText}</p><dl><div><dt>本地建议</dt><dd>2–3 天后</dd></div><div><dt>正式复习时间</dt><dd>待服务确认</dd></div></dl></section><footer className="lesson-complete-actions"><button aria-busy={returning} className="primary-button" disabled={returning} onClick={returnCourse} type="button">{returning ? "正在返回…" : "返回数学课程"}</button><button className="secondary-button" onClick={() => { openDialog(contentDialogRef, contentTriggerRef); }} type="button">回看本课</button><Link className="text-button" to="/student/today">返回今日学习</Link></footer></article><span aria-hidden="true" className="lesson-complete-rail-divider" /><LessonCompleteRightRail document={document} onOpenContent={() => { openDialog(contentDialogRef, contentTriggerRef); }} onOpenPractice={() => { openDialog(practiceDialogRef, practiceTriggerRef); }} /></div></div></main>

  <CompleteDialog dialogRef={editDialogRef} onClose={() => { closeDialog(editDialogRef, editTriggerRef); }} title="编辑当前会话归纳" titleId="complete-edit-dialog-title"><div className="complete-edit-fields">{summaries.map((entry) => <label key={entry.id}><span>{entry.number}. 个人归纳</span><textarea maxLength={160} onChange={(event) => { updateSummary(entry.id, event.target.value); }} value={entry.text} /></label>)}</div><p className="service-boundary-copy">修改只保留在当前页面内存，不会自动提交或保存到云端。</p></CompleteDialog>
  <CompleteDialog dialogRef={contentDialogRef} onClose={() => { closeDialog(contentDialogRef, contentTriggerRef); }} title="本课内容索引" titleId="complete-content-dialog-title"><ol className="complete-content-index">{document.methodSteps.map((step) => <li key={step.id}><strong>{step.number}. {step.title}</strong></li>)}</ol><p className="service-boundary-copy">只读回看不会改变当前完成状态，也不会重新提交证据。</p></CompleteDialog>
  <CompleteDialog dialogRef={practiceDialogRef} onClose={() => { closeDialog(practiceDialogRef, practiceTriggerRef); }} title="练习结果 · 当前会话" titleId="complete-practice-dialog-title"><dl className="complete-dialog-list"><div><dt>题目提交</dt><dd>5 / 5</dd></div><div><dt>提示后修正</dt><dd>1</dd></div><div><dt>解释待评审</dt><dd>1</dd></div><div><dt>掌握度</dt><dd>保持不变</dd></div></dl><p className="service-boundary-copy">5 / 5 只表示已提交，不代表满分、全部正确或已掌握。</p></CompleteDialog>
  <span className="sr-only">归纳编辑入口为 {summaryUrl}；当前完成页不自动导航、保存或提交。</span></div>;
}

export function LessonCompleteRoute({ courseId, currentUser, overviewUrl, summaryUrl }: LessonCompleteRouteProps) {
  const state = useLessonComplete(courseId);
  if (state.status === "LOADING") return <div className="app-shell lesson-complete-shell"><Sidebar currentUser={currentUser} demoActive /><main className="lesson-complete-canvas service-state-page" id="main-content"><div aria-label="正在加载课时完成页" className="page-loading" role="status"><span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-copy" /><span className="skeleton-line skeleton-divider" /></div></main></div>;
  if (state.status === "READY_FIXTURE" || state.status === "OFFLINE_CURRENT_SESSION") return <LessonCompleteReady currentUser={currentUser} document={state.document} overviewUrl={overviewUrl} summaryUrl={summaryUrl} />;
  if (state.status === "NOT_FOUND_OR_DENIED") return <LessonCompleteUnavailable currentUser={currentUser} denied overviewUrl={overviewUrl} />;
  return <LessonCompleteUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />;
}
