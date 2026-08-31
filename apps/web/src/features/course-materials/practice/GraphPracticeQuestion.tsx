import { Icon } from "../../../components/Icon";
import { FunctionPlot } from "../knowledge-intro/FunctionPlot";
import type {
  GraphConceptFeedback,
  GraphPracticeQuestion as GraphQuestionData,
  GraphPracticeSessionState,
  PracticeOptionId,
} from "./types";

function conceptCopy(state: GraphConceptFeedback["openingDirection"]): string {
  return state === "NEEDS_RETHINK" ? "需要重新判断" : "判断可保留";
}

export interface GraphPracticeQuestionProps {
  readonly question: GraphQuestionData;
  readonly state: GraphPracticeSessionState;
  readonly onSelect: (optionId: PracticeOptionId) => void;
}

export function GraphPracticeQuestion({ question, state, onSelect }: GraphPracticeQuestionProps) {
  const selectedOption = question.options.find((option) => option.id === state.selectedOptionId);
  const submitted = state.submitPhase === "CORRECT" || state.submitPhase === "INCORRECT_RETRYABLE";

  return (
    <section className="practice-question practice-graph-question" data-od-id="practice-graph-question" aria-labelledby="practice-graph-question-title">
      <div className="practice-question-meta">
        <span>第 {question.number} 题 / 共 5 题</span>
        <span>{question.typeLabel}</span>
        <span>{question.skillLabel}</span>
        <span className="practice-recovered-context"><Icon name="check" size={14} />第 1 题已修正 · 第 2 题已完成</span>
      </div>
      <h2 id="practice-graph-question-title">{question.stem}</h2>
      <p className="practice-graph-support">{question.supportText}</p>

      <fieldset className="practice-graph-choice-group">
        <legend className="sr-only">从四幅函数图像中选择一幅</legend>
        {question.options.map((option) => {
          const selected = state.selectedOptionId === option.id;
          const correct = state.submitPhase === "CORRECT" && selected;
          const incorrect = state.submitPhase === "INCORRECT_RETRYABLE" && selected;
          const optionDescriptionId = `practice-graph-option-${option.id.toLowerCase()}-description`;
          return (
            <label
              className={[
                "practice-graph-choice-option",
                selected && !submitted ? "is-selected" : "",
                correct ? "is-correct" : "",
                incorrect ? "is-incorrect" : "",
              ].filter(Boolean).join(" ")}
              data-od-id={`practice-graph-choice-${option.id.toLowerCase()}`}
              key={option.id}
            >
              <span className="practice-graph-choice-header">
                <input
                  aria-describedby={optionDescriptionId}
                  checked={selected}
                  disabled={state.submitPhase === "CHECKING" || state.submitPhase === "CORRECT"}
                  name="practiceGraphChoice"
                  onChange={() => { onSelect(option.id); }}
                  type="radio"
                  value={option.id}
                />
                <strong>{option.id}</strong>
                {correct ? <span className="practice-graph-choice-status"><Icon name="check" size={15} />判断正确</span> : null}
                {incorrect ? <span className="practice-graph-choice-status"><Icon name="circleAlert" size={15} />需要再想一想</span> : null}
              </span>
              <FunctionPlot
                accessibleDescription={option.accessibleDescription}
                className="graph-choice-plot"
                config={option.plot}
                formula={option.formula}
                showCaption={false}
              />
              <span className="sr-only" id={optionDescriptionId}>{option.accessibleDescription}</span>
            </label>
          );
        })}
      </fieldset>

      {state.submitPhase === "CHECKING" ? (
        <div aria-live="polite" className="practice-answer-feedback" role="status">正在检查图像特征…</div>
      ) : null}

      {submitted && selectedOption !== undefined ? (
        <div
          aria-live="polite"
          className={`practice-answer-feedback practice-graph-feedback${state.submitPhase === "CORRECT" ? " is-graph-correct" : " is-graph-incorrect"}`}
          role={state.submitPhase === "CORRECT" ? "status" : "alert"}
        >
          <div className="practice-graph-feedback-title">
            <Icon name={state.submitPhase === "CORRECT" ? "check" : "circleAlert"} size={18} />
            <strong>{selectedOption.feedback.title}</strong>
          </div>
          <p>{selectedOption.feedback.message}</p>
          <dl className={`practice-concept-diagnostics${state.submitPhase === "CORRECT" ? " is-recovered" : ""}`}>
            <div><dt>开口方向</dt><dd>{state.submitPhase === "CORRECT" ? "判断正确" : conceptCopy(selectedOption.feedback.openingDirection)}</dd></div>
            <div><dt>对称轴</dt><dd>{state.submitPhase === "CORRECT" ? "判断正确" : conceptCopy(selectedOption.feedback.symmetryAxis)}</dd></div>
            <div><dt>顶点</dt><dd>{state.submitPhase === "CORRECT" ? "判断正确" : conceptCopy(selectedOption.feedback.vertexPosition)}</dd></div>
          </dl>
          <small>{state.submitPhase === "CORRECT"
            ? "本地 Fixture 判题完成；有效学习证据仍由服务端判断。"
            : "概念反馈不会直接公布正确图像，也不会创建服务端错题或掌握证据。"}</small>
        </div>
      ) : null}
    </section>
  );
}
