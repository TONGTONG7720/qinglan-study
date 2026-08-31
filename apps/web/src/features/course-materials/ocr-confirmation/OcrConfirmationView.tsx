import { useId, useState } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  OcrConfirmation,
  OcrConfirmationCheckRow,
  OcrConfirmationStatus,
  OcrSegment,
  QuestionModeKind,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const serviceStateCopy: Record<OcrConfirmationStatus, { readonly title: string; readonly description: string }> = {
  LOW_CONFIDENCE_SEGMENTS: {
    title: "确认识别题面",
    description: "OCR 已返回低置信片段，必须由学生对照原图确认。",
  },
  HIGH_CONFIDENCE_AWAITING_CONFIRM: {
    title: "确认识别题面",
    description: "OCR 片段均为高置信，但仍需要学生确认后才可进入辅导。",
  },
  STUDENT_CORRECTED: {
    title: "题面已修正",
    description: "学生已修正低置信片段，等待服务端确认创建辅导。",
  },
  RECOGNIZING: {
    title: "正在识别",
    description: "OCR 仍在处理中；页面不能生成临时题面或提前创建辅导。",
  },
  OCR_FAILED: {
    title: "识别失败",
    description: "OCR 没有可确认结果；请返回图片上传或改用文字提问。",
  },
  SOURCE_IMAGE_UNAVAILABLE: {
    title: "原图不可用",
    description: "无法读取原图时不能生成替代图，也不能要求学生确认 OCR 文本。",
  },
  SUBMITTING: {
    title: "正在提交确认",
    description: "提交中应禁用重复操作，并使用原幂等 operation 查询结果。",
  },
  RESULT_UNKNOWN: {
    title: "确认结果待查询",
    description: "响应丢失时不能重复创建辅导，必须查询原 operation。",
  },
  OFFLINE_CANNOT_CONFIRM: {
    title: "离线不可确认",
    description: "离线状态不能声称题面已确认；请稍后重试或改用文字提问。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后，再读取本人 OCR 确认内容。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "OCR 确认范围不可用",
    description: "当前草稿不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

function normalizeMathText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function buildSegmentMap(segments: readonly OcrSegment[]): ReadonlyMap<string, string> {
  return new Map(segments.map((segment) => [segment.id, segment.recognizedText]));
}

function OcrMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="ocr-mobile-menu">
      <summary aria-label="打开移动端 OCR 确认导航">
        <span>
          <strong>清朗学习</strong>
          <small>OCR 确认</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端 OCR 确认功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <span>单题图片</span>
        <span aria-current="page">OCR 确认</span>
      </nav>
    </details>
  );
}

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["ocr-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function OcrPageHeader({
  dateFootnote,
  dateTime,
  demoActive,
  detail,
  overviewUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: OcrConfirmation;
  readonly overviewUrl: string;
}) {
  return (
    <header className="page-header ocr-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
          <span aria-hidden="true">/</span>
          <a href={overviewUrl}>课程与资料</a>
        </nav>
        <h1>{detail.title}</h1>
        <div className="ocr-header-meta">
          <p>{detail.subtitle}</p>
          {demoActive && detail.fixtureBadgeLabel !== undefined ? <span>{detail.fixtureBadgeLabel}</span> : null}
        </div>
      </div>
      <div className="page-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}`}>
        <span>{dateTime.weekdayEnglish}</span>
        <strong>{dateTime.date}</strong>
        <small>{dateFootnote}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function OcrContext({ detail }: { readonly detail: OcrConfirmation }) {
  return (
    <section className="ocr-context-panel" aria-labelledby="ocr-context-title">
      <div className="ocr-section-title">
        <h2 id="ocr-context-title">{detail.contextTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="ocr-context-list" rows={detail.contextRows} />
      <p className="ocr-context-notice"><Icon name="info" size={17} />{detail.contextNotice}</p>
    </section>
  );
}

function OcrWorkflow({ detail }: { readonly detail: OcrConfirmation }) {
  return (
    <ol className="ocr-workflow" aria-label="单题图片到 OCR 确认流程">
      {detail.workflowSteps.map((step) => (
        <li className={step.completed ? "is-complete" : "is-current"} key={step.id}>
          <span aria-hidden="true">{step.completed ? <Icon name="check" size={15} /> : step.ordinalLabel}</span>
          <strong>{step.title}</strong>
        </li>
      ))}
    </ol>
  );
}

function OcrSourceAssetPanel({
  detail,
  onImageUploadReturn,
}: {
  readonly detail: OcrConfirmation;
  readonly onImageUploadReturn: () => void;
}) {
  return (
    <section className="ocr-source-panel" aria-labelledby="ocr-source-title">
      <div className="ocr-section-title">
        <h2 id="ocr-source-title">{detail.sourceTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <div className="ocr-source-paper" aria-label="原图题面预览">
        {detail.sourceAsset.previewLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <DefinitionList
        className="ocr-source-meta"
        rows={[
          { id: "ocr-source-file", label: "文件", value: detail.sourceAsset.fileName },
          { id: "ocr-source-size", label: "大小", value: detail.sourceAsset.fileSizeLabel },
          { id: "ocr-source-visibility", label: "范围", value: detail.sourceAsset.visibilityLabel },
          { id: "ocr-source-available", label: "状态", value: detail.sourceAsset.availabilityLabel },
        ]}
      />
      <div className="ocr-source-actions">
        <button className="secondary-button" type="button">{detail.sourceActionLabels[0] ?? "查看原图"}</button>
        <button className="secondary-button" onClick={onImageUploadReturn} type="button">
          {detail.sourceActionLabels[1] ?? "替换图片"}
        </button>
      </div>
    </section>
  );
}

function OcrSegmentRow({
  confirmed,
  draft,
  onConfirm,
  onDraftChange,
  segment,
}: {
  readonly confirmed: boolean;
  readonly draft: string;
  readonly onConfirm: () => void;
  readonly onDraftChange: (value: string) => void;
  readonly segment: OcrSegment;
}) {
  const inputId = `ocr-segment-${segment.id}`;
  const helpId = `${inputId}-help`;
  const correctionReady = normalizeMathText(draft) === normalizeMathText(segment.correctedText);
  const canConfirm = segment.editable && correctionReady && !confirmed;
  const toneClass = segment.confidence === "LOW" && !confirmed ? "is-low" : "is-high";
  return (
    <li className={["ocr-segment-row", toneClass, confirmed ? "is-confirmed" : undefined].filter(Boolean).join(" ")}>
      <span className="ocr-segment-index" aria-hidden="true">{segment.ordinalLabel}</span>
      <div className="ocr-segment-body">
        {segment.editable ? (
          <label className="ocr-segment-field" htmlFor={inputId}>
            <span className="sr-only">第 {segment.ordinalLabel} 个 OCR 片段</span>
            <input
              aria-describedby={helpId}
              disabled={confirmed}
              id={inputId}
              onChange={(event) => { onDraftChange(event.currentTarget.value); }}
              value={draft}
            />
          </label>
        ) : (
          <p>{segment.recognizedText}</p>
        )}
        <small id={helpId}>{segment.helpText}</small>
      </div>
      <strong className="ocr-segment-confidence">{segment.confidenceLabel}</strong>
      <span className="ocr-segment-status">
        {confirmed ? "已确认" : segment.statusLabel}
        {confirmed ? <Icon name="check" size={15} /> : segment.confidence === "LOW" ? <Icon name="circleAlert" size={15} /> : null}
      </span>
      {segment.editable ? (
        <button className="secondary-button" disabled={!canConfirm} onClick={onConfirm} type="button">
          标记已修正
        </button>
      ) : null}
    </li>
  );
}

function OcrSegmentList({
  confirmedSegmentIds,
  detail,
  segmentDrafts,
  setConfirmedSegmentIds,
  setSegmentDrafts,
}: {
  readonly confirmedSegmentIds: readonly string[];
  readonly detail: OcrConfirmation;
  readonly segmentDrafts: ReadonlyMap<string, string>;
  readonly setConfirmedSegmentIds: (ids: readonly string[]) => void;
  readonly setSegmentDrafts: (drafts: ReadonlyMap<string, string>) => void;
}) {
  function isConfirmed(segment: OcrSegment): boolean {
    return segment.confirmed || confirmedSegmentIds.includes(segment.id);
  }

  function updateSegmentDraft(segmentId: string, value: string): void {
    const nextDrafts = new Map(segmentDrafts);
    nextDrafts.set(segmentId, value);
    setSegmentDrafts(nextDrafts);
  }

  return (
    <section className="ocr-segment-panel" aria-labelledby="ocr-segment-title">
      <div className="ocr-section-title">
        <h2 id="ocr-segment-title">{detail.segmentTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <p className="ocr-segment-summary">{detail.segmentSummary}</p>
      <ol className="ocr-segment-list">
        {detail.segments.map((segment) => (
          <OcrSegmentRow
            confirmed={isConfirmed(segment)}
            draft={segmentDrafts.get(segment.id) ?? segment.recognizedText}
            key={segment.id}
            onConfirm={() => {
              if (!confirmedSegmentIds.includes(segment.id)) {
                setConfirmedSegmentIds([...confirmedSegmentIds, segment.id]);
              }
            }}
            onDraftChange={(value) => { updateSegmentDraft(segment.id, value); }}
            segment={segment}
          />
        ))}
      </ol>
      <OcrPreview detail={detail} segmentDrafts={segmentDrafts} />
    </section>
  );
}

function OcrPreview({
  detail,
  segmentDrafts,
}: {
  readonly detail: OcrConfirmation;
  readonly segmentDrafts: ReadonlyMap<string, string>;
}) {
  return (
    <section className="ocr-preview-panel" aria-labelledby="ocr-preview-title">
      <h3 id="ocr-preview-title">{detail.previewTitle}</h3>
      <p>
        {detail.segments.map((segment, index) => {
          const text = segmentDrafts.get(segment.id) ?? segment.recognizedText;
          return (
            <span className={segment.confidence === "LOW" ? "ocr-preview-low" : undefined} key={segment.id}>
              {index === 0 ? text : `，${text}`}
            </span>
          );
        })}
      </p>
      <small><Icon name="circleAlert" size={15} />{detail.lowConfidenceHint}</small>
    </section>
  );
}

function buildConfirmationRows({
  confirmedSegmentIds,
  detail,
}: {
  readonly confirmedSegmentIds: readonly string[];
  readonly detail: OcrConfirmation;
}): readonly OcrConfirmationCheckRow[] {
  const highSegments = detail.segments.filter((segment) => segment.confidence === "HIGH");
  const lowSegments = detail.segments.filter((segment) => segment.confidence === "LOW");
  const confirmedHighCount = highSegments.filter((segment) => segment.confirmed || confirmedSegmentIds.includes(segment.id)).length;
  const confirmedLowCount = lowSegments.filter((segment) => segment.confirmed || confirmedSegmentIds.includes(segment.id)).length;
  const allConfirmed = detail.segments.every((segment) => segment.confirmed || confirmedSegmentIds.includes(segment.id));
  return detail.confirmRows.map((row) => {
    if (row.id.endsWith("-high")) {
      return { ...row, completed: confirmedHighCount === highSegments.length, value: `${String(confirmedHighCount)} / ${String(highSegments.length)} 已检查` };
    }
    if (row.id.endsWith("-low")) {
      return { ...row, completed: confirmedLowCount === lowSegments.length, value: `${String(confirmedLowCount)} / ${String(lowSegments.length)} 已确认` };
    }
    if (row.id.endsWith("-full")) {
      return { ...row, completed: allConfirmed, value: allConfirmed ? "已确认" : "待确认" };
    }
    return row;
  });
}

function ConfirmationProgress({
  rows,
  title,
}: {
  readonly rows: readonly OcrConfirmationCheckRow[];
  readonly title: string;
}) {
  return (
    <section className="ocr-confirm-panel" aria-labelledby="ocr-confirm-title">
      <div className="ocr-section-title">
        <h2 id="ocr-confirm-title">{title}</h2>
        <span aria-hidden="true" />
      </div>
      <dl>
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>
              {row.value}
              {row.completed ? <Icon name="check" size={15} /> : row.id.endsWith("-low") ? <Icon name="circleAlert" size={15} /> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function OcrActionBar({
  allConfirmed,
  detail,
  onHubReturn,
  onImageUploadReturn,
  onSubmit,
  onTextModeOpen,
  submitMessage,
}: {
  readonly allConfirmed: boolean;
  readonly detail: OcrConfirmation;
  readonly onHubReturn: () => void;
  readonly onImageUploadReturn: () => void;
  readonly onSubmit: () => void;
  readonly onTextModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly submitMessage: string | null;
}) {
  const primaryDisabled = !allConfirmed || submitMessage !== null;
  return (
    <section className="ocr-action-panel" aria-labelledby="ocr-action-title">
      <h2 className="sr-only" id="ocr-action-title">OCR 确认操作</h2>
      <button className="primary-button" disabled={primaryDisabled} onClick={onSubmit} type="button">
        {detail.primaryActionLabel}
      </button>
      <p aria-live="polite">{submitMessage ?? (allConfirmed ? detail.primaryReadyHint : detail.primaryDisabledHint)}</p>
      <div className="ocr-action-secondary">
        <button className="secondary-button" type="button">{detail.reRecognizeLabel}</button>
        <button className="secondary-button" onClick={onImageUploadReturn} type="button">
          {detail.returnImageUploadLabel}
        </button>
      </div>
      <div className="ocr-action-links">
        <button
          className="text-button"
          disabled={detail.textTargetId === null}
          onClick={() => {
            if (detail.textTargetId !== null) {
              onTextModeOpen(detail.textTargetId, "TEXT");
            }
          }}
          type="button"
        >
          {detail.textModeLabel}
          <Icon name="chevronRight" size={16} />
        </button>
        <button className="text-button" onClick={onHubReturn} type="button">
          {detail.returnHubLabel}
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </section>
  );
}

function updateRowsForConfirmation({
  confirmedSegmentIds,
  detail,
  rows,
}: {
  readonly confirmedSegmentIds: readonly string[];
  readonly detail: OcrConfirmation;
  readonly rows: readonly DefinitionRow[];
}): readonly DefinitionRow[] {
  const confirmedCount = detail.segments.filter((segment) => segment.confirmed || confirmedSegmentIds.includes(segment.id)).length;
  const lowSegments = detail.segments.filter((segment) => segment.confidence === "LOW");
  const confirmedLowCount = lowSegments.filter((segment) => segment.confirmed || confirmedSegmentIds.includes(segment.id)).length;
  return rows.map((row) => {
    if (row.id.endsWith("-confirmed")) {
      return { ...row, value: `${String(confirmedCount)} / ${String(detail.segments.length)}` };
    }
    if (row.id.endsWith("-pending")) {
      return { ...row, value: String(detail.segments.length - confirmedCount) };
    }
    if (row.id.endsWith("-status")) {
      return { ...row, value: confirmedLowCount === lowSegments.length ? "已确认" : "需要确认" };
    }
    return row;
  });
}

function OcrRightRail({
  confirmedSegmentIds,
  detail,
}: {
  readonly confirmedSegmentIds: readonly string[];
  readonly detail: OcrConfirmation;
}) {
  const summaryRows = updateRowsForConfirmation({
    confirmedSegmentIds,
    detail,
    rows: detail.ocrSummaryRows,
  });
  const pendingRows = updateRowsForConfirmation({
    confirmedSegmentIds,
    detail,
    rows: detail.pendingSegmentRows,
  });
  return (
    <aside className="right-rail ocr-rail" aria-label="OCR 确认辅助信息">
      <OcrRailSection rows={detail.railContextRows} title="当前上下文" />
      <OcrRailSection rows={summaryRows} title="OCR 摘要" />
      <OcrRailSection className="ocr-rail-pending" rows={pendingRows} title="待处理片段" />
      <OcrRailSection rows={detail.imageStatusRows} title="图片状态" />
      <section className="ocr-rule-panel" aria-labelledby="ocr-rule-title">
        <h2 id="ocr-rule-title">确认规则</h2>
        <ul>
          {detail.confirmationRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>
      <OcrRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="ocr-service-code">{detail.serviceCode}</p>
      <p className="ocr-rail-boundary">原图、OCR 文本与辅导记录仅在授权家庭范围内使用。</p>
    </aside>
  );
}

function OcrRailSection({
  className,
  rows,
  title,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `ocr-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className={["ocr-rail-section", className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <div className="ocr-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="ocr-rail-list" rows={rows} />
    </section>
  );
}

function OcrRailCompact({
  confirmedSegmentIds,
  detail,
}: {
  readonly confirmedSegmentIds: readonly string[];
  readonly detail: OcrConfirmation;
}) {
  return (
    <details className="right-rail-collapsible ocr-collapsible">
      <summary>
        <span>上下文、OCR 与服务</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <OcrRightRail confirmedSegmentIds={confirmedSegmentIds} detail={detail} />
      </div>
    </details>
  );
}

export interface OcrConfirmationRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly draftId: string | null;
  readonly knowledgePointId: string | null;
  readonly onHubReturn: () => void;
  readonly onImageUploadReturn: () => void;
  readonly onTextModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly overviewUrl: string;
}

export function OcrConfirmationRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  draftId,
  knowledgePointId,
  onHubReturn,
  onImageUploadReturn,
  onTextModeOpen,
  overviewUrl,
}: OcrConfirmationRouteProps) {
  const detail = course.ocrConfirmations?.find((item) => item.questionDraftId === draftId) ??
    course.ocrConfirmations?.find((item) => item.knowledgePointId === knowledgePointId) ??
    (draftId === null && knowledgePointId === null ? course.ocrConfirmations?.[0] : undefined);
  const [confirmedSegmentIds, setConfirmedSegmentIds] = useState<readonly string[]>([]);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [segmentDrafts, setSegmentDrafts] = useState<ReadonlyMap<string, string>>(() => buildSegmentMap(detail?.segments ?? []));

  if (detail === undefined) {
    return (
      <OcrConfirmationServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端 OCR 确认文档；生产环境不会用开发 Fixture 补 questionDraft、asset、OCR 文本或辅导会话。"
        title="OCR 结果确认"
      />
    );
  }

  if (detail.status !== "LOW_CONFIDENCE_SEGMENTS") {
    const copy = serviceStateCopy[detail.status];
    return (
      <OcrConfirmationServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.description}
        title={copy.title}
      />
    );
  }

  const activeDetail = detail;
  const allConfirmed = activeDetail.segments.every((segment) => segment.confirmed || confirmedSegmentIds.includes(segment.id));
  const confirmationRows = buildConfirmationRows({ confirmedSegmentIds, detail: activeDetail });

  function handleSubmit(): void {
    if (!allConfirmed) {
      return;
    }
    setSubmitMessage(activeDetail.submitUnavailableMessage);
  }

  return (
    <div className="app-shell ocr-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <OcrMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas ocr-canvas" id="main-content">
        <OcrPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          demoActive={demoActive}
          detail={activeDetail}
          overviewUrl={overviewUrl}
        />
        <div className="content-grid ocr-grid">
          <article className="main-column ocr-main" aria-label="OCR 结果确认">
            <OcrContext detail={activeDetail} />
            <OcrWorkflow detail={activeDetail} />

            <div className="ocr-review-grid">
              <OcrSourceAssetPanel detail={activeDetail} onImageUploadReturn={onImageUploadReturn} />
              <OcrSegmentList
                confirmedSegmentIds={confirmedSegmentIds}
                detail={activeDetail}
                segmentDrafts={segmentDrafts}
                setConfirmedSegmentIds={setConfirmedSegmentIds}
                setSegmentDrafts={setSegmentDrafts}
              />
            </div>

            <div className="ocr-lower-grid">
              <ConfirmationProgress rows={confirmationRows} title={activeDetail.confirmTitle} />
              <OcrActionBar
                allConfirmed={allConfirmed}
                detail={activeDetail}
                onHubReturn={onHubReturn}
                onImageUploadReturn={onImageUploadReturn}
                onSubmit={handleSubmit}
                onTextModeOpen={onTextModeOpen}
                submitMessage={submitMessage}
              />
            </div>

            <p className="ocr-source-boundary">{activeDetail.sourceBoundary}</p>
          </article>

          <OcrRightRail confirmedSegmentIds={confirmedSegmentIds} detail={activeDetail} />
          <OcrRailCompact confirmedSegmentIds={confirmedSegmentIds} detail={activeDetail} />
        </div>
      </main>
    </div>
  );
}

export interface OcrConfirmationServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function OcrConfirmationServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: OcrConfirmationServiceUnavailableProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="当前没有真实 OCR 确认服务端文档；不会把开发 Fixture、低置信文本、本地修正或页面点击伪装成 questionDraft、asset、TutorSession 或学习证据。"
          title="OCR 结果确认服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
