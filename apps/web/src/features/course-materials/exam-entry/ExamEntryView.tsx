import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ExamEntryDocument,
  ExamEntryStatus,
  ExamEntryStep,
  ExamLossItemDraft,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly ExamEntryStatus[] = [
  "DEFAULT_EMPTY",
  "DRAFT_PARTIAL",
  "VALIDATION_ERROR",
  "READY_TO_SAVE",
  "DRAFT_SAVING",
  "DRAFT_SAVED_LOCAL",
  "DRAFT_SAVED_SERVER",
  "SUBMITTING",
  "RESULT_UNKNOWN",
  "DUPLICATE_REQUEST",
  "OFFLINE_DRAFT",
];

function isDisplayableExamEntry(document: ExamEntryDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function buildExamListUrl(course: CourseSummary, document: ExamEntryDocument): string {
  const params = new URLSearchParams({
    grade: String(course.grade),
    subject: course.subjectCode,
    target: document.listTargetId,
    term: course.term,
    view: "exam-list",
  });
  return `/student/learn?${params.toString()}`;
}

function parseDecimal(value: string): number | null {
  const normalized = value.trim().replace("，", ".");
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDecimal(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

function sumLossItems(items: readonly ExamLossItemDraft[]): number {
  return items.reduce((sum, item) => sum + (parseDecimal(item.lossScore) ?? 0), 0);
}

function canUseScore(earnedScore: string, maximumScore: string): boolean {
  const earned = parseDecimal(earnedScore);
  const maximum = parseDecimal(maximumScore);
  return earned !== null && maximum !== null && maximum > 0 && earned >= 0 && earned <= maximum;
}

function scoreLoss(earnedScore: string, maximumScore: string): number | null {
  const earned = parseDecimal(earnedScore);
  const maximum = parseDecimal(maximumScore);
  if (earned === null || maximum === null) {
    return null;
  }
  return maximum - earned;
}

function isLossItemComplete(item: ExamLossItemDraft): boolean {
  return item.questionNumber.trim().length > 0 &&
    parseDecimal(item.lossScore) !== null &&
    item.scopeLabel.trim().length > 0 &&
    item.reasonLabel.trim().length > 0 &&
    item.confirmed;
}

function entryStepClass(step: ExamEntryStep): string {
  return step.state === "COMPLETE"
    ? "is-complete"
    : step.state === "CURRENT"
    ? "is-current"
    : step.state === "ERROR"
    ? "is-error"
    : "is-pending";
}

function stepStateForRuntime(
  baseStep: ExamEntryStep,
  status: ExamEntryStatus,
  scoreConsistent: boolean,
): ExamEntryStep {
  if (status === "RESULT_UNKNOWN" && baseStep.id === "save") {
    return { ...baseStep, caption: "结果未知", state: "ERROR" };
  }
  if (!scoreConsistent && baseStep.id === "loss-items") {
    return { ...baseStep, caption: "差额待校验", state: "ERROR" };
  }
  if (scoreConsistent && baseStep.id === "save") {
    return { ...baseStep, state: "CURRENT" };
  }
  return baseStep;
}

function ExamEntryDefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["exam-entry-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ExamEntrySectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="exam-entry-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function ExamEntryMobileMenu({ examListUrl }: { readonly examListUrl: string }) {
  return (
    <details className="exam-entry-mobile-menu">
      <summary aria-label="打开移动端考试录入导航">
        <span>
          <strong>清朗学习</strong>
          <small>考试录入</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端考试录入功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <Link to={examListUrl}>考试记录</Link>
        <span aria-current="page">新建考试</span>
      </nav>
    </details>
  );
}

function ExamEntryHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: ExamEntryDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.draftStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header exam-entry-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb exam-entry-breadcrumb">
          {document.breadcrumbLabel.split(" / ").map((part, index) => (
            <span key={`${part}-${String(index)}`}>
              {index === 0 ? null : <Icon name="chevronRight" size={15} />}
              <span>{part}</span>
            </span>
          ))}
        </nav>
        <div className="exam-entry-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date exam-entry-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.draftStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ExamEntryProgress({
  scoreConsistent,
  status,
  steps,
}: {
  readonly scoreConsistent: boolean;
  readonly status: ExamEntryStatus;
  readonly steps: readonly ExamEntryStep[];
}) {
  return (
    <ol className="exam-entry-progress" aria-label="考试录入三步进度">
      {steps.map((step) => {
        const runtimeStep = stepStateForRuntime(step, status, scoreConsistent);
        return (
          <li
            aria-current={runtimeStep.state === "CURRENT" ? "step" : undefined}
            className={entryStepClass(runtimeStep)}
            key={runtimeStep.id}
          >
            <span aria-hidden="true">{runtimeStep.id === "facts" ? "1" : runtimeStep.id === "loss-items" ? "2" : "3"}</span>
            <strong>{runtimeStep.label}</strong>
            <small>{runtimeStep.caption}</small>
          </li>
        );
      })}
    </ol>
  );
}

function ExamFactsSection({
  document,
  earnedScore,
  examDate,
  examName,
  examScope,
  examType,
  maximumScore,
  onEarnedScoreChange,
  onExamDateChange,
  onExamNameChange,
  onExamScopeChange,
  onExamTypeChange,
  onMaximumScoreChange,
  onSubjectChange,
  subjectLabel,
}: {
  readonly document: ExamEntryDocument;
  readonly earnedScore: string;
  readonly examDate: string;
  readonly examName: string;
  readonly examScope: string;
  readonly examType: string;
  readonly maximumScore: string;
  readonly onEarnedScoreChange: (value: string) => void;
  readonly onExamDateChange: (value: string) => void;
  readonly onExamNameChange: (value: string) => void;
  readonly onExamScopeChange: (value: string) => void;
  readonly onExamTypeChange: (value: string) => void;
  readonly onMaximumScoreChange: (value: string) => void;
  readonly onSubjectChange: (value: string) => void;
  readonly subjectLabel: string;
}) {
  const totalLoss = scoreLoss(earnedScore, maximumScore);
  return (
    <section className="exam-entry-facts" aria-labelledby="exam-entry-facts-title">
      <div className="exam-entry-large-number" aria-label={document.largeNumberCaption}>
        <strong>{document.largeNumber}</strong>
        <span>{document.largeNumberCaption}</span>
      </div>
      <fieldset className="exam-entry-facts-fieldset">
        <legend id="exam-entry-facts-title">{document.factsTitle}</legend>
        <div className="exam-entry-field-grid">
          <label className="exam-entry-field is-wide" htmlFor="exam-entry-name">
            <span>考试名称：</span>
            <input
              autoComplete="off"
              id="exam-entry-name"
              onChange={(event) => {
                onExamNameChange(event.currentTarget.value);
              }}
              value={examName}
            />
          </label>
          <label className="exam-entry-field" htmlFor="exam-entry-subject">
            <span>科目：</span>
            <select
              id="exam-entry-subject"
              onChange={(event) => {
                onSubjectChange(event.currentTarget.value);
              }}
              value={subjectLabel}
            >
              <option value="数学">数学</option>
              <option value="英语">英语</option>
              <option value="语文">语文</option>
            </select>
          </label>
          <label className="exam-entry-field" htmlFor="exam-entry-type">
            <span>考试类型：</span>
            <select
              id="exam-entry-type"
              onChange={(event) => {
                onExamTypeChange(event.currentTarget.value);
              }}
              value={examType}
            >
              <option value="单元检测">单元检测</option>
              <option value="课堂小测">课堂小测</option>
              <option value="阅读检测">阅读检测</option>
              <option value="其他">其他</option>
            </select>
          </label>
          <label className="exam-entry-field" htmlFor="exam-entry-date">
            <span>考试日期：</span>
            <input
              id="exam-entry-date"
              onChange={(event) => {
                onExamDateChange(event.currentTarget.value);
              }}
              type="date"
              value={examDate}
            />
          </label>
          <label className="exam-entry-field is-wide" htmlFor="exam-entry-scope">
            <span>考试范围：</span>
            <input
              autoComplete="off"
              id="exam-entry-scope"
              onChange={(event) => {
                onExamScopeChange(event.currentTarget.value);
              }}
              value={examScope}
            />
          </label>
          <label className="exam-entry-field" htmlFor="exam-entry-textbook">
            <span>教材对齐：</span>
            <select id="exam-entry-textbook" value={document.textbookAlignmentLabel} disabled>
              <option>{document.textbookAlignmentLabel}</option>
            </select>
          </label>
        </div>
        <div className="exam-entry-score-row">
          <label htmlFor="exam-entry-earned">
            <span>我的得分：</span>
            <input
              id="exam-entry-earned"
              inputMode="decimal"
              onChange={(event) => {
                onEarnedScoreChange(event.currentTarget.value);
              }}
              value={earnedScore}
            />
          </label>
          <label htmlFor="exam-entry-maximum">
            <span>满分量尺：</span>
            <input
              id="exam-entry-maximum"
              inputMode="decimal"
              onChange={(event) => {
                onMaximumScoreChange(event.currentTarget.value);
              }}
              value={maximumScore}
            />
          </label>
          <p aria-live="polite">
            总失分 = {maximumScore || "—"} - {earnedScore || "—"} = {totalLoss === null ? "—" : formatDecimal(totalLoss)}
          </p>
        </div>
        <p className="exam-entry-score-notice">{document.scoreScaleNotice}</p>
      </fieldset>
    </section>
  );
}

function LossItemsSection({
  items,
  onAdd,
  onConfirm,
  onItemChange,
  onRemove,
  scoreDifference,
  totalLoss,
}: {
  readonly items: readonly ExamLossItemDraft[];
  readonly onAdd: () => void;
  readonly onConfirm: (id: string) => void;
  readonly onItemChange: (id: string, field: keyof Pick<ExamLossItemDraft, "questionNumber" | "lossScore" | "scopeLabel" | "reasonLabel">, value: string) => void;
  readonly onRemove: (id: string) => void;
  readonly scoreDifference: number | null;
  readonly totalLoss: number | null;
}) {
  const lossSum = sumLossItems(items);
  const scoreConsistent = scoreDifference !== null && Math.abs(scoreDifference) < 0.001;
  const statusLine = scoreConsistent
    ? `与总失分 ${totalLoss === null ? "—" : formatDecimal(totalLoss)} 一致 · 可以保存`
    : `差额 ${scoreDifference === null ? "—" : formatDecimal(Math.abs(scoreDifference))} · 需继续校验`;
  return (
    <section className="exam-entry-loss-section" aria-labelledby="exam-entry-loss-title">
      <ExamEntrySectionTitle id="exam-entry-loss-title" title="失分项" />
      <div className="exam-entry-loss-table" role="region" aria-label="可编辑失分项">
        <div className="exam-entry-loss-head" aria-hidden="true">
          <span>题号</span>
          <span>失分</span>
          <span>知识点或范围</span>
          <span>已确认原因</span>
          <span>操作</span>
        </div>
        <ol className="exam-entry-loss-rows">
          {items.map((item, index) => {
            const ordinal = String(index + 1);
            return (
              <li className="exam-entry-loss-row" key={item.id}>
                <label>
                  <span className="sr-only">第 {ordinal} 条题号</span>
                <input
                  aria-label={`第 ${ordinal} 条题号`}
                  inputMode="numeric"
                  onChange={(event) => {
                    onItemChange(item.id, "questionNumber", event.currentTarget.value);
                  }}
                  value={item.questionNumber}
                />
                </label>
                <label>
                  <span className="sr-only">第 {ordinal} 条失分</span>
                <input
                  aria-label={`第 ${ordinal} 条失分`}
                  inputMode="decimal"
                  onChange={(event) => {
                    onItemChange(item.id, "lossScore", event.currentTarget.value);
                  }}
                  value={item.lossScore}
                />
                </label>
                <label>
                  <span className="sr-only">第 {ordinal} 条知识点或范围</span>
                <input
                  aria-label={`第 ${ordinal} 条知识点或范围`}
                  onChange={(event) => {
                    onItemChange(item.id, "scopeLabel", event.currentTarget.value);
                  }}
                  value={item.scopeLabel}
                />
                </label>
                <label>
                  <span className="sr-only">第 {ordinal} 条已确认原因</span>
                <input
                  aria-label={`第 ${ordinal} 条已确认原因`}
                  onChange={(event) => {
                    onItemChange(item.id, "reasonLabel", event.currentTarget.value);
                  }}
                  value={item.reasonLabel}
                />
                </label>
                <div className="exam-entry-loss-actions">
                  <button className="text-button" onClick={() => { onConfirm(item.id); }} type="button">
                    {item.confirmed ? "编辑" : "确认"}
                  </button>
                  {item.confirmed ? null : (
                    <button className="text-button" onClick={() => { onRemove(item.id); }} type="button">
                      移除
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <button className="text-button exam-entry-add-loss" onClick={onAdd} type="button">
        <span aria-hidden="true">＋</span>
        添加失分项
      </button>
      <div className="exam-entry-reconciliation" aria-live="polite">
        <p>失分项合计　{items.map((item) => item.lossScore || "0").join(" + ")} = {formatDecimal(lossSum)}</p>
        <strong className={scoreConsistent ? "is-consistent" : "is-different"}>{statusLine}</strong>
      </div>
    </section>
  );
}

function NoteSection({
  note,
  noteLimit,
  onNoteChange,
}: {
  readonly note: string;
  readonly noteLimit: number;
  readonly onNoteChange: (value: string) => void;
}) {
  return (
    <section className="exam-entry-note-section" aria-labelledby="exam-entry-note-title">
      <ExamEntrySectionTitle id="exam-entry-note-title" title="补充说明" />
      <label className="exam-entry-note-field" htmlFor="exam-entry-note">
        <span className="sr-only">补充说明</span>
        <textarea
          id="exam-entry-note"
          maxLength={noteLimit}
          onChange={(event) => {
            onNoteChange(event.currentTarget.value);
          }}
          rows={4}
          value={note}
        />
        <small>{note.length} / {noteLimit}</small>
      </label>
    </section>
  );
}

function rowsForCompleteness({
  document,
  factsComplete,
  lossItemsConfirmed,
}: {
  readonly document: ExamEntryDocument;
  readonly factsComplete: boolean;
  readonly lossItemsConfirmed: boolean;
}): readonly DefinitionRow[] {
  return document.completenessRows.map((row) => {
    if (row.semanticKey === "EXAM_FACTS") {
      return { ...row, value: factsComplete ? "已填写" : "未完整" };
    }
    if (row.semanticKey === "LOSS_ITEMS") {
      return { ...row, value: lossItemsConfirmed ? "3条已确认" : "仍有未确认" };
    }
    return row;
  });
}

function rowsForScore({
  earnedScore,
  items,
  maximumScore,
}: {
  readonly earnedScore: string;
  readonly items: readonly ExamLossItemDraft[];
  readonly maximumScore: string;
}): readonly DefinitionRow[] {
  const totalLoss = scoreLoss(earnedScore, maximumScore);
  const lossSum = sumLossItems(items);
  const difference = totalLoss === null ? null : totalLoss - lossSum;
  return [
    { id: "exam-entry-score-maximum", label: "满分", value: maximumScore || "—" },
    { id: "exam-entry-score-earned", label: "得分", value: earnedScore || "—" },
    { id: "exam-entry-score-loss", label: "总失分", value: totalLoss === null ? "—" : formatDecimal(totalLoss) },
    { id: "exam-entry-score-loss-sum", label: "失分项合计", value: formatDecimal(lossSum) },
    { id: "exam-entry-score-difference", label: "差额", value: difference === null ? "—" : formatDecimal(Math.abs(difference)) },
    { id: "exam-entry-score-state", label: "状态", value: difference !== null && Math.abs(difference) < 0.001 ? "校验一致" : "待校验" },
  ];
}

function ExamEntryRailSection({
  children,
  rows,
  title,
}: {
  readonly children?: ReactNode;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  return (
    <section className="exam-entry-rail-section">
      <div className="exam-entry-rail-title">
        <h2>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <ExamEntryDefinitionList rows={rows} />
      {children}
    </section>
  );
}

function ExamEntryRightRail({
  document,
  earnedScore,
  factsComplete,
  items,
  lossItemsConfirmed,
  maximumScore,
  status,
}: {
  readonly document: ExamEntryDocument;
  readonly earnedScore: string;
  readonly factsComplete: boolean;
  readonly items: readonly ExamLossItemDraft[];
  readonly lossItemsConfirmed: boolean;
  readonly maximumScore: string;
  readonly status: ExamEntryStatus;
}) {
  return (
    <aside aria-label="考试录入辅助信息" className="exam-entry-rail">
      <ExamEntryRailSection
        rows={rowsForCompleteness({ document, factsComplete, lossItemsConfirmed })}
        title="录入完整度"
      />
      <ExamEntryRailSection
        rows={rowsForScore({ earnedScore, items, maximumScore })}
        title="分数校验"
      />
      <ExamEntryRailSection rows={document.scopeRows} title="当前范围" />
      <ExamEntryRailSection rows={document.privacyRows} title="服务与隐私">
        {status === "RESULT_UNKNOWN" ? <p className="exam-entry-service-code">{document.serviceCode}</p> : null}
      </ExamEntryRailSection>
    </aside>
  );
}

function ExamEntryRailCompact({
  document,
  earnedScore,
  factsComplete,
  items,
  lossItemsConfirmed,
  maximumScore,
  status,
}: {
  readonly document: ExamEntryDocument;
  readonly earnedScore: string;
  readonly factsComplete: boolean;
  readonly items: readonly ExamLossItemDraft[];
  readonly lossItemsConfirmed: boolean;
  readonly maximumScore: string;
  readonly status: ExamEntryStatus;
}) {
  return (
    <details className="exam-entry-collapsible">
      <summary>完整度、分数校验、范围与隐私</summary>
      <div className="exam-entry-collapsible-content">
        <ExamEntryRightRail
          document={document}
          earnedScore={earnedScore}
          factsComplete={factsComplete}
          items={items}
          lossItemsConfirmed={lossItemsConfirmed}
          maximumScore={maximumScore}
          status={status}
        />
      </div>
    </details>
  );
}

function ExamSaveDialog({
  document,
  onCancel,
  onConfirm,
}: {
  readonly document: ExamEntryDocument;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const titleId = "exam-entry-save-dialog-title";
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div className="exam-entry-dialog-backdrop">
      <section
        aria-describedby="exam-entry-save-dialog-description"
        aria-labelledby={titleId}
        aria-modal="true"
        className="exam-entry-dialog"
        role="dialog"
      >
        <h2 id={titleId}>{document.saveDialogTitle}</h2>
        <p id="exam-entry-save-dialog-description">{document.saveDialogDescription}</p>
        <ul>
          {document.saveDialogItems.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <div className="exam-entry-dialog-actions">
          <button className="exam-entry-secondary-action" onClick={onCancel} ref={cancelRef} type="button">取消</button>
          <button className="exam-entry-primary-action" onClick={onConfirm} type="button">确认保存</button>
        </div>
      </section>
    </div>
  );
}

function ExamEntryActionBar({
  canSave,
  document,
  examListUrl,
  onSaveDraftReturn,
  onSubmit,
}: {
  readonly canSave: boolean;
  readonly document: ExamEntryDocument;
  readonly examListUrl: string;
  readonly onSaveDraftReturn: () => void;
  readonly onSubmit: () => void;
}) {
  return (
    <section className="exam-entry-actions" aria-labelledby="exam-entry-actions-title">
      <h2 id="exam-entry-actions-title">保存记录</h2>
      <div className="exam-entry-action-row">
        <button
          className="exam-entry-primary-action"
          disabled={!canSave}
          onClick={onSubmit}
          type="submit"
        >
          <span>{document.primaryActionLabel}</span>
          <Icon name="arrowRight" size={22} />
        </button>
        <button className="exam-entry-secondary-action" onClick={onSaveDraftReturn} type="button">
          {document.saveDraftActionLabel}
        </button>
        <Link className="text-button exam-entry-cancel-link" to={examListUrl}>{document.cancelActionLabel}</Link>
      </div>
      <p className="exam-entry-warning">{document.saveNotice}</p>
      <p>{document.scopeNotice}</p>
    </section>
  );
}

function ExamEntryReady({
  course,
  currentUser,
  dateTime,
  demoActive,
  document,
}: {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: ExamEntryDocument;
}) {
  const [examName, setExamName] = useState(document.examName);
  const [subjectLabel, setSubjectLabel] = useState(document.subjectLabel);
  const [examType, setExamType] = useState(document.examTypeLabel);
  const [examDate, setExamDate] = useState(document.examDate);
  const [examScope, setExamScope] = useState(document.scopeLabel);
  const [earnedScore, setEarnedScore] = useState(document.earnedScore);
  const [maximumScore, setMaximumScore] = useState(document.maximumScore);
  const [lossItems, setLossItems] = useState<readonly ExamLossItemDraft[]>(document.lossItems);
  const [note, setNote] = useState(document.noteValue);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState<ExamEntryStatus>(document.status);
  const [message, setMessage] = useState<string | null>(null);
  const [draftCounter, setDraftCounter] = useState(0);
  const announcementRef = useRef<HTMLParagraphElement | null>(null);
  const examListUrl = buildExamListUrl(course, document);
  const totalLoss = scoreLoss(earnedScore, maximumScore);
  const lossSum = sumLossItems(lossItems);
  const scoreDifference = totalLoss === null ? null : totalLoss - lossSum;
  const scoreConsistent = scoreDifference !== null && Math.abs(scoreDifference) < 0.001;
  const factsComplete = examName.trim().length > 0 &&
    subjectLabel.trim().length > 0 &&
    examType.trim().length > 0 &&
    examDate.trim().length > 0 &&
    examScope.trim().length > 0 &&
    canUseScore(earnedScore, maximumScore);
  const lossItemsConfirmed = lossItems.length > 0 && lossItems.every(isLossItemComplete);
  const canSave = factsComplete && lossItemsConfirmed && scoreConsistent && status !== "RESULT_UNKNOWN";
  const effectiveStatus = status === "RESULT_UNKNOWN"
    ? "RESULT_UNKNOWN"
    : !scoreConsistent
    ? "VALIDATION_ERROR"
    : canSave
    ? "READY_TO_SAVE"
    : "DRAFT_PARTIAL";
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  useEffect(() => {
    if (message !== null) {
      announcementRef.current?.focus();
    }
  }, [message]);

  function updateLossItem(
    id: string,
    field: keyof Pick<ExamLossItemDraft, "questionNumber" | "lossScore" | "scopeLabel" | "reasonLabel">,
    value: string,
  ): void {
    setLossItems((items) => items.map((item) => item.id === id ? { ...item, [field]: value, confirmed: false } : item));
  }

  function confirmLossItem(id: string): void {
    setLossItems((items) => items.map((item) => item.id === id ? { ...item, confirmed: true } : item));
  }

  function addLossItem(): void {
    const nextCounter = draftCounter + 1;
    setDraftCounter(nextCounter);
    setLossItems((items) => [
      ...items,
      {
        id: `draft-loss-${String(nextCounter)}`,
        questionNumber: "",
        lossScore: "0",
        scopeLabel: "",
        reasonLabel: "",
        confirmed: false,
      },
    ]);
  }

  function removeLossItem(id: string): void {
    setLossItems((items) => items.filter((item) => item.id !== id));
  }

  function openSaveDialog(): void {
    if (!canSave) {
      setMessage(scoreConsistent ? "考试事实、评分量尺与每条失分项确认后才可以保存完整记录。" : "失分项合计与总失分不一致，不能保存为完整记录。");
      return;
    }
    setDialogOpen(true);
  }

  function confirmSave(): void {
    setDialogOpen(false);
    setStatus("RESULT_UNKNOWN");
    setMessage(document.saveUnknownMessage);
  }

  function saveDraftReturn(): void {
    setMessage(document.draftReturnMessage);
  }

  return (
    <div className="app-shell exam-entry-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <ExamEntryMobileMenu examListUrl={examListUrl} />
      <main className="paper-canvas exam-entry-canvas" id="main-content">
        <ExamEntryHeader dateTime={dateTime} document={document} />
        <ExamEntryProgress scoreConsistent={scoreConsistent} status={effectiveStatus} steps={document.steps} />
        <div className="exam-entry-grid">
          <article className="exam-entry-main" aria-label="考试录入表单">
            <form
              className="exam-entry-form"
              onSubmit={(event) => {
                event.preventDefault();
                openSaveDialog();
              }}
            >
              <ExamFactsSection
                document={document}
                earnedScore={earnedScore}
                examDate={examDate}
                examName={examName}
                examScope={examScope}
                examType={examType}
                maximumScore={maximumScore}
                onEarnedScoreChange={setEarnedScore}
                onExamDateChange={setExamDate}
                onExamNameChange={setExamName}
                onExamScopeChange={setExamScope}
                onExamTypeChange={setExamType}
                onMaximumScoreChange={setMaximumScore}
                onSubjectChange={setSubjectLabel}
                subjectLabel={subjectLabel}
              />
              <LossItemsSection
                items={lossItems}
                onAdd={addLossItem}
                onConfirm={confirmLossItem}
                onItemChange={updateLossItem}
                onRemove={removeLossItem}
                scoreDifference={scoreDifference}
                totalLoss={totalLoss}
              />
              <NoteSection note={note} noteLimit={document.noteCharLimit} onNoteChange={setNote} />
              <ExamEntryActionBar
                canSave={canSave}
                document={document}
                examListUrl={examListUrl}
                onSaveDraftReturn={saveDraftReturn}
                onSubmit={openSaveDialog}
              />
            </form>
            <p
              aria-live="polite"
              className="exam-entry-action-message"
              ref={announcementRef}
              tabIndex={-1}
            >
              {message}
            </p>
            {sourceBoundary === undefined ? null : <p className="exam-entry-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="exam-entry-rail-divider" />
          <ExamEntryRightRail
            document={document}
            earnedScore={earnedScore}
            factsComplete={factsComplete}
            items={lossItems}
            lossItemsConfirmed={lossItemsConfirmed}
            maximumScore={maximumScore}
            status={effectiveStatus}
          />
          <ExamEntryRailCompact
            document={document}
            earnedScore={earnedScore}
            factsComplete={factsComplete}
            items={lossItems}
            lossItemsConfirmed={lossItemsConfirmed}
            maximumScore={maximumScore}
            status={effectiveStatus}
          />
        </div>
        {dialogOpen ? (
          <ExamSaveDialog
            document={document}
            onCancel={() => {
              setDialogOpen(false);
            }}
            onConfirm={confirmSave}
          />
        ) : null}
      </main>
    </div>
  );
}

function ExamEntryUnavailableSurface({
  currentUser,
  demoActive,
  overviewUrl,
  subtitle,
  title,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}) {
  return (
    <div className="app-shell exam-entry-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page exam-entry-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="EXAM_ENTRY_UNAVAILABLE：当前不会展示虚构考试草稿、失分项、examId、图片上传、OCR、自动阅卷、排名、班级均分、LearningEvidence、Mastery 或云端笔记。"
          title="考试录入服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function ExamEntryLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell exam-entry-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="assessment" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas exam-entry-canvas" id="main-content">
        <div aria-label="正在加载考试录入" className="page-loading exam-entry-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface ExamEntryRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly examId: string | null;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function ExamEntryRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  examId,
  overviewUrl,
  targetId,
}: ExamEntryRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      const targetDocument = course.examEntries?.find((item) => item.targetId === targetId);
      if (targetDocument === undefined) {
        return undefined;
      }
      if (examId !== null && targetDocument.examId !== null && targetDocument.examId !== examId) {
        return undefined;
      }
      return targetDocument;
    }
    if (examId !== null) {
      return course.examEntries?.find((item) => item.examId === examId);
    }
    return course.examEntries?.[0];
  }, [course.examEntries, examId, targetId]);

  if (document === undefined) {
    return (
      <ExamEntryServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-025 考试录入文档；生产环境不会用开发 Fixture 补考试草稿、失分项、examId 或保存状态。"
        title="考试录入"
      />
    );
  }

  if (document.status === "LOADING") {
    return <ExamEntryLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableExamEntry(document)) {
    return (
      <ExamEntryServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="考试录入不可用；请在真实服务接入后重试，当前不会回退到 Fixture 或猜测考试事实。"
        title="考试录入"
      />
    );
  }

  return (
    <ExamEntryReady
      course={course}
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function ExamEntryServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的考试录入服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "考试录入",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <ExamEntryUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
