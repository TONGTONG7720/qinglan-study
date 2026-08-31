import type { KeyboardEvent, SyntheticEvent } from "react";

import { Icon } from "../../../components/Icon";
import type {
  StructuredApplicationCompletion,
  StructuredApplicationFieldId,
  StructuredApplicationPracticeQuestion,
} from "./types";
import type { useStructuredApplicationSession } from "./use-structured-application-session";

import "./structured-application.css";

type StructuredApplicationSession = ReturnType<typeof useStructuredApplicationSession>;

interface NumericFieldProps {
  readonly describedBy: string;
  readonly error: string | null;
  readonly field: Exclude<StructuredApplicationFieldId, "explanation">;
  readonly id: string;
  readonly label: string;
  readonly onBlur: (field: StructuredApplicationFieldId) => void;
  readonly onChange: (field: StructuredApplicationFieldId, value: string) => void;
  readonly onFocus: (field: StructuredApplicationFieldId) => void;
  readonly prefix?: string;
  readonly suffix?: string;
  readonly value: string;
}

function NumericField({
  describedBy,
  error,
  field,
  id,
  label,
  onBlur,
  onChange,
  onFocus,
  prefix,
  suffix,
  value,
}: NumericFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div className="structured-numeric-field">
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="structured-input-line">
        {prefix === undefined ? null : <span aria-hidden="true" className="structured-math-prefix">{prefix}</span>}
        <input
          aria-describedby={`${describedBy} ${errorId}`}
          aria-invalid={error !== null}
          autoComplete="off"
          id={id}
          inputMode="decimal"
          name={field}
          onBlur={() => { onBlur(field); }}
          onChange={(event) => { onChange(field, event.target.value); }}
          onFocus={() => { onFocus(field); }}
          placeholder="—"
          required
          spellCheck={false}
          type="text"
          value={value}
        />
        {suffix === undefined ? null : <span className="structured-unit">{suffix}</span>}
      </div>
      <span className="structured-field-error" id={errorId} role={error === null ? undefined : "alert"}>
        {error ?? "\u00a0"}
      </span>
    </div>
  );
}

function CoordinatePairField({ session }: { readonly session: StructuredApplicationSession }) {
  return (
    <fieldset className="structured-response-section">
      <legend className="sr-only">第 1 部分：最高点，填写最高点坐标</legend>
      <div className="structured-section-layout">
        <div aria-hidden="true" className="structured-section-heading"><span>1</span><strong>最高点</strong><small>填写最高点坐标</small></div>
        <div className="structured-field-content">
          <div className="structured-field-row is-coordinate-pair">
            <NumericField
              describedBy="structured-vertex-help"
              error={session.state.fieldErrors.vertexX}
              field="vertexX"
              id="structured-vertex-x"
              label="最高点横坐标 x"
              onBlur={session.blurField}
              onChange={session.setField}
              onFocus={session.focusField}
              prefix="x ="
              value={session.state.values.vertexX}
            />
            <NumericField
              describedBy="structured-vertex-help"
              error={session.state.fieldErrors.vertexY}
              field="vertexY"
              id="structured-vertex-y"
              label="最高点纵坐标 y"
              onBlur={session.blurField}
              onChange={session.setField}
              onFocus={session.focusField}
              prefix="y ="
              value={session.state.values.vertexY}
            />
            <span className="structured-inline-unit">单位：米</span>
          </div>
          <p className="structured-help" id="structured-vertex-help">分别填写横坐标与纵坐标</p>
        </div>
      </div>
    </fieldset>
  );
}

function OrderedInterceptFields({ session }: { readonly session: StructuredApplicationSession }) {
  return (
    <fieldset className="structured-response-section">
      <legend className="sr-only">第 2 部分：地面交点与宽度</legend>
      <div className="structured-section-layout">
        <div aria-hidden="true" className="structured-section-heading"><span>2</span><strong>地面交点与宽度</strong><small>填写与地面的两个交点横坐标，再计算拱门宽度</small></div>
        <div className="structured-field-content">
          <div className="structured-field-row is-intercepts">
            <NumericField
              describedBy="structured-intercept-help"
              error={session.state.fieldErrors.interceptX1}
              field="interceptX1"
              id="structured-intercept-x1"
              label="第一个地面交点横坐标 x₁"
              onBlur={session.blurField}
              onChange={session.setField}
              onFocus={session.focusField}
              prefix="x₁ ="
              value={session.state.values.interceptX1}
            />
            <NumericField
              describedBy="structured-intercept-help"
              error={session.state.fieldErrors.interceptX2}
              field="interceptX2"
              id="structured-intercept-x2"
              label="第二个地面交点横坐标 x₂"
              onBlur={session.blurField}
              onChange={session.setField}
              onFocus={session.focusField}
              prefix="x₂ ="
              value={session.state.values.interceptX2}
            />
            <NumericField
              describedBy="structured-intercept-help"
              error={session.state.fieldErrors.width}
              field="width"
              id="structured-width"
              label="拱门宽度"
              onBlur={session.blurField}
              onChange={session.setField}
              onFocus={session.focusField}
              prefix="宽度 ="
              suffix="米"
              value={session.state.values.width}
            />
          </div>
          <p className="structured-help" id="structured-intercept-help">按从小到大的顺序填写交点</p>
        </div>
      </div>
    </fieldset>
  );
}

