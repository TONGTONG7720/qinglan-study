import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { LearningStepper } from "../LearningStepper";
import { CoordinatePlotQuestion } from "./CoordinatePlotQuestion";
import { GraphPracticeQuestion } from "./GraphPracticeQuestion";
import { NumericPracticeQuestion } from "./NumericPracticeQuestion";
import { PracticeQuestion } from "./PracticeQuestion";
import { PracticeRightRail } from "./PracticeRightRail";
import { StructuredApplicationQuestion } from "./StructuredApplicationQuestion";
import type {
  GraphPracticeQuestion as GraphQuestionData,
  GraphSubmitPhase,
  NumericPracticeQuestion as NumericQuestionData,
  NumericSubmitPhase,
  PracticeDocument,
  PracticeQuestion as PracticeQuestionData,
  PracticeSubmitPhase,
  CoordinatePlotPracticeQuestion,
  MultipleChoicePracticeQuestion,
  StructuredApplicationPracticeQuestion,
} from "./types";
import { useCoordinatePlotSession } from "./use-coordinate-plot-session";
import { useGraphPracticeSession } from "./use-graph-practice-session";
import { useNumericPracticeSession } from "./use-numeric-practice-session";
import { usePractice } from "./use-practice";
import { usePracticeSession } from "./use-practice-session";
import { useStructuredApplicationSession } from "./use-structured-application-session";

export interface PracticeRouteProps {
  readonly courseId: string;
  readonly currentUser: CurrentUserResult;
  readonly knowledgeIntroUrl: string;
  readonly overviewUrl: string;
}

function isMultipleChoiceQuestion(question: PracticeQuestionData): question is MultipleChoicePracticeQuestion {
  return question.kind === "MULTIPLE_CHOICE";
}

function isNumericQuestion(question: PracticeQuestionData): question is NumericQuestionData {
  return question.kind === "NUMERIC_INPUT";
}

function isGraphQuestion(question: PracticeQuestionData): question is GraphQuestionData {
  return question.kind === "GRAPH_CHOICE";
}

function isCoordinatePlotQuestion(question: PracticeQuestionData): question is CoordinatePlotPracticeQuestion {
  return question.kind === "COORDINATE_PLOT";
}

function isStructuredApplicationQuestion(question: PracticeQuestionData): question is StructuredApplicationPracticeQuestion {
  return question.kind === "STRUCTURED_APPLICATION";
}

