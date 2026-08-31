import { Icon } from "../../../components/Icon";
import type { MultipleChoicePracticeQuestion, PracticeOption, PracticeOptionId, PracticeSubmitPhase } from "./types";

function optionStateClass({
  option,
  selectedOptionId,
  submitPhase,
  previousOptionIds,
}: {
  readonly option: PracticeOption;
  readonly selectedOptionId: PracticeOptionId | null;
  readonly submitPhase: PracticeSubmitPhase;
  readonly previousOptionIds: readonly PracticeOptionId[];
}): string {
  if (submitPhase === "RECOVERED_CORRECT" && previousOptionIds.includes(option.id)) return "is-previous-incorrect";
  if (submitPhase === "RECOVERED_CORRECT" && option.id === selectedOptionId) return "is-recovered-correct";
  if (submitPhase === "CORRECT" && option.id === selectedOptionId) return "is-submitted-correct";
  if (submitPhase === "INCORRECT_RETRYABLE" && option.id === selectedOptionId) return "is-retryable-incorrect";
  if (
    ["IDLE", "RETRY_EDITING", "RETRY_CHECKING", "RETRY_UNAVAILABLE"].includes(submitPhase) &&
    option.id === selectedOptionId
  ) return "is-selected";
  return "";
}

export interface PracticeQuestionProps {
  readonly question: MultipleChoicePracticeQuestion;
  readonly selectedOptionId: PracticeOptionId | null;
  readonly submitPhase: PracticeSubmitPhase;
  readonly previousOptionIds: readonly PracticeOptionId[];
  readonly onSelect: (optionId: PracticeOptionId) => void;
}

export function PracticeQuestion({
  question,
  selectedOptionId,
  submitPhase,
  previousOptionIds,
  onSelect,
}: PracticeQuestionProps) {
  const retryFeedback = [
    "INCORRECT_RETRYABLE",
    "RETRY_EDITING",
    "RETRY_CHECKING",
    "RETRY_UNAVAILABLE",
  ].includes(submitPhase);
  const controlsDisabled = ["CHECKING", "CORRECT", "INCORRECT_RETRYABLE", "RETRY_CHECKING"].includes(submitPhase);

  return (
    <section className="practice-question" data-od-id="practice-question" aria-labelledby="practice-question-title">
      <div className="practice-question-meta">
        <span>第 {question.number} 题 / 共 5 题</span>
        <span>{question.typeLabel}</span>
        <span>{question.skillLabel}</span>
      </div>
      <h2 id="practice-question-title">{question.stem}</h2>

      <fieldset className="practice-choice-group" disabled={controlsDisabled || submitPhase === "RECOVERED_CORRECT"}>
        <legend className="sr-only">请选择一个答案</legend>
        {question.options.map((option) => {
          const selected = selectedOptionId === option.id;
          const stateClass = optionStateClass({ option, selectedOptionId, submitPhase, previousOptionIds });
          return (
            <label
              className={["practice-choice-option", stateClass].filter(Boolean).join(" ")}
              data-od-id={`practice-choice-${option.id.toLowerCase()}`}
              key={option.id}
            >
              <input
                checked={selected}
                name="practice-answer"
                onChange={() => { onSelect(option.id); }}
                type="radio"
                value={option.id}
              />
              <span aria-hidden="true" className="practice-choice-control" />
              <span className="practice-choice-copy">
                <strong>{option.id}.</strong>
                <span>{option.label}</span>
              </span>
              {submitPhase === "CORRECT" && selected ? (
                <Icon className="practice-choice-state-icon" name="check" size={18} />
              ) : null}
              {submitPhase === "INCORRECT_RETRYABLE" && selected ? (
                <span className="practice-choice-retry-status">
                  <Icon name="circleAlert" size={16} />需要再想一想
                </span>
              ) : null}
              {submitPhase === "RECOVERED_CORRECT" && previousOptionIds.includes(option.id) ? (
                <span className="practice-choice-history-status">上次选择</span>
              ) : null}
              {submitPhase === "RECOVERED_CORRECT" && selected ? (
                <span className="practice-choice-recovered-status"><Icon name="check" size={16} />判断正确</span>
              ) : null}
            </label>
          );
        })}
      </fieldset>

      {submitPhase === "CORRECT" ? (
        <div
          aria-live="polite"
          className="practice-answer-feedback is-correct"
          data-od-id="practice-answer-feedback"
          role="status"
        >
          <Icon name="check" size={20} />
          <div>
            <strong>回答正确</strong>
            <p>已完成本题的本地 Fixture 校验。</p>
            <ul>
              {question.explanation.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      ) : null}
      {retryFeedback ? (
        <div
          aria-live="polite"
          className="practice-answer-feedback is-retryable"
          data-od-id="practice-retry-feedback"
          role={submitPhase === "INCORRECT_RETRYABLE" ? "alert" : "status"}
        >
          <strong>需要再想一想</strong>
          <p>对称轴与顶点的判断可以保留。请重新检查二次项系数 a = -2 与图像开口方向的关系。</p>
          <span aria-hidden="true" />
          <p className="practice-retry-hint">提示 1：当 a &lt; 0 时，抛物线的开口方向如何？</p>
          <small>先修改开口方向，再重新提交。</small>
        </div>
      ) : null}
      {submitPhase === "RECOVERED_CORRECT" ? (
        <div aria-live="polite" className="practice-answer-feedback is-recovered" data-od-id="practice-recovery-feedback" role="status">
          <div className="practice-recovery-title"><Icon name="check" size={18} /><strong>判断已修正</strong></div>
          <p>二次项系数 a = -2 &lt; 0，因此抛物线开口向下。解析式中没有一次项，对称轴为直线 x = 0；当 x = 0 时，y = 1，所以顶点为 (0,1)。</p>
          <p className="practice-recovery-note">你在提示 1 后完成了独立修正。</p>
          <div className="practice-hint-usage"><span><Icon name="check" size={14} />提示 1　已使用</span><span>提示 2　未使用</span></div>
        </div>
      ) : null}
    </section>
  );
}
