import type { CompositionEvent } from "react";

import { Icon } from "../../../components/Icon";
import type { NumericPracticeQuestion as NumericQuestionData, NumericPracticeSessionState } from "./types";

function validationCopy(state: NumericPracticeSessionState): string {
  if (state.isComposing || state.inputState === "TYPING_INCOMPLETE") return "请完成数值输入";
  if (state.inputState === "INVALID_FORMAT") return "格式错误：仅填写一个有限数值，不需要填写 y =";
  if (state.inputState === "VALID_READY") return "格式有效；提交前不会判定正确性";
  return "请输入答案";
}

function validationIcon(state: NumericPracticeSessionState): "check" | "circleAlert" | "info" {
  if (state.inputState === "VALID_READY") return "check";
  if (state.inputState === "INVALID_FORMAT") return "circleAlert";
  return "info";
}

export interface NumericPracticeQuestionProps {
  readonly question: NumericQuestionData;
  readonly state: NumericPracticeSessionState;
  readonly onAnswerChange: (value: string) => void;
  readonly onCalculationChange: (value: string) => void;
  readonly onCompositionStart: () => void;
  readonly onCompositionEnd: (value: string) => void;
}

export function NumericPracticeQuestion({
  question,
  state,
  onAnswerChange,
  onCalculationChange,
  onCompositionStart,
  onCompositionEnd,
}: NumericPracticeQuestionProps) {
  const calculationCount = state.calculationDraft.length;
  const counterState = state.calculationLimitExceeded
    ? "is-limit-error"
    : calculationCount >= question.calculationCharacterLimit
      ? "is-limit-reached"
      : calculationCount > question.calculationCharacterLimit * 0.9
        ? "is-near-limit"
        : "";
  const answerStateClass = state.submitPhase === "CORRECT"
    ? "is-correct"
    : state.submitPhase === "INCORRECT_RETRYABLE"
      ? "is-answer-incorrect"
      : state.inputState === "INVALID_FORMAT"
        ? "is-invalid-format"
        : state.inputState === "VALID_READY"
          ? "is-valid-ready"
          : state.inputState === "TYPING_INCOMPLETE"
            ? "is-typing-incomplete"
            : "";
  const answerLocked = state.submitPhase === "CHECKING" || state.submitPhase === "CORRECT";
  const invalidFormat = state.inputState === "INVALID_FORMAT";

  function handleCompositionEnd(event: CompositionEvent<HTMLInputElement>): void {
    onCompositionEnd(event.currentTarget.value);
  }

  return (
    <section className="practice-question practice-numeric-question" data-od-id="practice-numeric-question" aria-labelledby="practice-question-title">
      <div className="practice-question-meta">
        <span>第 {question.number} 题 / 共 5 题</span>
        <span>{question.typeLabel}</span>
        <span>{question.skillLabel}</span>
        <span className="practice-recovered-context"><Icon name="check" size={14} />第 1 题已修正</span>
      </div>
      <h2 id="practice-question-title">{question.stem}</h2>
      <p className="practice-numeric-support">{question.supportText}</p>

      <div className="practice-calculation-field">
        <label htmlFor="practice-calculation-draft">计算过程（可选）</label>
        <textarea
          aria-describedby="practice-calculation-help practice-calculation-counter"
          autoComplete="off"
          disabled={answerLocked}
          id="practice-calculation-draft"
          name="practiceCalculationDraft"
          onChange={(event) => { onCalculationChange(event.currentTarget.value); }}
          placeholder="在这里记录代入和计算过程……"
          rows={4}
          value={state.calculationDraft}
        />
        <div className="practice-calculation-meta">
          <p id="practice-calculation-help">
            {state.calculationLimitExceeded
              ? "计算过程最多 300 个字符；超出内容未写入。"
              : calculationCount >= question.calculationCharacterLimit
                ? "已达到 300 字上限。"
                : "计算过程可选，不作为最终答案或服务端证据。"}
          </p>
          <span
            aria-live="polite"
            className={["practice-character-counter", counterState].filter(Boolean).join(" ")}
            id="practice-calculation-counter"
          >
            {calculationCount} / {question.calculationCharacterLimit}
          </span>
        </div>
      </div>

      <div className={["practice-numeric-answer-field", answerStateClass].filter(Boolean).join(" ")}>
        <label htmlFor="practice-numeric-answer">最终答案</label>
        <input
          aria-describedby="practice-numeric-help practice-numeric-validation"
          aria-invalid={invalidFormat || undefined}
          autoComplete="off"
          disabled={answerLocked}
          id="practice-numeric-answer"
          inputMode="decimal"
          name="practiceNumericAnswer"
          onChange={(event) => { onAnswerChange(event.currentTarget.value); }}
          onCompositionEnd={handleCompositionEnd}
          onCompositionStart={onCompositionStart}
          placeholder="输入数值"
          spellCheck={false}
          type="text"
          value={state.answerInput}
        />
        <p id="practice-numeric-help">仅填写数值，可输入负号；不需要填写 y =。</p>
        <p
          aria-live="polite"
          className="practice-numeric-validation"
          id="practice-numeric-validation"
          role={invalidFormat ? "alert" : "status"}
        >
          <Icon name={validationIcon(state)} size={15} />
          {validationCopy(state)}
        </p>
      </div>

      {state.submitPhase === "INCORRECT_RETRYABLE" ? (
        <div aria-live="polite" className="practice-answer-feedback is-numeric-retryable" data-od-id="practice-numeric-retry-feedback" role="alert">
          <div className="practice-numeric-feedback-title"><Icon name="circleAlert" size={18} /><strong>再检查一次</strong></div>
          <p>请检查代入、运算顺序和负号，再修改最终答案。</p>
          <small>当前只做本地 Fixture 判题；不会创建错题、恢复尝试或掌握证据。</small>
        </div>
      ) : null}

      {state.submitPhase === "CORRECT" ? (
        <div aria-live="polite" className="practice-answer-feedback is-numeric-correct" data-od-id="practice-numeric-correct-feedback" role="status">
          <div className="practice-numeric-feedback-title"><Icon name="check" size={18} /><strong>计算正确</strong></div>
          <p>提交后解析：</p>
          <ol>{question.explanation.map((item) => <li key={item}>{item}</li>)}</ol>
          <small>本地判题完成；是否形成有效学习证据仍由服务端判断。</small>
        </div>
      ) : null}
    </section>
  );
}
