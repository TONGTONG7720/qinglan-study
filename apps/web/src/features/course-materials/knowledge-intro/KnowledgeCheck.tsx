import { useEffect, useRef, useState } from "react";

import { Icon } from "../../../components/Icon";
import type { KnowledgeIntroDocument, KnowledgeChoice } from "./types";

type CheckPhase = "idle" | "checking" | "correct" | "incorrect";

export interface KnowledgeCheckProps {
  readonly check: KnowledgeIntroDocument["check"];
}

export function KnowledgeCheck({ check }: KnowledgeCheckProps) {
  const [selectedChoiceId, setSelectedChoiceId] = useState<KnowledgeChoice["id"] | null>(null);
  const [phase, setPhase] = useState<CheckPhase>("idle");
  const timeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  function selectChoice(choiceId: KnowledgeChoice["id"]): void {
    setSelectedChoiceId(choiceId);
    setPhase("idle");
  }

  function checkAnswer(): void {
    if (selectedChoiceId === null || phase === "checking") {
      return;
    }
    setPhase("checking");
    timeoutRef.current = window.setTimeout(() => {
      setPhase(selectedChoiceId === check.correctChoiceId ? "correct" : "incorrect");
      timeoutRef.current = null;
    }, 220);
  }

  return (
    <section className="knowledge-check" data-od-id="knowledge-check" aria-labelledby="knowledge-check-title">
      <fieldset disabled={phase === "checking"}>
        <legend id="knowledge-check-title">理解检查</legend>
        <p>{check.question}</p>
        <div className="choice-grid">
          {check.choices.map((choice) => {
            const selected = selectedChoiceId === choice.id;
            const correct = phase !== "idle" && phase !== "checking" && choice.id === check.correctChoiceId;
            const incorrect = phase === "incorrect" && selected && choice.id !== check.correctChoiceId;
            const className = [
              "choice-option",
              selected ? "is-selected" : "",
              correct ? "is-correct" : "",
              incorrect ? "is-incorrect" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <label className={className} data-od-id={`knowledge-choice-${choice.id.toLowerCase()}`} key={choice.id}>
                <input
                  checked={selected}
                  name="knowledge-intro-answer"
                  onChange={() => { selectChoice(choice.id); }}
                  type="radio"
                  value={choice.id}
                />
                <span className="choice-control" aria-hidden="true" />
                <span>
                  <strong>{choice.id}.</strong> {choice.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        aria-busy={phase === "checking"}
        className="secondary-button check-answer-button"
        data-od-id="knowledge-check-answer"
        disabled={selectedChoiceId === null || phase === "checking"}
        onClick={checkAnswer}
        type="button"
      >
        {phase === "checking" ? "检查中…" : "检查答案"}
      </button>

      {phase === "correct" || phase === "incorrect" ? (
        <div
          className={`answer-feedback is-${phase}`}
          data-od-id="knowledge-answer-feedback"
          role={phase === "correct" ? "status" : "alert"}
        >
          <Icon name={phase === "correct" ? "check" : "circleAlert"} size={20} />
          <div>
            <strong>{phase === "correct" ? "回答正确" : "再想一想"}</strong>
            <p>{phase === "correct" ? check.correctFeedback : check.incorrectFeedback}</p>
            <small>{check.explanation}</small>
          </div>
        </div>
      ) : null}
    </section>
  );
}