function PracticeLoading({ currentUser }: { readonly currentUser: CurrentUserResult }) {
  return (
    <div className="app-shell practice-shell">
      <Sidebar currentUser={currentUser} demoActive />
      <main className="practice-canvas service-state-page" id="main-content">
        <div aria-label="正在加载随堂练习" className="page-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

function PracticeUnavailable({
  currentUser,
  overviewUrl,
  fixtureMissing,
}: {
  readonly currentUser: CurrentUserResult;
  readonly overviewUrl: string;
  readonly fixtureMissing: boolean;
}) {
  return (
    <div className="app-shell practice-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive={false} />
      <main className="practice-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div><h1>随堂练习</h1><p>独立作答，及时校验</p></div>
          <span aria-hidden="true" className="page-header-rule" />
        </header>
        <StatusPanel
          description={fixtureMissing
            ? "当前开发 Fixture 只覆盖数学示例。其他课程不会复用不匹配的题目或答案。"
            : "当前没有面向 Web 的练习题聚合与提交接口。生产环境不会下载开发题目、答案或伪造错题和掌握证据。"}
          title={fixtureMissing ? "该课程没有随堂练习演示" : "随堂练习服务尚未接入"}
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export function PracticeServiceUnavailable({ currentUser, overviewUrl }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string }) {
  return <PracticeUnavailable currentUser={currentUser} fixtureMissing={false} overviewUrl={overviewUrl} />;
}

function PracticeProgress({ currentQuestionNumber, totalQuestions }: { readonly currentQuestionNumber: number; readonly totalQuestions: number }) {
  const progress = Math.round((currentQuestionNumber / totalQuestions) * 100);
  return (
    <div className="practice-progress" data-od-id="practice-progress">
      <div><strong>第 {currentQuestionNumber} 题 / 共 {totalQuestions} 题</strong><span>{progress}%</span></div>
      <progress aria-label="练习完成进度" max={100} value={progress}>{progress}%</progress>
    </div>
  );
}

function QuestionNavigator({
  currentQuestionNumber,
  totalQuestions,
  questionOnePhase,
  numericPhase,
  graphPhase,
}: {
  readonly currentQuestionNumber: number;
  readonly totalQuestions: number;
  readonly questionOnePhase: PracticeSubmitPhase;
  readonly numericPhase: NumericSubmitPhase;
  readonly graphPhase: GraphSubmitPhase;
}) {
  const questionOneRetry = ["INCORRECT_RETRYABLE", "RETRY_EDITING", "RETRY_CHECKING", "RETRY_UNAVAILABLE"].includes(questionOnePhase);
  const questionOneRecovered = questionOnePhase === "RECOVERED_CORRECT";
  const questionOneCorrect = questionOnePhase === "CORRECT";
  const numericRetry = numericPhase === "INCORRECT_RETRYABLE";
  const numericCorrect = numericPhase === "CORRECT";
  const graphRetry = graphPhase === "INCORRECT_RETRYABLE";
  const graphCorrect = graphPhase === "CORRECT";
  return (
    <ol className="practice-question-navigator" data-od-id="practice-question-navigator" aria-label="题目导航">
      {Array.from({ length: totalQuestions }, (_, index) => index + 1).map((number) => {
        const current = number === currentQuestionNumber;
        const finalQuestionContext = currentQuestionNumber === 5;
        const firstAnswered = number === 1 && currentQuestionNumber > 1;
        const secondAnswered = number === 2 && currentQuestionNumber > 2 && (numericCorrect || finalQuestionContext);
        const thirdAnswered = number === 3 && currentQuestionNumber > 3 && (graphCorrect || finalQuestionContext);
        const fourthAnswered = number === 4 && currentQuestionNumber > 4;
        const currentGraphCorrect = current && number === 3 && graphCorrect;
        const currentNeedsRetry = current && (
          (number === 1 && questionOneRetry) ||
          (number === 2 && numericRetry) ||
          (number === 3 && graphRetry)
        );
        const answerState = firstAnswered
          ? questionOneRecovered
            ? "is-recovered"
            : questionOneCorrect
              ? "is-correct"
              : "is-incorrect"
          : secondAnswered
            ? "is-correct"
            : thirdAnswered || currentGraphCorrect
              ? "is-correct"
              : fourthAnswered
                ? "is-correct"
            : "";
        const ariaStatus = current
          ? currentNeedsRetry
            ? "当前题，需要重试"
            : "当前题"
          : firstAnswered
            ? questionOneRecovered
              ? "已修正"
              : "已作答"
            : secondAnswered
              ? "已作答"
                : thirdAnswered
                  ? "已作答"
                  : fourthAnswered
                    ? "已作答"
                  : currentGraphCorrect
                  ? "当前题，已作答"
              : "待作答";
        return (
          <li key={number}>
            <button
              aria-current={current ? "step" : undefined}
              aria-label={`第 ${String(number)} 题，${ariaStatus}`}
              className={[current ? "is-current" : "", currentNeedsRetry ? "is-needs-retry" : "", answerState].filter(Boolean).join(" ")}
              disabled={!current}
              type="button"
            >
              {(firstAnswered && !questionOneRecovered) || secondAnswered || thirdAnswered || currentGraphCorrect
                ? <Icon name={(questionOneCorrect || secondAnswered || thirdAnswered || currentGraphCorrect) ? "check" : "circleAlert"} size={15} />
                : number}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function ExitPracticeDialog({
  dialogRef,
  onCancel,
  onConfirm,
}: {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <dialog
      aria-labelledby="practice-exit-title"
      className="practice-exit-dialog"
      data-od-id="practice-exit-dialog"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }}
      ref={dialogRef}
    >
      <div>
        <h2 id="practice-exit-title">退出当前练习？</h2>
        <p>你已选择答案但尚未提交。当前练习没有持久化接口，退出后这次选择不会保留。</p>
        <div className="practice-dialog-actions">
          <button autoFocus className="secondary-button" onClick={onCancel} type="button">继续作答</button>
          <button className="primary-button" onClick={onConfirm} type="button">退出练习</button>
        </div>
      </div>
    </dialog>
  );
}

function PracticeReady({
  currentUser,
  document,
  knowledgeIntroUrl,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly document: PracticeDocument;
  readonly knowledgeIntroUrl: string;
  readonly overviewUrl: string;
}) {
  const navigate = useNavigate();
  const question = document.questions.find(
    (item): item is MultipleChoicePracticeQuestion => item.number === 1 && isMultipleChoiceQuestion(item),
  );
  const numericQuestion = document.questions.find(
    (item): item is NumericQuestionData => item.number === 2 && isNumericQuestion(item),
  );
  const graphQuestion = document.questions.find(
    (item): item is GraphQuestionData => item.number === 3 && isGraphQuestion(item),
  );
  const coordinatePlotQuestion = document.questions.find(
    (item): item is CoordinatePlotPracticeQuestion => item.number === 4 && isCoordinatePlotQuestion(item),
  );
  const structuredApplicationQuestion = document.questions.find(
    (item): item is StructuredApplicationPracticeQuestion => item.number === 5 && isStructuredApplicationQuestion(item),
  );
  if (question === undefined) throw new Error("Practice fixture must include single-choice question one");
  if (numericQuestion === undefined) throw new Error("Practice fixture must include numeric question two");
  if (graphQuestion === undefined) throw new Error("Practice fixture must include graph question three");
  if (coordinatePlotQuestion === undefined) throw new Error("Practice fixture must include coordinate-plot question four");
  if (structuredApplicationQuestion === undefined) throw new Error("Practice fixture must include structured-application question five");
  const qaInitialQuestionIndex = import.meta.env.MODE !== "production" && import.meta.env.VITE_QA_PRACTICE_QUESTION === "5" ? 4 : 0;
  const session = usePracticeSession(question, qaInitialQuestionIndex);
  const numericSession = useNumericPracticeSession(numericQuestion);
  const graphSession = useGraphPracticeSession(graphQuestion);
  const coordinatePlotSession = useCoordinatePlotSession(coordinatePlotQuestion);
  const structuredApplicationSession = useStructuredApplicationSession(structuredApplicationQuestion);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const exitDialogRef = useRef<HTMLDialogElement>(null);
  const exitTriggerRef = useRef<HTMLButtonElement>(null);
  const currentQuestionNumber = session.state.currentQuestionIndex + 1;
  const retryFeedback = [
    "INCORRECT_RETRYABLE",
    "RETRY_EDITING",
    "RETRY_CHECKING",
    "RETRY_UNAVAILABLE",
  ].includes(session.state.submitPhase);
  const retryEditing = ["RETRY_EDITING", "RETRY_CHECKING", "RETRY_UNAVAILABLE"].includes(session.state.submitPhase);
  const recovered = session.state.submitPhase === "RECOVERED_CORRECT";
  const numericRetry = numericSession.state.submitPhase === "INCORRECT_RETRYABLE";
  const numericCorrect = numericSession.state.submitPhase === "CORRECT";
  const numericActive = session.state.currentQuestionIndex === 1;
  const graphActive = session.state.currentQuestionIndex === 2;
  const questionFourActive = session.state.currentQuestionIndex === 3;
  const questionFiveActive = session.state.currentQuestionIndex === 4;
  const graphCorrect = graphSession.state.submitPhase === "CORRECT";
  const graphRetry = graphSession.state.submitPhase === "INCORRECT_RETRYABLE";

  useEffect(() => {
    if (announcement === null) return undefined;
    const timer = window.setTimeout(() => { setAnnouncement(null); }, 4_000);
    return () => { window.clearTimeout(timer); };
  }, [announcement]);

  useEffect(() => {
    if (session.state.submitPhase === "RETRY_UNAVAILABLE") {
      setAnnouncement("重试提交尚未接入；当前仅演示选择。");
    }
  }, [session.state.submitPhase]);

  function closeExitDialog(): void {
    exitDialogRef.current?.close();
    window.setTimeout(() => { exitTriggerRef.current?.focus(); }, 0);
  }

  function requestExit(): void {
    if (
      session.hasUnsubmittedSelection ||
      (numericActive && numericSession.hasUnsubmittedInput) ||
      (graphActive && graphSession.hasUnsubmittedSelection) ||
      (questionFourActive && coordinatePlotSession.hasUnsubmittedWork) ||
      (questionFiveActive && structuredApplicationSession.hasUnsubmittedWork)
    ) {
      exitDialogRef.current?.showModal();
      return;
    }
    void navigate(overviewUrl);
  }

  function activateStep(stepId: string, label: string): void {
    if (stepId === "INTRO") {
      void navigate(knowledgeIntroUrl);
      return;
    }
    setAnnouncement(`${label}尚未作为独立 Web 状态接入；不会创建新路由。`);
  }

  return (
    <div className="app-shell practice-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive />

      <main className="practice-canvas" data-od-id="practice-page" id="main-content">
        <div className="practice-page">
          <header className="practice-header">
            <nav aria-label="面包屑" className="knowledge-breadcrumb" data-od-id="practice-breadcrumb">
              <Link to={overviewUrl}>课程与资料</Link><Icon name="chevronRight" size={16} />
              <span>{document.subjectLabel}</span><Icon name="chevronRight" size={16} />
              <span>{document.lessonLabel}</span>
            </nav>
            <div className="practice-title-row">
              <div>
                <h1>{document.title}</h1>
                <p>{graphActive
                  ? "观察图像，辨析特征"
                  : questionFourActive
                    ? "描点成图，核对函数特征"
                    : questionFiveActive
                      ? "综合应用，说明判断依据"
                    : numericActive
                      ? "独立计算，准确表达"
                      : recovered
                    ? "修正判断，继续前进"
                    : retryFeedback
                      ? "发现问题，重新判断"
                      : document.subtitle}</p>
                <span className="fixture-badge">Fixture 演示</span>
              </div>
              <div className="practice-date" aria-label={`${document.date}，${document.weekdayChinese}`}>
                <small>{document.weekdayEnglish}</small>
                <strong>{document.date}</strong>
                <span>{document.weekdayChinese} · 学习流程固定日期</span>
              </div>
            </div>
          </header>

          <div className="practice-layout">
            <div className="practice-learning-column">
              <LearningStepper
                currentStepNumber={3}
                estimatedMinutes={document.estimatedMinutes}
                odId="practice-stepper"
                onStepActivate={(step) => { activateStep(step.id, step.label); }}
                steps={document.steps}
              />

              <article className={`practice-main-column${questionFourActive ? " is-coordinate-plot" : questionFiveActive ? " is-structured-application" : ""}`} aria-labelledby="practice-section-title">
              {questionFourActive || questionFiveActive ? <>
                <div className="coordinate-progress-row">
                  <PracticeProgress currentQuestionNumber={currentQuestionNumber} totalQuestions={document.totalQuestions} />
                  <QuestionNavigator
                    currentQuestionNumber={currentQuestionNumber}
                    graphPhase={graphSession.state.submitPhase}
                    numericPhase={numericSession.state.submitPhase}
                    questionOnePhase={session.state.submitPhase}
                    totalQuestions={document.totalQuestions}
                  />
                </div>
                <div className="coordinate-section-heading">
                  <h2 className="practice-section-title" id="practice-section-title">{questionFiveActive ? "综合练习" : "基础练习"}</h2>
                  <div className="practice-question-meta">
                    {questionFiveActive
                      ? <><span>第 5 题 / 共 5 题</span><span>结构化作答</span><span>实际应用</span><span className="practice-recovered-context">第 1 题已修正 · 第 2–4 题已完成</span></>
                      : <><span>第 4 题 / 共 5 题</span><span>描点绘图</span><span>函数图像</span><span className="practice-recovered-context">第 1 题已修正 · 第 2–3 题已完成</span></>}
                  </div>
                </div>
              </> : <>
                <h2 className="practice-section-title" id="practice-section-title">基础练习</h2>
                <PracticeProgress currentQuestionNumber={currentQuestionNumber} totalQuestions={document.totalQuestions} />
                <QuestionNavigator
                  currentQuestionNumber={currentQuestionNumber}
                  graphPhase={graphSession.state.submitPhase}
                  numericPhase={numericSession.state.submitPhase}
                  questionOnePhase={session.state.submitPhase}
                  totalQuestions={document.totalQuestions}
                />
              </>}

              {session.state.currentQuestionIndex === 0 ? (
                <PracticeQuestion
                  onSelect={session.selectOption}
                  question={question}
                  selectedOptionId={session.state.selectedOptionId}
                  submitPhase={session.state.submitPhase}
                  previousOptionIds={session.state.previousOptionIds}
                />
              ) : session.state.currentQuestionIndex === 1 ? (
                <NumericPracticeQuestion
                  onAnswerChange={numericSession.setAnswerInput}
                  onCalculationChange={numericSession.setCalculationDraft}
                  onCompositionEnd={numericSession.endComposition}
                  onCompositionStart={numericSession.startComposition}
                  question={numericQuestion}
                  state={numericSession.state}
                />
              ) : session.state.currentQuestionIndex === 2 ? (
                <GraphPracticeQuestion
                  onSelect={graphSession.selectOption}
                  question={graphQuestion}
                  state={graphSession.state}
                />
              ) : session.state.currentQuestionIndex === 3 ? (
                <CoordinatePlotQuestion question={coordinatePlotQuestion} session={coordinatePlotSession} />
              ) : (
                <StructuredApplicationQuestion question={structuredApplicationQuestion} session={structuredApplicationSession} />
              )}

              {session.state.currentQuestionIndex === 0 && !retryFeedback && !recovered && session.state.submitPhase !== "CORRECT" ? (
                <section className="practice-inline-hint" aria-label="提示 1">
                  <p>{session.state.hintOneUsed ? document.hintOne : "需要提示？提示 1 只帮助观察二次项系数。"}</p>
                  <button
                    aria-expanded={session.state.hintOneUsed}
                    className="text-button"
                    disabled={session.state.hintOneUsed}
                    onClick={session.useHintOne}
                    type="button"
                  >
                    {session.state.hintOneUsed ? "提示 1 已展开" : "查看提示 1"}
                  </button>
                </section>
              ) : numericActive && !numericCorrect ? (
                <section className="practice-inline-hint" aria-label="提示 1">
                  <p>{numericSession.state.hintOneOpen
                    ? numericQuestion.hintOne
                    : "需要提示？先独立尝试；提示 1 不会给出最终答案。"}</p>
                  <button
                    aria-expanded={numericSession.state.hintOneOpen}
                    className="text-button"
                    onClick={numericSession.useHintOne}
                    type="button"
                  >
                    {numericSession.state.hintOneOpen ? "收起提示 1" : numericSession.state.hintOneUsed ? "再次查看提示 1" : "查看提示 1"}
                  </button>
                </section>
              ) : graphActive && !graphCorrect ? (
                <section className="practice-inline-hint" aria-label="提示 1">
                  <p>{graphSession.state.hintOneOpen
                    ? graphQuestion.hintOne
                    : "需要提示？先说出你的观察顺序；提示不会直接给出选项字母。"}</p>
                  <button
                    aria-expanded={graphSession.state.hintOneOpen}
                    className="text-button"
                    onClick={graphSession.useHintOne}
                    type="button"
                  >{graphSession.state.hintOneOpen ? "收起提示 1" : graphSession.state.hintOneUsed ? "再次查看提示 1" : "查看提示 1"}</button>
                </section>
              ) : questionFiveActive ? (
                <section className="practice-inline-hint" aria-label="提示 1">
                  <p>{structuredApplicationSession.state.hintOneOpen
                    ? structuredApplicationQuestion.hintOne
                    : "需要提示？先独立区分最高点、地面交点和宽度；提示不会给出数值答案。"}</p>
                  <button
                    aria-expanded={structuredApplicationSession.state.hintOneOpen}
                    className="text-button"
                    onClick={structuredApplicationSession.useHintOne}
                    type="button"
                  >{structuredApplicationSession.state.hintOneOpen ? "收起提示 1" : structuredApplicationSession.state.hintOneUsed ? "再次查看提示 1" : "查看提示 1"}</button>
                </section>
              ) : null}

              <footer className="practice-actions">
                <div className="practice-action-row">
                  <button
                    className="secondary-button"
                    disabled={session.state.currentQuestionIndex === 0}
                    onClick={questionFiveActive
                      ? () => { setAnnouncement("第 4 题已完成；当前开发 Fixture 不重建服务端作图记录。"); }
                      : session.previousQuestion}
                    type="button"
                  >上一题</button>
                  {questionFiveActive ? <>
                    <button
                      aria-pressed={structuredApplicationSession.state.markedForReview}
                      className={`practice-review-toggle${structuredApplicationSession.state.markedForReview ? " is-marked" : ""}`}
                      onClick={structuredApplicationSession.toggleReview}
                      type="button"
                    ><span aria-hidden="true" />{structuredApplicationSession.state.markedForReview ? "已标记稍后检查" : "标记稍后检查"}</button>
                    <button className="practice-exit-action" onClick={requestExit} ref={exitTriggerRef} type="button">退出练习<Icon name="arrowRight" size={16} /></button>
                    <button
                      aria-busy={structuredApplicationSession.state.phase === "SUBMITTING"}
                      aria-describedby="practice-submit-helper"
                      className="primary-button practice-submit-button structured-submit-button"
                      disabled={!structuredApplicationSession.submitEnabled}
                      form="structured-application-form"
                      type="submit"
                    >{structuredApplicationSession.state.phase === "SUBMITTING" ? "正在提交…" : "提交本题并完成练习"}</button>
                  </> : questionFourActive ? <>
                    <button
                      aria-pressed={coordinatePlotSession.state.markedForReview}
                      className={`practice-review-toggle${coordinatePlotSession.state.markedForReview ? " is-marked" : ""}`}
                      onClick={coordinatePlotSession.toggleReview}
                      type="button"
                    ><span aria-hidden="true" />{coordinatePlotSession.state.markedForReview ? "已标记稍后检查" : "标记稍后检查"}</button>
                    <button className="practice-exit-action" onClick={requestExit} ref={exitTriggerRef} type="button">退出练习<Icon name="arrowRight" size={16} /></button>
                    <button
                      aria-busy={coordinatePlotSession.state.phase === "SUBMITTING"}
                      aria-describedby="practice-submit-helper"
                      className="primary-button practice-submit-button coordinate-submit-button"
                      disabled={!coordinatePlotSession.canSubmit || coordinatePlotSession.state.phase === "SUBMITTING"}
                      onClick={coordinatePlotSession.submit}
                      type="button"
                    >{coordinatePlotSession.state.phase === "SUBMITTING" ? "正在校验…" : "提交作图"}</button>
                  </> : session.state.currentQuestionIndex === 0 && (session.state.submitPhase === "CORRECT" || recovered) ? (
                    <button className="primary-button practice-submit-button" onClick={session.nextQuestion} type="button">
                      {recovered ? "进入第 2 题" : "下一题"}<Icon name="arrowRight" size={18} />
                    </button>
                  ) : session.state.currentQuestionIndex === 0 && session.state.submitPhase === "INCORRECT_RETRYABLE" ? (
                    <button className="primary-button practice-submit-button practice-retry-button" onClick={session.startRetry} type="button">
                      修改答案并重新提交
                    </button>
                  ) : session.state.currentQuestionIndex === 0 ? (
                    <button
                      aria-busy={session.state.submitPhase === "CHECKING" || session.state.submitPhase === "RETRY_CHECKING"}
                      aria-describedby="practice-submit-helper"
                      className="primary-button practice-submit-button"
                      disabled={!session.submitEnabled || session.state.submitPhase === "CHECKING" || session.state.submitPhase === "RETRY_CHECKING"}
                      onClick={session.submit}
                      type="button"
                    >{session.state.submitPhase === "CHECKING"
                      ? "检查中…"
                      : session.state.submitPhase === "RETRY_CHECKING"
                        ? "提交中…"
                        : retryEditing
                          ? "重新提交答案"
                          : "提交答案"}</button>
                  ) : session.state.currentQuestionIndex === 1 && numericCorrect ? (
                    <button className="primary-button practice-submit-button" onClick={session.openQuestionThree} type="button">
                      进入第 3 题<Icon name="arrowRight" size={18} />
                    </button>
                  ) : session.state.currentQuestionIndex === 1 ? (
                    <button
                      aria-busy={numericSession.state.submitPhase === "CHECKING"}
                      aria-describedby="practice-submit-helper"
                      className="primary-button practice-submit-button"
                      disabled={!numericSession.submitEnabled}
                      onClick={numericSession.submit}
                      type="button"
                    >{numericSession.state.submitPhase === "CHECKING" ? "检查中…" : numericRetry ? "重新提交答案" : "提交答案"}</button>
                  ) : graphActive && graphCorrect ? (
                    <button className="primary-button practice-submit-button" onClick={session.openQuestionFour} type="button">
                      进入第 4 题<Icon name="arrowRight" size={18} />
                    </button>
                  ) : graphActive ? (
                    <button
                      aria-busy={graphSession.state.submitPhase === "CHECKING"}
                      aria-describedby="practice-submit-helper"
                      className="primary-button practice-submit-button"
                      disabled={!graphSession.submitEnabled}
                      onClick={graphSession.submit}
                      type="button"
                    >{graphSession.state.submitPhase === "CHECKING" ? "检查中…" : graphRetry ? "重新提交答案" : "提交答案"}</button>
                  ) : null}
                  {questionFourActive || questionFiveActive ? null : session.state.currentQuestionIndex === 0 && recovered ? <>
                    <button aria-describedby="practice-submit-helper" className="secondary-button" disabled type="button">保存恢复过程</button>
                    <button aria-expanded={explanationOpen} className="practice-exit-action" onClick={() => { setExplanationOpen((value) => !value); }} type="button">{explanationOpen ? "收起完整解析" : "查看完整解析"}<Icon name="arrowRight" size={16} /></button>
                  </> : <><button
                    aria-pressed={graphActive ? graphSession.state.markedForReview : session.state.markedForReview}
                    className={`practice-review-toggle${(graphActive ? graphSession.state.markedForReview : session.state.markedForReview) ? " is-marked" : ""}`}
                    onClick={graphActive ? graphSession.toggleReview : session.toggleReview}
                    type="button"
                  >
                    <span aria-hidden="true" />
                    {(graphActive ? graphSession.state.markedForReview : session.state.markedForReview) ? "已标记稍后检查" : "标记稍后检查"}
                  </button>
                  <button className="practice-exit-action" onClick={requestExit} ref={exitTriggerRef} type="button">
                    退出练习<Icon name="arrowRight" size={16} />
                  </button></>}
                </div>
                <p aria-live="polite" id="practice-submit-helper">
                  {questionFiveActive
                    ? structuredApplicationSession.state.phase === "SUBMITTING"
                      ? "正在检查结构化作答服务接入状态。"
                      : structuredApplicationSession.state.phase === "SERVICE_UNAVAILABLE"
                        ? "提交服务尚未接入；全部输入仍保留在本页。"
                        : structuredApplicationSession.completion.allComplete
                          ? "4 项必填内容已完成；提交前不会判断答案正确性。"
                          : "请完成 4 项必填内容"
                    : questionFourActive
                    ? coordinatePlotSession.state.phase === "SUBMITTING"
                      ? "正在校验作图服务接入状态。"
                      : coordinatePlotSession.state.phase === "SERVICE_UNAVAILABLE"
                        ? "提交服务尚未接入；点位和学生曲线仍保留在本页。"
                        : coordinatePlotSession.state.curveConnected
                          ? "学生曲线已连接；可提交作图。"
                          : `请先描出 ${String(coordinatePlotQuestion.requiredPointCount)} 个点并连接曲线`
                    : graphActive
                      ? graphCorrect
                        ? "本地图像判断完成；有效证据仍待服务端确认。"
                        : graphSession.state.submitPhase === "CHECKING"
                          ? "正在进行本地 Fixture 图像特征校验。"
                          : graphRetry
                            ? "可重新选择图像；当前 Web 尚未创建错题或掌握证据。"
                            : graphSession.state.selectedOptionId === null
                              ? "请选择一幅图像"
                              : "已选择图像；提交前仍可更换。"
                    : numericActive
                      ? numericCorrect
                        ? "本地判题完成；学习证据仍待服务端确认。"
                        : numericSession.state.submitPhase === "CHECKING"
                          ? "正在进行本地 Fixture 数值校验。"
                          : numericRetry
                            ? "可修改最终答案后重新提交；当前 Web 尚未创建错题或恢复尝试。"
                            : numericSession.state.inputState === "EMPTY"
                              ? "请输入答案"
                              : numericSession.state.inputState === "TYPING_INCOMPLETE"
                                ? "请完成数值输入"
                                : numericSession.state.inputState === "INVALID_FORMAT"
                                  ? "格式错误：仅填写一个有限数值"
                                  : "格式有效；提交前不会判定正确性"
                    : recovered
                      ? "本地恢复完成；保存功能尚未接入，证据与掌握度未更新。"
                    : session.state.submitPhase === "INCORRECT_RETRYABLE"
                      ? "可重新选择 A–D；当前 Web 尚未写入恢复尝试。"
                      : session.state.submitPhase === "RETRY_EDITING"
                        ? "可更换答案；再次提交前只显示选择状态。"
                        : session.state.submitPhase === "RETRY_CHECKING"
                          ? "正在检查重试服务接入状态。"
                          : session.state.submitPhase === "RETRY_UNAVAILABLE"
                            ? "重试提交尚未接入；当前仅演示选择。"
                    : session.state.submitPhase === "IDLE" && session.state.selectedOptionId === null
                      ? "请选择一个答案"
                      : session.state.submitPhase === "IDLE"
                        ? "已选择答案；提交前仍可更换。"
                        : session.state.submitPhase === "CHECKING"
                          ? "正在进行本地 Fixture 校验。"
                          : "已完成第 1 题，可进入第 2 题。"}
                </p>
              </footer>
              {recovered && explanationOpen ? (
                <section aria-labelledby="practice-full-explanation-title" className="practice-full-explanation">
                  <h2 id="practice-full-explanation-title">完整解析</h2>
                  <p>本次状态：使用提示 1 后独立修正；提示 2 未使用。</p>
                  <p>二次项系数 a = -2 &lt; 0，所以抛物线开口向下。函数没有一次项，可写为 y = -2(x-0)² + 1，因此对称轴为直线 x = 0，顶点为 (0,1)。</p>
                  <small>查看解析不会保存证据、更新掌握度或创建服务端恢复记录。</small>
                </section>
              ) : null}
              </article>
            </div>

            <span aria-hidden="true" className="practice-rail-divider" />
            <PracticeRightRail
              currentQuestionNumber={currentQuestionNumber}
              document={document}
              draftFileName={session.state.draftFileName}
              graphQuestion={graphQuestion}
              graphState={graphSession.state}
              coordinatePlotQuestion={coordinatePlotQuestion}
              coordinatePlotState={coordinatePlotSession.state}
              structuredApplicationQuestion={structuredApplicationQuestion}
              structuredApplicationState={structuredApplicationSession.state}
              structuredApplicationCompletion={structuredApplicationSession.completion}
              hintOneUsed={session.state.hintOneUsed}
              hintOneOpen={session.state.hintOneOpen}
              hintTwoOpen={session.state.hintTwoOpen}
              hintTwoUnlocked={session.hintTwoUnlocked}
              markedForReview={questionFiveActive ? structuredApplicationSession.state.markedForReview : questionFourActive ? coordinatePlotSession.state.markedForReview : graphActive ? graphSession.state.markedForReview : session.state.markedForReview}
              numericQuestion={numericQuestion}
              numericState={numericSession.state}
              ocrState={questionFiveActive ? structuredApplicationSession.state.draftOcrState : session.state.draftOcrState}
              onConfirmDraft={questionFiveActive ? structuredApplicationSession.confirmDraft : session.confirmDraft}
              onToggleGraphHintTwo={graphSession.toggleHintTwo}
              onToggleNumericHintTwo={numericSession.toggleHintTwo}
              onToggleHintTwo={session.toggleHintTwo}
              onUploadDraft={questionFiveActive ? structuredApplicationSession.uploadDraft : session.uploadDraft}
              onUseNumericHintOne={numericSession.useHintOne}
              onUseGraphHintOne={graphSession.useHintOne}
              onUseCoordinateHintOne={coordinatePlotSession.useHintOne}
              onToggleCoordinateHintTwo={coordinatePlotSession.toggleHintTwo}
              onUseStructuredHintOne={structuredApplicationSession.useHintOne}
              onToggleStructuredHintTwo={structuredApplicationSession.toggleHintTwo}
              onUseHintOne={session.useHintOne}
              submitPhase={session.state.submitPhase}
            />
          </div>
        </div>
      </main>

      <ExitPracticeDialog
        dialogRef={exitDialogRef}
        onCancel={closeExitDialog}
        onConfirm={() => { exitDialogRef.current?.close(); void navigate(overviewUrl); }}
      />

      {announcement === null ? null : (
        <div className="toast" role="status">
          <Icon name="info" size={18} /><span>{announcement}</span>
          <button aria-label="关闭提示" onClick={() => { setAnnouncement(null); }} type="button">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

export function PracticeRoute({ courseId, currentUser, knowledgeIntroUrl, overviewUrl }: PracticeRouteProps) {
  const state = usePractice(courseId);
  if (state.status === "loading") return <PracticeLoading currentUser={currentUser} />;
  if (state.status === "error") {
    return (
      <div className="app-shell practice-shell">
        <Sidebar currentUser={currentUser} demoActive={false} />
        <main className="practice-canvas service-state-page" id="main-content">
          <StatusPanel actionLabel="重新加载" description="随堂练习数据初始化失败，请重试。" onAction={() => { window.location.reload(); }} title="无法加载随堂练习" tone="error" />
        </main>
      </div>
    );
  }
  if (state.result.status === "unavailable") {
    return (
      <PracticeUnavailable
        currentUser={currentUser}
        fixtureMissing={state.result.reason === "FIXTURE_NOT_AVAILABLE_FOR_COURSE"}
        overviewUrl={overviewUrl}
      />
    );
  }
  return (
    <PracticeReady
      currentUser={currentUser}
      document={state.result.document}
      knowledgeIntroUrl={knowledgeIntroUrl}
      overviewUrl={overviewUrl}
    />
  );
}