function ExplanationTextarea({
  question,
  session,
}: {
  readonly question: StructuredApplicationPracticeQuestion;
  readonly session: StructuredApplicationSession;
}) {
  const error = session.state.fieldErrors.explanation;
  const count = session.state.values.explanation.length;
  return (
    <fieldset className="structured-response-section is-explanation">
      <legend className="sr-only">第 3 部分：判断依据</legend>
      <div className="structured-section-layout">
        <div aria-hidden="true" className="structured-section-heading"><span>3</span><strong>判断依据</strong><small>用一句话说明你如何得到最高点和宽度</small></div>
        <div className="structured-field-content">
        <label className="sr-only" htmlFor="structured-explanation">判断依据</label>
        <textarea
          aria-describedby="structured-explanation-help structured-explanation-error structured-explanation-count"
          aria-invalid={error !== null}
          autoComplete="off"
          id="structured-explanation"
          name="explanation"
          onBlur={() => { session.blurField("explanation"); }}
          onChange={(event) => { session.setField("explanation", event.target.value); }}
          onFocus={() => { session.focusField("explanation"); }}
          placeholder="写下你的判断过程，不必展开全部计算。"
          required
          value={session.state.values.explanation}
        />
        <div className="structured-textarea-meta">
          <span className="structured-field-error" id="structured-explanation-error" role={error === null ? undefined : "alert"}>{error ?? "\u00a0"}</span>
          <span
            aria-live="polite"
            className={count >= question.explanationMaxLength ? "is-limit" : count >= 108 ? "is-near-limit" : ""}
            id="structured-explanation-count"
          >{count} / {question.explanationMaxLength}</span>
        </div>
        <p className="sr-only" id="structured-explanation-help">判断依据必填，不超过 {question.explanationMaxLength} 字。</p>
        </div>
      </div>
    </fieldset>
  );
}

function ResponseCompletionChecklist({ completion }: { readonly completion: StructuredApplicationCompletion }) {
  const items = [
    { label: "最高点坐标", complete: completion.vertexComplete },
    { label: "地面交点", complete: completion.interceptsComplete },
    { label: "拱门宽度", complete: completion.widthComplete },
    { label: "判断依据", complete: completion.explanationComplete },
  ] as const;
  return (
    <section aria-labelledby="structured-checklist-title" className="structured-completion-checklist">
      <h3 id="structured-checklist-title">完成清单 <small>（必填）</small></h3>
      <ul>
        {items.map((item) => (
          <li className={item.complete ? "is-complete" : ""} key={item.label}>
            {item.complete ? <Icon name="check" size={14} /> : <span aria-hidden="true" className="structured-empty-status" />}
            <span>{item.label}</span><strong>{item.complete ? "已完成" : "未完成"}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StructuredApplicationQuestion({
  question,
  session,
}: {
  readonly question: StructuredApplicationPracticeQuestion;
  readonly session: StructuredApplicationSession;
}) {
  function handleSubmit(event: SyntheticEvent<HTMLFormElement>): void {
    event.preventDefault();
    session.submit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>): void {
    if (event.nativeEvent.isComposing) event.preventDefault();
  }

  return (
    <form
      className="structured-application-form"
      data-od-id="practice-q5-structured-application"
      id="structured-application-form"
      noValidate
      onKeyDown={handleKeyDown}
      onSubmit={handleSubmit}
    >
      <div className="structured-question-heading">
        <div className="practice-question-meta"><span>综合练习</span><span>{question.typeLabel}</span><span>{question.skillLabel}</span></div>
        <h2>{question.scenario}</h2>
        <p>{question.instruction}</p>
      </div>
      <div className="structured-response-surface">
        <CoordinatePairField session={session} />
        <OrderedInterceptFields session={session} />
        <ExplanationTextarea question={question} session={session} />
      </div>
      <ResponseCompletionChecklist completion={session.completion} />
      <div aria-live="polite" className="structured-submit-status" role={session.state.submitError === null ? undefined : "alert"}>
        {session.state.submitError}
      </div>
    </form>
  );
}
