import type { ChangeEvent } from "react";

import { Icon } from "../../../components/Icon";
import type {
  DraftOcrState,
  CoordinatePlotPracticeQuestion,
  CoordinatePlotSessionState,
  GraphPracticeQuestion,
  GraphPracticeSessionState,
  NumericPracticeQuestion,
  NumericPracticeSessionState,
  PracticeDocument,
  PracticeSubmitPhase,
  StructuredApplicationCompletion,
  StructuredApplicationPracticeQuestion,
  StructuredApplicationSessionState,
} from "./types";

function RailSection({ title, className, children }: { readonly title: string; readonly className: string; readonly children: React.ReactNode }) {
  return (
    <section className={`practice-rail-section ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function OcrStatusCopy({ state, fileName }: { readonly state: DraftOcrState; readonly fileName: string | null }) {
  if (state === "EMPTY") return <p>尚未上传本题草稿；识别结果需要由学生确认。</p>;
  if (state === "UPLOADING") return <p role="status">正在读取本地文件…</p>;
  if (state === "PROCESSING") return <p role="status">正在准备确认状态；不会生成虚构识别文本。</p>;
  if (state === "NEEDS_CONFIRMATION") return <p role="status">{fileName} 已进入确认步骤；开发 Fixture 未生成 OCR 文本或置信度。</p>;
  return <p role="status">已确认本地文件；尚未调用 OCR、保存证据或更新掌握度。</p>;
}

interface NumericPracticeRightRailProps {
  readonly document: PracticeDocument;
  readonly currentQuestionNumber: number;
  readonly questionOnePhase: PracticeSubmitPhase;
  readonly question: NumericPracticeQuestion;
  readonly state: NumericPracticeSessionState;
  readonly markedForReview: boolean;
  readonly ocrState: DraftOcrState;
  readonly draftFileName: string | null;
  readonly onUseHintOne: () => void;
  readonly onToggleHintTwo: () => void;
  readonly onUploadDraft: (fileName: string) => void;
  readonly onConfirmDraft: () => void;
}

function NumericPracticeRightRail({
  document,
  currentQuestionNumber,
  questionOnePhase,
  question,
  state,
  markedForReview,
  ocrState,
  draftFileName,
  onUseHintOne,
  onToggleHintTwo,
  onUploadDraft,
  onConfirmDraft,
}: NumericPracticeRightRailProps) {
  const questionStates = Array.from({ length: document.totalQuestions }, (_, index) => index + 1);
  const questionOneRecovered = questionOnePhase === "RECOVERED_CORRECT";
  const questionOneCorrect = questionOnePhase === "CORRECT";
  const numericRetry = state.submitPhase === "INCORRECT_RETRYABLE";
  const numericCorrect = state.submitPhase === "CORRECT";
  const hintTwoUnlocked = state.hintOneUsed && state.hadIncorrectAttempt;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file !== undefined) onUploadDraft(file.name);
    event.target.value = "";
  }

  function questionStatus(number: number): string {
    if (number === currentQuestionNumber) return numericRetry && number === 2 ? "当前，需要重试" : "当前";
    if (number === 1 && questionOneRecovered) return "已修正";
    if (number === 1 && questionOneCorrect) return "已作答";
    if (number === 2 && currentQuestionNumber > 2 && numericCorrect) return "已作答";
    return "待作答";
  }

  function questionClass(number: number): string {
    if (number === currentQuestionNumber) return numericRetry && number === 2 ? "is-current is-needs-retry" : "is-current";
    if (number === 1 && questionOneRecovered) return "is-recovered";
    if ((number === 1 && questionOneCorrect) || (number === 2 && currentQuestionNumber > 2 && numericCorrect)) return "is-correct";
    return "";
  }

  return (
    <aside className="practice-right-rail is-numeric" data-od-id="practice-right-rail" aria-label="随堂练习辅助信息">
      <RailSection className="practice-rail-progress" title="练习进度">
        <span>{currentQuestionNumber} / {document.totalQuestions}</span>
        <ol aria-label="题目状态">
          {questionStates.map((number) => (
            <li
              aria-current={number === currentQuestionNumber ? "step" : undefined}
              aria-label={`第 ${String(number)} 题，${questionStatus(number)}`}
              className={questionClass(number)}
              key={number}
            ><span>{number}</span></li>
          ))}
        </ol>
      </RailSection>

      <RailSection className="practice-answer-guidance" title={numericCorrect || numericRetry ? "答题反馈" : "输入格式"}>
        {numericCorrect ? (
          <ul><li>最终答案：计算正确</li><li>提交后才显示完整计算解析</li><li>证据与掌握度仍待服务端确认</li></ul>
        ) : numericRetry ? (
          <ul><li>检查 x 的代入是否正确</li><li>检查乘方、乘法、加法顺序</li><li>检查负号是否保留</li></ul>
        ) : (
          <ul><li>计算过程可选，最多 300 字</li><li>最终答案只填写一个有限数值</li><li>提交后才检查正确性</li></ul>
        )}
      </RailSection>

      <RailSection className="practice-draft" title="我的草稿">
        <OcrStatusCopy fileName={draftFileName} state={ocrState} />
        {ocrState === "NEEDS_CONFIRMATION" ? (
          <button className="secondary-button" data-od-id="practice-confirm-draft" onClick={onConfirmDraft} type="button">确认本地文件</button>
        ) : (
          <label className="secondary-button practice-upload-button">
            <Icon name="upload" size={18} />
            <span>{ocrState === "EMPTY" || ocrState === "CONFIRMED" ? "上传草稿" : "处理中…"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="上传本题草稿图片"
              autoComplete="off"
              disabled={ocrState === "UPLOADING" || ocrState === "PROCESSING"}
              name="practiceDraft"
              onChange={handleFileChange}
              type="file"
            />
          </label>
        )}
      </RailSection>

      <RailSection className="practice-hints" title="分层提示">
        <div className="practice-hint-item">
          <div><strong>提示 1</strong><small>{state.hintOneUsed ? "已使用" : "未使用"}</small></div>
          <button aria-expanded={state.hintOneOpen} className="text-button" onClick={onUseHintOne} type="button">
            {state.hintOneOpen ? "收起提示 1" : state.hintOneUsed ? "再次查看提示 1" : "查看提示 1"}
          </button>
        </div>
        {state.hintOneOpen ? <p className="practice-hint-copy">{question.hintOne}</p> : null}
        <div className="practice-hint-item">
          <div><strong>提示 2</strong><small>{hintTwoUnlocked ? "已解锁" : "未解锁"}</small></div>
          <button
            aria-describedby="practice-hint-two-rule"
            aria-expanded={state.hintTwoOpen}
            className="text-button"
            disabled={!hintTwoUnlocked}
            onClick={onToggleHintTwo}
            type="button"
          >{hintTwoUnlocked ? state.hintTwoOpen ? "收起提示 2" : "查看提示 2" : "尚未解锁"}</button>
        </div>
        <p className="service-boundary-copy" id="practice-hint-two-rule">
          {hintTwoUnlocked ? "提示 1 已使用且已有一次错误提交；提示 2 仍不直接给出最终答案。" : "使用提示 1 并完成一次错误提交后解锁。"}
        </p>
        {state.hintTwoOpen ? <p className="practice-hint-copy">{question.hintTwo}</p> : null}
      </RailSection>

      <RailSection className="practice-ai" title="AI 辅导">
        <p>代入、平方或负号运算有疑问？先写出计算过程，辅导会按提示顺序检查。</p>
        <p>当前 Web 尚未接入生产辅导；不会自动发送草稿或直接代算答案。</p>
        <button className="secondary-button" disabled type="button">服务未接入</button>
      </RailSection>

      <div className={`practice-status-row practice-status-mistake${numericRetry || state.hadIncorrectAttempt ? " is-warning" : ""}`} data-od-id="practice-mistake-status">
        <strong>错题状态</strong><span>{numericRetry || state.hadIncorrectAttempt ? "待服务确认" : numericCorrect ? "本题不是错题" : "提交后判定"}</span>
      </div>
      <div className="practice-status-row practice-status-evidence" data-od-id="practice-evidence-status">
        <strong>学习证据</strong><span>{numericCorrect ? "待提交" : numericRetry ? "重试完成后可提交" : "完成练习后可提交"}</span>
      </div>
      <div className="practice-status-row practice-status-mastery is-warning" data-od-id="practice-mastery-status">
        <strong>掌握度</strong><span>待有效证据确认</span>
      </div>
      <p className="practice-review-boundary" aria-live="polite">
        {markedForReview ? "已在当前页面会话中标记；尚未持久化。" : "稍后检查标记仅保留在当前页面会话。"}
      </p>
      <div className="family-privacy-notice practice-privacy"><Icon name="shieldCheck" size={20} /><p>答案、草稿与辅导记录仅允许在授权家庭边界内使用。</p></div>
    </aside>
  );
}

interface GraphPracticeRightRailProps {
  readonly document: PracticeDocument;
  readonly currentQuestionNumber: number;
  readonly questionOnePhase: PracticeSubmitPhase;
  readonly numericState: NumericPracticeSessionState;
  readonly question: GraphPracticeQuestion;
  readonly state: GraphPracticeSessionState;
  readonly markedForReview: boolean;
  readonly ocrState: DraftOcrState;
  readonly draftFileName: string | null;
  readonly onUseHintOne: () => void;
  readonly onToggleHintTwo: () => void;
  readonly onUploadDraft: (fileName: string) => void;
  readonly onConfirmDraft: () => void;
}

function GraphPracticeRightRail({
  document,
  currentQuestionNumber,
  questionOnePhase,
  numericState,
  question,
  state,
  markedForReview,
  ocrState,
  draftFileName,
  onUseHintOne,
  onToggleHintTwo,
  onUploadDraft,
  onConfirmDraft,
}: GraphPracticeRightRailProps) {
  const questionStates = Array.from({ length: document.totalQuestions }, (_, index) => index + 1);
  const questionOneRecovered = questionOnePhase === "RECOVERED_CORRECT";
  const questionOneCorrect = questionOnePhase === "CORRECT";
  const numericCorrect = numericState.submitPhase === "CORRECT";
  const graphRetry = state.submitPhase === "INCORRECT_RETRYABLE";
  const graphCorrect = state.submitPhase === "CORRECT";
  const hintTwoUnlocked = state.hintOneUsed && state.hadIncorrectAttempt;
  const selectedOption = question.options.find((option) => option.id === state.selectedOptionId);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file !== undefined) onUploadDraft(file.name);
    event.target.value = "";
  }

  function questionStatus(number: number): string {
    if (number === currentQuestionNumber) {
      if (number === 3 && graphRetry) return "当前，需要重试";
      if (number === 3 && graphCorrect) return "当前，已作答";
      return "当前";
    }
    if (number === 1 && questionOneRecovered) return "已修正";
    if (number === 1 && questionOneCorrect) return "已作答";
    if (number === 2 && numericCorrect) return "已作答";
    if (number === 3 && currentQuestionNumber > 3 && graphCorrect) return "已作答";
    return "待作答";
  }

  function questionClass(number: number): string {
    if (number === currentQuestionNumber) {
      if (number === 3 && graphRetry) return "is-current is-needs-retry";
      if (number === 3 && graphCorrect) return "is-current is-correct";
      return "is-current";
    }
    if (number === 1 && questionOneRecovered) return "is-recovered";
    if ((number === 1 && questionOneCorrect) || (number === 2 && numericCorrect)) return "is-correct";
    if (number === 3 && currentQuestionNumber > 3 && graphCorrect) return "is-correct";
    return "";
  }

  const conceptRows = selectedOption === undefined
    ? []
    : [
        ["开口方向", selectedOption.feedback.openingDirection],
        ["对称轴", selectedOption.feedback.symmetryAxis],
        ["顶点", selectedOption.feedback.vertexPosition],
      ] as const;

  return (
    <aside className="practice-right-rail is-graph" data-od-id="practice-right-rail" aria-label="随堂练习辅助信息">
      <RailSection className="practice-rail-progress" title="练习进度">
        <span>{currentQuestionNumber} / {document.totalQuestions}</span>
        <ol aria-label="题目状态">
          {questionStates.map((number) => (
            <li
              aria-current={number === currentQuestionNumber ? "step" : undefined}
              aria-label={`第 ${String(number)} 题，${questionStatus(number)}`}
              className={questionClass(number)}
              key={number}
            ><span>{number}</span></li>
          ))}
        </ol>
      </RailSection>

      <RailSection className="practice-answer-guidance" title={graphCorrect || graphRetry ? "答题反馈" : "观察顺序"}>
        {graphCorrect || graphRetry ? (
          <dl className={`practice-concept-diagnostics${graphCorrect ? " is-recovered" : ""}`}>
            {conceptRows.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{graphCorrect ? "判断正确" : value === "NEEDS_RETHINK" ? "需要重新判断" : "判断可保留"}</dd></div>
            ))}
          </dl>
        ) : (
          <ol className="practice-observation-order">
            <li>先判断开口方向</li>
            <li>再比较对称轴位置</li>
            <li>最后检查顶点坐标</li>
          </ol>
        )}
      </RailSection>

      <RailSection className="practice-graph-description" title="图像说明">
        <p>虚线表示对称轴；实心点和坐标文字表示顶点。四幅图使用相同坐标范围与比例。</p>
      </RailSection>

      <RailSection className="practice-draft" title="我的草稿">
        <OcrStatusCopy fileName={draftFileName} state={ocrState} />
        {ocrState === "NEEDS_CONFIRMATION" ? (
          <button className="secondary-button" data-od-id="practice-confirm-draft" onClick={onConfirmDraft} type="button">确认本地文件</button>
        ) : (
          <label className="secondary-button practice-upload-button">
            <Icon name="upload" size={18} />
            <span>{ocrState === "EMPTY" || ocrState === "CONFIRMED" ? "上传草稿" : "处理中…"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="上传本题草稿图片"
              autoComplete="off"
              disabled={ocrState === "UPLOADING" || ocrState === "PROCESSING"}
              name="practiceGraphDraft"
              onChange={handleFileChange}
              type="file"
            />
          </label>
        )}
      </RailSection>

      <RailSection className="practice-hints" title="分层提示">
        <div className="practice-hint-item">
          <div><strong>提示 1</strong><small>{state.hintOneUsed ? "已使用" : "未使用"}</small></div>
          <button aria-expanded={state.hintOneOpen} className="text-button" onClick={onUseHintOne} type="button">
            {state.hintOneOpen ? "收起提示 1" : state.hintOneUsed ? "再次查看提示 1" : "查看提示 1"}
          </button>
        </div>
        {state.hintOneOpen ? <p className="practice-hint-copy">{question.hintOne}</p> : null}
        <div className="practice-hint-item">
          <div><strong>提示 2</strong><small>{hintTwoUnlocked ? "已解锁" : "未解锁"}</small></div>
          <button
            aria-describedby="practice-graph-hint-two-rule"
            aria-expanded={state.hintTwoOpen}
            className="text-button"
            disabled={!hintTwoUnlocked}
            onClick={onToggleHintTwo}
            type="button"
          >{hintTwoUnlocked ? state.hintTwoOpen ? "收起提示 2" : "查看提示 2" : "尚未解锁"}</button>
        </div>
        <p className="service-boundary-copy" id="practice-graph-hint-two-rule">
          {hintTwoUnlocked ? "提示 1 已使用且已有一次错误提交；提示 2 仍不直接给出选项字母。" : "使用提示 1 并完成一次错误提交后解锁。"}
        </p>
        {state.hintTwoOpen ? <p className="practice-hint-copy">{question.hintTwo}</p> : null}
      </RailSection>

      <RailSection className="practice-ai" title="AI 辅导">
        <p>不确定如何从解析式判断图像？先说出观察顺序，辅导会按提示逐步检查。</p>
        <p>当前 Web 尚未接入生产辅导；缺少审核证据时为 NEEDS_EVIDENCE。</p>
        <button className="secondary-button" disabled type="button">服务未接入</button>
      </RailSection>

      <div className={`practice-status-row practice-status-mistake${graphRetry ? " is-warning" : ""}`} data-od-id="practice-mistake-status">
        <strong>错题状态</strong><span>{graphRetry ? "需要重试" : graphCorrect ? "本题不是错题" : "提交后判定"}</span>
      </div>
      <div className="practice-status-row practice-status-evidence" data-od-id="practice-evidence-status">
        <strong>学习证据</strong><span>{graphCorrect ? "待提交" : graphRetry ? "重试完成后可提交" : "完成练习后可提交"}</span>
      </div>
      <div className="practice-status-row practice-status-mastery is-warning" data-od-id="practice-mastery-status">
        <strong>掌握度</strong><span>待有效证据确认</span>
      </div>
      <p className="practice-review-boundary" aria-live="polite">
        {markedForReview ? "已在当前页面会话中标记；尚未持久化。" : "稍后检查标记仅保留在当前页面会话。"}
      </p>
      <div className="family-privacy-notice practice-privacy"><Icon name="shieldCheck" size={20} /><p>答案、草稿与辅导记录仅允许在授权家庭边界内使用。</p></div>
    </aside>
  );
}

interface CoordinatePlotRightRailProps {
  readonly document: PracticeDocument;
  readonly questionOnePhase: PracticeSubmitPhase;
  readonly numericState: NumericPracticeSessionState;
  readonly graphState: GraphPracticeSessionState;
  readonly question: CoordinatePlotPracticeQuestion;
  readonly state: CoordinatePlotSessionState;
  readonly ocrState: DraftOcrState;
  readonly draftFileName: string | null;
  readonly onUseHintOne: () => void;
  readonly onToggleHintTwo: () => void;
  readonly onUploadDraft: (fileName: string) => void;
  readonly onConfirmDraft: () => void;
}

function CoordinatePlotRightRail({
  document,
  questionOnePhase,
  numericState,
  graphState,
  question,
  state,
  ocrState,
  draftFileName,
  onUseHintOne,
  onToggleHintTwo,
  onUploadDraft,
  onConfirmDraft,
}: CoordinatePlotRightRailProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file !== undefined) onUploadDraft(file.name);
    event.target.value = "";
  }
  const questionOneStatus = questionOnePhase === "RECOVERED_CORRECT" ? "已修正" : "已完成";
  const curveStatus = state.curveConnected ? "已连接" : state.points.length === question.requiredPointCount ? "可连接" : "未解锁";
  const submitStatus = state.curveConnected ? state.phase === "SERVICE_UNAVAILABLE" ? "服务未接入" : "可用" : "不可用";

  return (
    <aside className="practice-right-rail is-coordinate" data-od-id="practice-right-rail" aria-label="随堂练习辅助信息">
      <details className="practice-coordinate-rail-details" open>
        <summary>练习辅助信息</summary>
        <div className="practice-coordinate-rail-content">
          <RailSection className="practice-rail-progress" title="练习进度">
            <span>4 / {document.totalQuestions}</span>
            <ol aria-label="题目状态">
              {[1, 2, 3, 4, 5].map((number) => (
                <li aria-current={number === 4 ? "step" : undefined} className={number === 1 ? "is-recovered" : number === 2 || number === 3 ? "is-correct" : number === 4 ? "is-current" : ""} key={number}>
                  <span>{number}</span><small>{number === 1 ? questionOneStatus : number === 2 || number === 3 ? "已完成" : number === 4 ? "当前" : "待作答"}</small>
                </li>
              ))}
            </ol>
          </RailSection>

          <RailSection className="practice-coordinate-status" title="作图状态">
            <dl>
              <div><dt>已描点</dt><dd>{state.points.length} / {question.requiredPointCount}</dd></div>
              <div><dt>连接曲线</dt><dd>{curveStatus}</dd></div>
              <div><dt>提交作图</dt><dd>{submitStatus}</dd></div>
            </dl>
            <p className="service-boundary-copy">至少完成 {question.requiredPointCount} 个点位后才能连接曲线。</p>
          </RailSection>

          <RailSection className="practice-coordinate-tool-guide" title="作图工具说明">
            <dl>
              <div><dt>添加点</dt><dd>单击网格</dd></div>
              <div><dt>移动点</dt><dd>拖动已有点</dd></div>
              <div><dt>删除点</dt><dd>选中后删除</dd></div>
              <div><dt>撤销 / 清空</dt><dd>有操作后可用</dd></div>
            </dl>
          </RailSection>

          <RailSection className="practice-draft" title="我的草稿">
            <OcrStatusCopy fileName={draftFileName} state={ocrState} />
            {ocrState === "NEEDS_CONFIRMATION" ? (
              <button className="secondary-button" onClick={onConfirmDraft} type="button">确认本地文件</button>
            ) : (
              <label className="secondary-button practice-upload-button">
                <Icon name="upload" size={18} /><span>{ocrState === "EMPTY" || ocrState === "CONFIRMED" ? "上传草稿" : "处理中…"}</span>
                <input accept="image/jpeg,image/png,image/webp" aria-label="上传本题草稿图片" disabled={ocrState === "UPLOADING" || ocrState === "PROCESSING"} name="practiceCoordinateDraft" onChange={handleFileChange} type="file" />
              </label>
            )}
          </RailSection>

          <RailSection className="practice-hints" title="分层提示">
            <div className="practice-hint-item"><div><strong>提示 1</strong><small>{state.hintOneUsed ? "已使用" : "未使用"}</small></div><button aria-expanded={state.hintOneOpen} className="text-button" onClick={onUseHintOne} type="button">{state.hintOneOpen ? "收起提示 1" : "查看提示 1"}</button></div>
            {state.hintOneOpen ? <p className="practice-hint-copy">{question.hintOne}</p> : null}
            <div className="practice-hint-item"><div><strong>提示 2</strong><small>{state.hintOneUsed ? "已解锁" : "未解锁"}</small></div><button aria-expanded={state.hintTwoOpen} className="text-button" disabled={!state.hintOneUsed} onClick={onToggleHintTwo} type="button">{state.hintOneUsed ? state.hintTwoOpen ? "收起提示 2" : "查看提示 2" : "尚未解锁"}</button></div>
            {state.hintTwoOpen ? <p className="practice-hint-copy">{question.hintTwo}</p> : null}
          </RailSection>

          <RailSection className="practice-ai" title="AI 辅导">
            <p>描点顺序或对称点检查不确定？</p>
            <p>辅导只检查你的步骤，不会代替描点或连接曲线。</p>
            <button className="secondary-button" disabled type="button">服务未接入</button>
          </RailSection>

          <RailSection className="practice-coordinate-evidence" title="错题与证据">
            <dl>
              <div><dt>本题状态</dt><dd>待提交</dd></div>
              <div><dt>作图过程</dt><dd>{state.curveConnected ? "本地已连接" : "尚未完成"}</dd></div>
              <div><dt>学习证据</dt><dd>完成练习后可提交</dd></div>
              <div><dt>掌握度</dt><dd>待有效证据确认</dd></div>
            </dl>
            <p className="service-boundary-copy">本地点位不会被伪装为服务端证据。</p>
          </RailSection>

          <div className="family-privacy-notice practice-privacy"><Icon name="shieldCheck" size={20} /><p>点位、草稿与辅导记录仅在授权家庭范围内使用。</p></div>
          <p className="practice-review-boundary" aria-live="polite">{state.markedForReview ? "已在当前页面会话中标记；尚未持久化。" : "稍后检查标记仅保留在当前页面会话。"}</p>
          <p className="sr-only">第 2 题状态 {numericState.submitPhase}；第 3 题状态 {graphState.submitPhase}。</p>
        </div>
      </details>
    </aside>
  );
}

interface StructuredApplicationRightRailProps {
  readonly document: PracticeDocument;
  readonly question: StructuredApplicationPracticeQuestion;
  readonly state: StructuredApplicationSessionState;
  readonly completion: StructuredApplicationCompletion;
  readonly onUseHintOne: () => void;
  readonly onToggleHintTwo: () => void;
  readonly onUploadDraft: (fileName: string) => void;
  readonly onConfirmDraft: () => void;
}

function StructuredApplicationRightRail({
  document,
  question,
  state,
  completion,
  onUseHintOne,
  onToggleHintTwo,
  onUploadDraft,
  onConfirmDraft,
}: StructuredApplicationRightRailProps) {
  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file !== undefined) onUploadDraft(file.name);
    event.target.value = "";
  }

  const checklist = [
    { label: "最高点坐标", complete: completion.vertexComplete },
    { label: "地面交点", complete: completion.interceptsComplete },
    { label: "拱门宽度", complete: completion.widthComplete },
    { label: "判断依据", complete: completion.explanationComplete },
  ] as const;

  return (
    <aside className="practice-right-rail is-structured" data-od-id="practice-right-rail" aria-label="随堂练习辅助信息">
      <details className="practice-structured-rail-details" open>
        <summary>练习辅助信息</summary>
        <div className="practice-structured-rail-content">
          <RailSection className="practice-rail-progress" title="练习进度">
            <span>5 / {document.totalQuestions}</span>
            <ol aria-label="题目状态">
              {[1, 2, 3, 4, 5].map((number) => (
                <li aria-current={number === 5 ? "step" : undefined} className={number === 1 ? "is-recovered" : number < 5 ? "is-correct" : "is-current"} key={number}>
                  <span>{number}</span><small>{number === 1 ? "已修正" : number < 5 ? "已完成" : "当前"}</small>
                </li>
              ))}
            </ol>
          </RailSection>

          <RailSection className="structured-checklist-rail" title="作答清单">
            <ul className="structured-rail-list">
              {checklist.map((item) => (
                <li className={item.complete ? "is-complete" : ""} key={item.label}>
                  <strong>{item.label}</strong><small>{item.complete ? "已完成" : "未完成"}</small>
                </li>
              ))}
            </ul>
            <p className="service-boundary-copy">完成全部必填项后才能提交。</p>
          </RailSection>

          <RailSection className="structured-rules" title="填写规则">
            <dl>
              <div><dt>坐标</dt><dd>分别填写 x 与 y</dd></div>
              <div><dt>交点</dt><dd>按从小到大</dd></div>
              <div><dt>宽度</dt><dd>填写非负数</dd></div>
              <div><dt>依据</dt><dd>不超过 {question.explanationMaxLength} 字</dd></div>
            </dl>
          </RailSection>

          <RailSection className="practice-draft" title="我的草稿">
            <OcrStatusCopy fileName={state.draftFileName} state={state.draftOcrState} />
            {state.draftOcrState === "NEEDS_CONFIRMATION" ? (
              <button className="secondary-button" onClick={onConfirmDraft} type="button">确认本地文件</button>
            ) : (
              <label className="secondary-button practice-upload-button">
                <Icon name="upload" size={18} /><span>{state.draftOcrState === "EMPTY" || state.draftOcrState === "CONFIRMED" ? "上传草稿" : "处理中…"}</span>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="上传本题草稿图片"
                  disabled={state.draftOcrState === "UPLOADING" || state.draftOcrState === "PROCESSING"}
                  name="practiceStructuredDraft"
                  onChange={handleFileChange}
                  type="file"
                />
              </label>
            )}
          </RailSection>

          <RailSection className="practice-hints" title="分层提示">
            <div className="practice-hint-item">
              <div><strong>提示 1</strong><small>{state.hintOneUsed ? "已使用" : "未使用"}</small></div>
              <button aria-expanded={state.hintOneOpen} className="text-button" onClick={onUseHintOne} type="button">{state.hintOneOpen ? "收起提示 1" : "查看提示 1"}</button>
            </div>
            {state.hintOneOpen ? <p className="practice-hint-copy">{question.hintOne}</p> : null}
            <div className="practice-hint-item">
              <div><strong>提示 2</strong><small>{state.hintOneUsed ? "已解锁" : "未解锁"}</small></div>
              <button aria-expanded={state.hintTwoOpen} className="text-button" disabled={!state.hintOneUsed} onClick={onToggleHintTwo} type="button">{state.hintOneUsed ? state.hintTwoOpen ? "收起提示 2" : "查看提示 2" : "尚未解锁"}</button>
            </div>
            {state.hintTwoOpen ? <p className="practice-hint-copy">{question.hintTwo}</p> : null}
          </RailSection>

          <RailSection className="practice-ai" title="AI 辅导">
            <p>实际情境与函数特征不确定？</p>
            <p>先写出你的判断；辅导只检查步骤，不会直接填写答案。</p>
            <button className="secondary-button" disabled type="button">服务未接入</button>
          </RailSection>

          <RailSection className="structured-rail-status" title="错题与证据">
            <dl>
              <div><dt>本题状态</dt><dd>待提交</dd></div>
              <div><dt>结构化作答</dt><dd>{completion.allComplete ? "本地已完成" : "尚未完成"}</dd></div>
              <div><dt>学习证据</dt><dd>完成练习后可提交</dd></div>
              <div><dt>掌握度</dt><dd>待有效证据确认</dd></div>
            </dl>
            <p className="service-boundary-copy">本地字段完成不会被伪装为服务端学习证据。</p>
          </RailSection>

          <div className="family-privacy-notice practice-privacy"><Icon name="shieldCheck" size={20} /><p>答案、草稿与辅导记录仅在授权家庭范围内使用。</p></div>
          <p className="practice-review-boundary" aria-live="polite">{state.markedForReview ? "已在当前页面会话中标记；尚未持久化。" : "稍后检查标记仅保留在当前页面会话。"}</p>
        </div>
      </details>
    </aside>
  );
}

export interface PracticeRightRailProps {
  readonly document: PracticeDocument;
  readonly currentQuestionNumber: number;
  readonly markedForReview: boolean;
  readonly hintOneUsed: boolean;
  readonly hintOneOpen: boolean;
  readonly hintTwoUnlocked: boolean;
  readonly hintTwoOpen: boolean;
  readonly submitPhase: PracticeSubmitPhase;
  readonly ocrState: DraftOcrState;
  readonly draftFileName: string | null;
  readonly numericQuestion: NumericPracticeQuestion;
  readonly numericState: NumericPracticeSessionState;
  readonly graphQuestion: GraphPracticeQuestion;
  readonly graphState: GraphPracticeSessionState;
  readonly coordinatePlotQuestion: CoordinatePlotPracticeQuestion;
  readonly coordinatePlotState: CoordinatePlotSessionState;
  readonly structuredApplicationQuestion: StructuredApplicationPracticeQuestion;
  readonly structuredApplicationState: StructuredApplicationSessionState;
  readonly structuredApplicationCompletion: StructuredApplicationCompletion;
  readonly onUseNumericHintOne: () => void;
  readonly onToggleNumericHintTwo: () => void;
  readonly onUseGraphHintOne: () => void;
  readonly onToggleGraphHintTwo: () => void;
  readonly onUseCoordinateHintOne: () => void;
  readonly onToggleCoordinateHintTwo: () => void;
  readonly onUseStructuredHintOne: () => void;
  readonly onToggleStructuredHintTwo: () => void;
  readonly onUseHintOne: () => void;
  readonly onToggleHintTwo: () => void;
  readonly onUploadDraft: (fileName: string) => void;
  readonly onConfirmDraft: () => void;
}

export function PracticeRightRail({
  document,
  currentQuestionNumber,
  markedForReview,
  hintOneUsed,
  hintOneOpen,
  hintTwoUnlocked,
  hintTwoOpen,
  submitPhase,
  ocrState,
  draftFileName,
  numericQuestion,
  numericState,
  graphQuestion,
  graphState,
  coordinatePlotQuestion,
  coordinatePlotState,
  structuredApplicationQuestion,
  structuredApplicationState,
  structuredApplicationCompletion,
  onUseNumericHintOne,
  onToggleNumericHintTwo,
  onUseGraphHintOne,
  onToggleGraphHintTwo,
  onUseCoordinateHintOne,
  onToggleCoordinateHintTwo,
  onUseStructuredHintOne,
  onToggleStructuredHintTwo,
  onUseHintOne,
  onToggleHintTwo,
  onUploadDraft,
  onConfirmDraft,
}: PracticeRightRailProps) {
  if (currentQuestionNumber === 5) {
    return (
      <StructuredApplicationRightRail
        completion={structuredApplicationCompletion}
        document={document}
        onConfirmDraft={onConfirmDraft}
        onToggleHintTwo={onToggleStructuredHintTwo}
        onUploadDraft={onUploadDraft}
        onUseHintOne={onUseStructuredHintOne}
        question={structuredApplicationQuestion}
        state={structuredApplicationState}
      />
    );
  }
  if (currentQuestionNumber === 4) {
    return (
      <CoordinatePlotRightRail
        document={document}
        draftFileName={draftFileName}
        graphState={graphState}
        numericState={numericState}
        ocrState={ocrState}
        onConfirmDraft={onConfirmDraft}
        onToggleHintTwo={onToggleCoordinateHintTwo}
        onUploadDraft={onUploadDraft}
        onUseHintOne={onUseCoordinateHintOne}
        question={coordinatePlotQuestion}
        questionOnePhase={submitPhase}
        state={coordinatePlotState}
      />
    );
  }
  if (currentQuestionNumber >= 3) {
    return (
      <GraphPracticeRightRail
        currentQuestionNumber={currentQuestionNumber}
        document={document}
        draftFileName={draftFileName}
        markedForReview={markedForReview}
        numericState={numericState}
        ocrState={ocrState}
        onConfirmDraft={onConfirmDraft}
        onToggleHintTwo={onToggleGraphHintTwo}
        onUploadDraft={onUploadDraft}
        onUseHintOne={onUseGraphHintOne}
        question={graphQuestion}
        questionOnePhase={submitPhase}
        state={graphState}
      />
    );
  }
  if (currentQuestionNumber === 2) {
    return (
      <NumericPracticeRightRail
        currentQuestionNumber={currentQuestionNumber}
        document={document}
        draftFileName={draftFileName}
        markedForReview={markedForReview}
        ocrState={ocrState}
        onConfirmDraft={onConfirmDraft}
        onToggleHintTwo={onToggleNumericHintTwo}
        onUploadDraft={onUploadDraft}
        onUseHintOne={onUseNumericHintOne}
        question={numericQuestion}
        questionOnePhase={submitPhase}
        state={numericState}
      />
    );
  }
  const questionStates = Array.from({ length: document.totalQuestions }, (_, index) => index + 1);
  const retryFeedback = [
    "INCORRECT_RETRYABLE",
    "RETRY_EDITING",
    "RETRY_CHECKING",
    "RETRY_UNAVAILABLE",
  ].includes(submitPhase);
  const recovered = submitPhase === "RECOVERED_CORRECT";
  const submitted = submitPhase === "CORRECT" || recovered;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file !== undefined) onUploadDraft(file.name);
    event.target.value = "";
  }

  return (
    <aside className="practice-right-rail" data-od-id="practice-right-rail" aria-label="随堂练习辅助信息">
      <RailSection className="practice-rail-progress" title="练习进度">
        <span>{currentQuestionNumber} / {document.totalQuestions}</span>
        <ol aria-label="题目状态">
          {questionStates.map((number) => (
            <li
              aria-current={number === currentQuestionNumber ? "step" : undefined}
              aria-label={`第 ${String(number)} 题，${number === currentQuestionNumber ? recovered ? "已修正" : retryFeedback ? "当前，需要重试" : "当前" : number === 1 && currentQuestionNumber > 1 ? "已作答" : "待作答"}`}
              className={number === currentQuestionNumber ? recovered ? "is-current is-recovered" : retryFeedback ? "is-current is-needs-retry" : "is-current" : ""}
              key={number}
            >
              <span>{number}</span>
            </li>
          ))}
        </ol>
      </RailSection>

      <RailSection className="practice-answer-guidance" title={retryFeedback || recovered ? "答题反馈" : "答题说明"}>
        {recovered ? (
          <dl className="practice-concept-diagnostics is-recovered">
            <div><dt>开口方向</dt><dd>已修正</dd></div>
            <div><dt>对称轴</dt><dd>判断正确</dd></div>
            <div><dt>顶点</dt><dd>判断正确</dd></div>
          </dl>
        ) : retryFeedback ? (
          <dl className="practice-concept-diagnostics">
            <div><dt>开口方向</dt><dd>需要重新判断</dd></div>
            <div><dt>对称轴</dt><dd>判断可保留</dd></div>
            <div><dt>顶点</dt><dd>判断可保留</dd></div>
          </dl>
        ) : (
          <ul>
            <li>独立完成后再查看提示</li>
            <li>提交后才检查答案</li>
            <li>错题只在提交后判定</li>
          </ul>
        )}
      </RailSection>

      {recovered ? (
        <RailSection className="practice-recovery-process" title="恢复过程 · 本次会话">
          <ol>
            <li><Icon name="check" size={14} /><span>第一次作答</span><strong>A</strong></li>
            <li><Icon name="check" size={14} /><span>提示使用</span><strong>提示 1</strong></li>
            <li><Icon name="check" size={14} /><span>第二次作答</span><strong>B</strong></li>
            <li><Icon name="check" size={14} /><span>本次恢复</span><strong>已完成</strong></li>
          </ol>
        </RailSection>
      ) : null}

      <RailSection className="practice-draft" title="我的草稿">
        <OcrStatusCopy fileName={draftFileName} state={ocrState} />
        {ocrState === "NEEDS_CONFIRMATION" ? (
          <button className="secondary-button" data-od-id="practice-confirm-draft" onClick={onConfirmDraft} type="button">
            确认本地文件
          </button>
        ) : (
          <label className="secondary-button practice-upload-button">
            <Icon name="upload" size={18} />
            <span>{ocrState === "EMPTY" || ocrState === "CONFIRMED" ? "上传草稿" : "处理中…"}</span>
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="上传本题草稿图片"
              autoComplete="off"
              disabled={ocrState === "UPLOADING" || ocrState === "PROCESSING"}
              name="practiceDraft"
              onChange={handleFileChange}
              type="file"
            />
          </label>
        )}
      </RailSection>

      <RailSection className="practice-hints" title="分层提示">
        <div className="practice-hint-item">
          <div><strong>提示 1</strong><small>{hintOneUsed ? "已使用" : "未使用"}</small></div>
          <button aria-expanded={hintOneOpen} className="text-button" onClick={onUseHintOne} type="button">
            {hintOneOpen ? "收起提示 1" : "查看提示 1"}
          </button>
        </div>
        {hintOneOpen ? <p className="practice-hint-copy">{document.hintOne}</p> : null}
        <div className="practice-hint-item">
          <div><strong>提示 2</strong><small>{recovered ? "未使用" : hintTwoUnlocked ? "已解锁" : "未解锁"}</small></div>
          <button
            aria-describedby="practice-hint-two-rule"
            aria-expanded={hintTwoOpen}
            className="text-button"
            disabled={!hintTwoUnlocked}
            onClick={onToggleHintTwo}
            type="button"
          >
            {recovered ? "未使用" : hintTwoUnlocked ? (hintTwoOpen ? "收起提示 2" : "查看提示 2") : "尚未解锁"}
          </button>
        </div>
        <p className="service-boundary-copy" id="practice-hint-two-rule">
          {recovered ? "本次恢复只使用提示 1；提示 2 未使用。" : retryFeedback ? "首次错误只使用提示 1；提示 2 继续锁定，等待有效恢复流程。" : "使用提示 1 并完成一次错误提交后解锁。"}
        </p>
        {hintTwoOpen ? <p className="practice-hint-copy">{document.hintTwo}</p> : null}
      </RailSection>

      <RailSection className="practice-ai" title="AI 辅导">
        <p>提示优先；当前 Web 尚未接入。缺少审核证据时服务端将返回 NEEDS_EVIDENCE。</p>
        <button className="secondary-button" disabled type="button">进入辅导</button>
      </RailSection>

      <div className={`practice-status-row practice-status-mistake${retryFeedback ? " is-warning" : ""}`} data-od-id="practice-mistake-status">
        <strong>错题状态</strong>
        <span>{recovered ? "待服务确认" : retryFeedback ? "需要重试" : submitPhase === "CORRECT" ? "本题不是错题" : "提交后判定"}</span>
      </div>
      {retryFeedback || recovered ? (
        <div className="practice-status-row practice-status-recovery is-warning" data-od-id="practice-recovery-status">
          <strong>恢复尝试</strong><span>{recovered ? "本地已完成" : "待完成"}</span>
        </div>
      ) : null}
      <div className="practice-status-row practice-status-evidence" data-od-id="practice-evidence-status">
        <strong>学习证据</strong>
        <span>{recovered ? "待提交" : retryFeedback ? "重试完成后可保存" : submitted ? "等待服务端接受有效证据" : "完成练习后可保存"}</span>
      </div>
      {retryFeedback || recovered ? (
        <div className="practice-status-row practice-status-mastery is-warning" data-od-id="practice-mastery-status">
          <strong>掌握度</strong><span>{recovered ? "待有效证据确认" : "未更新"}</span>
        </div>
      ) : null}
      <p className="practice-review-boundary" aria-live="polite">
        {markedForReview ? "已在当前页面会话中标记；尚未持久化。" : "稍后检查标记仅保留在当前页面会话。"}
      </p>
      <div className="family-privacy-notice practice-privacy">
        <Icon name="shieldCheck" size={20} />
        <p>答案、草稿与辅导记录仅允许在授权家庭边界内使用。</p>
      </div>
    </aside>
  );
}
