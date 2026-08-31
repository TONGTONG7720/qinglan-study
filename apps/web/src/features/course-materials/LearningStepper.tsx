import { Icon } from "../../components/Icon";

export type LearningStepId = "INTRO" | "EXAMPLE" | "PRACTICE" | "SUMMARY";
export type LearningStepState = "COMPLETED" | "CURRENT" | "UPCOMING" | "DISABLED";

export interface LearningStepDefinition {
  readonly id: LearningStepId;
  readonly label: string;
  readonly state: LearningStepState;
}

export interface LearningStepperProps {
  readonly steps: readonly LearningStepDefinition[];
  readonly currentStepNumber: number;
  readonly estimatedMinutes: number;
  readonly onStepActivate?: (step: LearningStepDefinition) => void;
  readonly odId: string;
}

function StepMark({ index, state }: { readonly index: number; readonly state: LearningStepState }) {
  return (
    <i aria-hidden="true">
      {state === "COMPLETED" ? <Icon name="check" size={12} /> : index + 1}
    </i>
  );
}

export function LearningStepper({
  steps,
  currentStepNumber,
  estimatedMinutes,
  onStepActivate,
  odId,
}: LearningStepperProps) {
  return (
    <nav className="study-stepper" data-od-id={odId} aria-label="学习步骤">
      <ol>
        {steps.map((step, index) => {
          const className = `is-${step.state.toLowerCase()}`;
          if (step.state === "CURRENT") {
            return (
              <li className={className} key={step.id}>
                <span aria-current="step">
                  <StepMark index={index} state={step.state} />
                  <strong>{step.label}</strong>
                </span>
              </li>
            );
          }

          const disabled = step.state === "DISABLED" || onStepActivate === undefined;
          return (
            <li className={className} key={step.id}>
              <button
                aria-label={`${step.label}${step.state === "COMPLETED" ? "，已完成" : "，待开始"}`}
                disabled={disabled}
                onClick={() => { onStepActivate?.(step); }}
                type="button"
              >
                <StepMark index={index} state={step.state} />
                <strong>{step.label}</strong>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="study-progress-meta">
        <span>第 {currentStepNumber} 步 / 共 {steps.length} 步</span>
        <small>预计 {estimatedMinutes} 分钟</small>
      </div>
    </nav>
  );
}
