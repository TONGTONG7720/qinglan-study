import type { KeyboardEvent, SyntheticEvent } from "react";

import { Icon } from "../../../components/Icon";
import type { LessonSummaryCompletion, LessonSummaryDocument, SummaryPrompt } from "./types";
import type { useLessonSummarySession } from "./use-lesson-summary-session";

type SummarySession = ReturnType<typeof useLessonSummarySession>;

function MethodHero({ document }: { readonly document: LessonSummaryDocument }) {
  return (
    <section aria-labelledby="summary-method-title" className="summary-method-hero">
      <div aria-hidden="true" className="summary-method-number">4</div>
      <div className="summary-method-content">
        <h2 id="summary-method-title">{document.methodTitle}</h2>
        <p>{document.methodSummary}</p>
        <ol aria-label="判断二次函数图像的四步方法" className="summary-method-sequence">
          {document.methodSteps.map((step) => (
            <li key={step.id}>
              <span>{step.number}</span>
              <div><strong>{step.title}</strong><small>{step.description}</small></div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ExpressionComparison({ document }: { readonly document: LessonSummaryDocument }) {
  return (
    <section aria-labelledby="summary-expression-title" className="summary-expression-comparison">
      <h2 id="summary-expression-title">{document.expressionComparisonTitle}</h2>
      <div>
        {document.expressionGuides.map((guide) => (
          <article key={guide.id}>
            <h3>{guide.label}</h3>
            <p className="summary-formula">{guide.formula}</p>
            <p>{guide.explanation}</p>
          </article>
        ))}
      </div>
      <p className="summary-expression-note">{document.expressionNote}</p>
    </section>
  );
}

function SummaryField({ prompt, session }: { readonly prompt: SummaryPrompt; readonly session: SummarySession }) {
  const value = session.state.values[prompt.id];
  const error = session.state.fieldErrors[prompt.id];
  const errorId = `lesson-summary-${prompt.id}-error`;
  const countId = `lesson-summary-${prompt.id}-count`;
  const inputId = `lesson-summary-${prompt.id}`;
  const commonProps = {
    "aria-describedby": `${errorId} ${countId}`,
    "aria-invalid": error !== null,
    autoComplete: "off",
    id: inputId,
    name: prompt.id,
    onBlur: () => { session.blurField(prompt.id); },
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { session.setField(prompt.id, event.target.value); },
    onFocus: () => { session.focusField(prompt.id); },
    placeholder: prompt.placeholder,
    required: true,
    value,
  } as const;
  return (
    <div className="summary-field-row">
      <label htmlFor={inputId}>{prompt.label}</label>
      <div className="summary-field-control">
        {prompt.multiline
          ? <textarea {...commonProps} rows={2} />
          : <input {...commonProps} spellCheck={false} type="text" />}
        <div className="summary-field-meta">
          <span id={errorId} role={error === null ? undefined : "alert"}>{error ?? "\u00a0"}</span>
          <span
            aria-live="polite"
            className={value.length >= prompt.maxLength ? "is-limit" : ""}
            id={countId}
          >{value.length} / {prompt.maxLength}</span>
        </div>
      </div>
    </div>
  );
}

function SummaryCompletionChecklist({ completion }: { readonly completion: LessonSummaryCompletion }) {
  const items = [
    { label: "开口方向归纳", complete: completion.openingComplete },
    { label: "轴与顶点归纳", complete: completion.axisVertexComplete },
    { label: "描点检查归纳", complete: completion.plottingCheckComplete },
  ] as const;
  return (
    <section aria-labelledby="summary-checklist-title" className="summary-completion-checklist">
      <h3 className="sr-only" id="summary-checklist-title">归纳完成清单</h3>
      <ul>
        {items.map((item) => (
          <li className={item.complete ? "is-complete" : ""} key={item.label}>
            {item.complete ? <Icon name="check" size={14} /> : <span aria-hidden="true" />}
            <strong>{item.label}</strong><small>{item.complete ? "已完成" : "未完成"}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LessonSummaryMain({
  document,
  session,
  onOpenContent,
  onOpenResult,
  onContinueLater,
}: {
  readonly document: LessonSummaryDocument;
  readonly session: SummarySession;
  readonly onOpenContent: () => void;
  readonly onOpenResult: () => void;
  readonly onContinueLater: () => void;
}) {
  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    session.complete();
  }
  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.nativeEvent.isComposing) event.preventDefault();
  }
  return (
    <article className="lesson-summary-main" aria-labelledby="summary-method-title">
      <MethodHero document={document} />
      <ExpressionComparison document={document} />
      <form className="personal-summary-form" id="personal-summary-form" noValidate onKeyDown={handleKeyDown} onSubmit={handleSubmit}>
        <header><h2>我的归纳</h2><p>用自己的话写下方法；不需要照抄上面的句子。</p></header>
        {document.summaryPrompts.map((prompt) => <SummaryField key={prompt.id} prompt={prompt} session={session} />)}
        <SummaryCompletionChecklist completion={session.completion} />
        <div aria-live="polite" className="summary-completion-error" role={session.state.completionError === null ? undefined : "alert"}>{session.state.completionError}</div>
      </form>
      <footer className="lesson-summary-actions">
        <button className="primary-button summary-complete-button" disabled={!session.completeButtonEnabled} form="personal-summary-form" type="submit">
          {session.state.phase === "COMPLETING" ? "正在完成…" : "保存归纳并完成本课"}
        </button>
        <p aria-live="polite" id="summary-complete-helper">{session.completion.allComplete ? "3 条个人归纳已完成；保存服务仍待接入。" : "请完成 3 条个人归纳"}</p>
        <div>
          <button className="secondary-button" onClick={onOpenResult} type="button">返回练习结果</button>
          <button className="text-button" onClick={onContinueLater} type="button">稍后继续</button>
          <button className="text-button" onClick={onOpenContent} type="button">查看本课内容</button>
        </div>
      </footer>
    </article>
  );
}
