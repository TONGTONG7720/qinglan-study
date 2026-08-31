import { useId, useMemo, useRef, useState } from "react";
import type { RefObject, SyntheticEvent } from "react";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  ImageQuestionCheckRow,
  ImageQuestionUpload,
  ImageQuestionUploadStatus,
  QuestionModeKind,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const maxImageQuestionBytes = 10 * 1024 * 1024;

const serviceStateCopy: Record<ImageQuestionUploadStatus, { readonly title: string; readonly description: string }> = {
  EMPTY: {
    title: "单题图片上传",
    description: "图片上传空表单已由服务端返回。",
  },
  SELECTING_CROPPING: {
    title: "裁切确认",
    description: "学生正在确认题面范围；确认前不会上传原图。",
  },
  UPLOADING: {
    title: "安全上传",
    description: "上传中应禁止重复提交，并用同一个 operation 查询结果。",
  },
  INVALID_FILE: {
    title: "文件不可用",
    description: "图片格式、大小、签名、尺寸或内容校验未通过。",
  },
  UNCLEAR_SCOPE: {
    title: "图片范围不清",
    description: "题面不是单题、边缘不完整或包含无关信息时，必须重新选择。",
  },
  UPLOAD_FAILED: {
    title: "上传失败",
    description: "保留当前选择，允许学生替换图片或稍后重试。",
  },
  RESULT_UNKNOWN: {
    title: "上传结果待确认",
    description: "不能重复上传；需要查询原 operation 后再决定下一步。",
  },
  OFFLINE_USE_TEXT: {
    title: "离线不可上传",
    description: "离线时不能声称上传成功；请改用文字提问或稍后重试。",
  },
  UPLOAD_SUCCEEDED: {
    title: "进入 OCR 确认",
    description: "只有服务端返回 questionDraftId 与 assetId 后才能进入 OCR 确认。",
  },
  SESSION_EXPIRED: {
    title: "会话已过期",
    description: "请重新建立学生会话后，再选择本人单题图片。",
  },
  DENIED_AS_NOT_FOUND: {
    title: "图片提问范围不可用",
    description: "当前上下文不在学生 OWN 范围内，按统一不泄露语义处理。",
  },
};

interface SelectedImageFile {
  readonly name: string;
  readonly sizeBytes: number;
  readonly type: string;
  readonly extension: string;
}

function formatImageSize(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) {
    return `${String(Math.max(1, Math.round(sizeBytes / 1024)))} KB`;
  }
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : "";
}

function validateImageFile(file: File): string | null {
  const extension = getFileExtension(file.name);
  const extensionAllowed = extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp";
  const mimeAllowed = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  if (!extensionAllowed || !mimeAllowed) {
    return "只支持 JPG、PNG 或 WebP 图片。";
  }
  if (file.size <= 0) {
    return "图片文件为空或已损坏，请重新选择。";
  }
  if (file.size > maxImageQuestionBytes) {
    return "图片超过 10 MB，请裁剪或压缩后重新选择。";
  }
  return null;
}

function toSelectedImageFile(file: File): SelectedImageFile {
  return {
    extension: getFileExtension(file.name).toUpperCase(),
    name: file.name,
    sizeBytes: file.size,
    type: file.type,
  };
}

function ImageQuestionMobileMenu({ overviewUrl }: { readonly overviewUrl: string }) {
  return (
    <details className="image-question-mobile-menu">
      <summary aria-label="打开移动端单题图片导航">
        <span>
          <strong>清朗学习</strong>
          <small>单题图片</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端单题图片功能">
        <a href="/student/today">今日学习</a>
        <a href={overviewUrl}>课程与资料</a>
        <span aria-current="page">单题图片</span>
        <span>OCR 确认 · 未接入</span>
      </nav>
    </details>
  );
}

function ImageQuestionPageHeader({
  dateFootnote,
  dateTime,
  demoActive,
  detail,
  overviewUrl,
}: {
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly detail: ImageQuestionUpload;
  readonly overviewUrl: string;
}) {
  return (
    <header className="page-header image-question-header">
      <div>
        <nav aria-label="面包屑" className="breadcrumb">
          <span>{detail.breadcrumbLabel}</span>
          <span aria-hidden="true">/</span>
          <a href={overviewUrl}>课程与资料</a>
        </nav>
        <h1>{detail.title}</h1>
        <div className="image-question-header-meta">
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

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["image-question-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ImageQuestionContext({
  detail,
  onHubReturn,
}: {
  readonly detail: ImageQuestionUpload;
  readonly onHubReturn: () => void;
}) {
  return (
    <section className="image-question-context-panel" aria-labelledby="image-question-context-title">
      <div className="image-question-section-title">
        <h2 id="image-question-context-title">{detail.contextTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="image-question-context-list" rows={detail.contextRows} />
      <div className="image-question-context-foot">
        <p><Icon name="info" size={17} />{detail.contextNotice}</p>
        <button className="text-button" onClick={onHubReturn} type="button">
          {detail.contextActionLabel}
        </button>
      </div>
    </section>
  );
}

function ImageQuestionHero({
  detail,
  selectedFile,
}: {
  readonly detail: ImageQuestionUpload;
  readonly selectedFile: SelectedImageFile | null;
}) {
  const selectionStateLabel = selectedFile === null ? detail.selectionStateLabel : "已选择图片　·　1 / 1";
  return (
    <section className="image-question-hero" aria-labelledby="image-question-hero-title">
      <div className="image-question-hero-count" aria-label={`${detail.heroCountLabel} ${detail.heroTitle}`}>
        <strong>{detail.heroCountLabel}</strong>
      </div>
      <div>
        <h2 aria-label={`${detail.heroCountLabel} ${detail.heroTitle}`} id="image-question-hero-title">{detail.heroTitle}</h2>
        <p>{detail.heroDescription}</p>
        <p className="image-question-selection-label">{selectionStateLabel}</p>
      </div>
    </section>
  );
}

function ImageQuestionWorkflow({ detail, selectedFile, cropConfirmed }: {
  readonly detail: ImageQuestionUpload;
  readonly selectedFile: SelectedImageFile | null;
  readonly cropConfirmed: boolean;
}) {
  const currentStepId = selectedFile === null
    ? "SELECT"
    : cropConfirmed
      ? "UPLOAD"
      : "CROP";
  return (
    <ol className="image-question-workflow" aria-label="单题图片上传流程">
      {detail.workflowSteps.map((step) => {
        const completed =
          step.semanticKey === "SELECT" && selectedFile !== null ||
          step.semanticKey === "CROP" && cropConfirmed;
        const current = step.semanticKey === currentStepId;
        return (
          <li className={current ? "is-current" : completed ? "is-complete" : undefined} key={step.id}>
            <span aria-hidden="true">{step.ordinalLabel}</span>
            <strong>{step.title}</strong>
          </li>
        );
      })}
    </ol>
  );
}

function ImageSelector({
  detail,
  errorMessage,
  fileInputId,
  inputRef,
  onClear,
  onFileChange,
  selectedFile,
}: {
  readonly detail: ImageQuestionUpload;
  readonly errorMessage: string | null;
  readonly fileInputId: string;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onClear: () => void;
  readonly onFileChange: (files: FileList | null) => void;
  readonly selectedFile: SelectedImageFile | null;
}) {
  function openFileDialog(): void {
    inputRef.current?.click();
  }

  return (
    <section className={selectedFile === null ? "image-question-selector" : "image-question-selector has-file"} aria-labelledby="image-selector-title">
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="选择单题图片文件"
        aria-describedby={`${fileInputId}-rules`}
        className="sr-only"
        id={fileInputId}
        onChange={(event) => { onFileChange(event.currentTarget.files); }}
        ref={inputRef}
        type="file"
      />
      <div className="image-question-selector-art" aria-hidden="true">
        <Icon name="fileText" size={72} />
      </div>
      <div className="image-question-selector-copy">
        <h2 id="image-selector-title">{selectedFile === null ? detail.selectorTitle : "已选择单题图片"}</h2>
        <p>{selectedFile === null ? detail.selectorDescription : `${selectedFile.name} · ${formatImageSize(selectedFile.sizeBytes)} · ${selectedFile.extension}`}</p>
      </div>
      <div className="image-question-selector-actions">
        <button className="primary-button" onClick={openFileDialog} type="button">
          {selectedFile === null ? detail.chooseButtonLabel : detail.replaceButtonLabel}
        </button>
        <button className="secondary-button" onClick={openFileDialog} type="button">
          {detail.captureButtonLabel}
        </button>
        {selectedFile === null ? null : (
          <button className="text-button" onClick={onClear} type="button">
            {detail.clearButtonLabel}
          </button>
        )}
      </div>
      <p className="image-question-selector-rules" id={`${fileInputId}-rules`}>
        {detail.acceptedFormatsLabel}　·　{detail.qualityHint}
      </p>
      <p className={errorMessage === null ? "image-question-error" : "image-question-error is-visible"} role="alert">
        {errorMessage ?? " "}
      </p>
    </section>
  );
}

function buildImageChecks({
  cropConfirmed,
  rows,
  selectedFile,
}: {
  readonly cropConfirmed: boolean;
  readonly rows: readonly ImageQuestionCheckRow[];
  readonly selectedFile: SelectedImageFile | null;
}): readonly ImageQuestionCheckRow[] {
  return rows.map((row) => {
    if (row.id.endsWith("-single")) {
      return { ...row, completed: selectedFile !== null, value: selectedFile === null ? "待确认" : "已选 1 张" };
    }
    if (row.id.endsWith("-border") || row.id.endsWith("-clear") || row.id.endsWith("-privacy")) {
      return { ...row, completed: cropConfirmed, value: cropConfirmed ? "已确认" : "待确认" };
    }
    return row;
  });
}

function CropReview({
  checks,
  detail,
  onCropConfirm,
  selectedFile,
}: {
  readonly checks: readonly ImageQuestionCheckRow[];
  readonly detail: ImageQuestionUpload;
  readonly onCropConfirm: () => void;
  readonly selectedFile: SelectedImageFile | null;
}) {
  return (
    <section className="image-question-crop-review" aria-labelledby="image-crop-review-title">
      <div className="image-question-section-title">
        <h2 id="image-crop-review-title">{detail.cropTitle}</h2>
        <span aria-hidden="true" />
      </div>
      <p>{detail.cropDescription}</p>
      <dl>
        {checks.map((row) => (
          <div key={row.id}>
            <dt>{row.label}</dt>
            <dd>
              {row.value}
              <span aria-label={row.completed ? "已完成" : "未完成"}>
                {row.completed ? <Icon name="check" size={15} /> : null}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <button className="secondary-button" disabled={selectedFile === null} onClick={onCropConfirm} type="button">
        {detail.cropConfirmLabel}
      </button>
    </section>
  );
}

function UploadAction({
  cropConfirmed,
  detail,
  onKnowledgeReturn,
  onSubmit,
  onTextModeOpen,
  selectedFile,
  submitMessage,
}: {
  readonly cropConfirmed: boolean;
  readonly detail: ImageQuestionUpload;
  readonly onKnowledgeReturn: () => void;
  readonly onSubmit: () => void;
  readonly onTextModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly selectedFile: SelectedImageFile | null;
  readonly submitMessage: string | null;
}) {
  const canUpload = selectedFile !== null && cropConfirmed && submitMessage === null;
  return (
    <section className="image-question-action-panel" aria-labelledby="image-question-action-title">
      <div className="image-question-section-title">
        <h2 id="image-question-action-title">操作</h2>
        <span aria-hidden="true" />
      </div>
      <button className="primary-button" disabled={!canUpload} onClick={onSubmit} type="button">
        {detail.uploadButtonLabel}
      </button>
      <p aria-live="polite">{submitMessage ?? (canUpload ? detail.uploadReadyHint : detail.uploadDisabledHint)}</p>
      <div className="image-question-secondary-actions">
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
        <button className="secondary-button" onClick={onKnowledgeReturn} type="button">
          {detail.returnKnowledgeLabel}
        </button>
      </div>
    </section>
  );
}

function buildCurrentFileRows({
  cropConfirmed,
  detail,
  selectedFile,
}: {
  readonly cropConfirmed: boolean;
  readonly detail: ImageQuestionUpload;
  readonly selectedFile: SelectedImageFile | null;
}): readonly DefinitionRow[] {
  return detail.currentFileRows.map((row) => {
    if (row.id.endsWith("-name")) {
      return { ...row, value: selectedFile?.name ?? "—" };
    }
    if (row.id.endsWith("-size")) {
      return { ...row, value: selectedFile === null ? "—" : formatImageSize(selectedFile.sizeBytes) };
    }
    if (row.id.endsWith("-format")) {
      return { ...row, value: selectedFile?.extension ?? "—" };
    }
    if (row.id.endsWith("-scope")) {
      return { ...row, value: cropConfirmed ? "已确认" : "尚未确认" };
    }
    if (row.id.endsWith("-privacy")) {
      return { ...row, value: cropConfirmed ? "已完成" : "未完成" };
    }
    return row;
  });
}

function buildUploadStatusRows({
  cropConfirmed,
  detail,
  selectedFile,
  submitMessage,
}: {
  readonly cropConfirmed: boolean;
  readonly detail: ImageQuestionUpload;
  readonly selectedFile: SelectedImageFile | null;
  readonly submitMessage: string | null;
}): readonly DefinitionRow[] {
  return detail.uploadStatusRows.map((row) => {
    if (row.id.endsWith("-selected")) {
      return { ...row, value: selectedFile === null ? "0 / 1" : "1 / 1" };
    }
    if (row.id.endsWith("-crop")) {
      return { ...row, value: cropConfirmed ? "已确认" : selectedFile === null ? "未创建" : "待确认" };
    }
    if (row.id.endsWith("-privacy")) {
      return { ...row, value: cropConfirmed ? "已完成" : "未完成" };
    }
    if (row.id.endsWith("-state")) {
      return { ...row, value: submitMessage === null ? "不可用" : "服务未接入" };
    }
    return row;
  });
}

function ImageQuestionRailSection({
  className,
  rows,
  title,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
  readonly title: string;
}) {
  const titleId = `image-question-rail-${useId().replaceAll(":", "")}`;
  return (
    <section className={["image-question-rail-section", className].filter(Boolean).join(" ")} aria-labelledby={titleId}>
      <div className="image-question-rail-title">
        <h2 id={titleId}>{title}</h2>
        <span aria-hidden="true" />
      </div>
      <DefinitionList className="image-question-rail-list" rows={rows} />
    </section>
  );
}

function ImageQuestionPrivacyRules({ detail }: { readonly detail: ImageQuestionUpload }) {
  return (
    <section className="image-question-privacy-panel" aria-labelledby="image-question-privacy-title">
      <h2 id="image-question-privacy-title">隐私规则</h2>
      <ul>
        {detail.privacyRules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}

function ImageQuestionNextStep({ detail }: { readonly detail: ImageQuestionUpload }) {
  return (
    <section className="image-question-next-step" aria-labelledby="image-question-next-step-title">
      <h2 id="image-question-next-step-title">下一步</h2>
      <ul>
        {detail.nextStepRows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </section>
  );
}

function ImageQuestionRightRail({
  detail,
  dynamicStatusRows,
}: {
  readonly detail: ImageQuestionUpload;
  readonly dynamicStatusRows: readonly DefinitionRow[];
}) {
  return (
    <aside className="right-rail image-question-rail" aria-label="单题图片上传辅助信息">
      <ImageQuestionRailSection rows={detail.railContextRows} title="当前上下文" />
      <ImageQuestionRailSection rows={dynamicStatusRows} title="上传状态" />
      <ImageQuestionRailSection rows={detail.fileRuleRows} title="文件规则" />
      <ImageQuestionPrivacyRules detail={detail} />
      <ImageQuestionNextStep detail={detail} />
      <ImageQuestionRailSection rows={detail.serviceRows} title="服务状态" />
      <p className="image-question-service-code">{detail.serviceCode}</p>
      <p className="image-question-rail-boundary">图片、OCR 文本与辅导记录仅在授权家庭范围内使用。</p>
    </aside>
  );
}

function ImageQuestionRailCompact({
  detail,
  dynamicStatusRows,
}: {
  readonly detail: ImageQuestionUpload;
  readonly dynamicStatusRows: readonly DefinitionRow[];
}) {
  return (
    <details className="right-rail-collapsible image-question-collapsible">
      <summary>
        <span>上下文、文件与隐私</span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <div className="right-rail-collapsible-content">
        <ImageQuestionRightRail detail={detail} dynamicStatusRows={dynamicStatusRows} />
      </div>
    </details>
  );
}

export interface ImageQuestionUploadRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateFootnote: string;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly knowledgePointId: string | null;
  readonly onHubReturn: () => void;
  readonly onKnowledgeReturn: () => void;
  readonly onTextModeOpen: (targetId: string, modeKind: QuestionModeKind) => void;
  readonly overviewUrl: string;
}

export function ImageQuestionUploadRoute({
  course,
  currentUser,
  dateFootnote,
  dateTime,
  demoActive,
  knowledgePointId,
  onHubReturn,
  onKnowledgeReturn,
  onTextModeOpen,
  overviewUrl,
}: ImageQuestionUploadRouteProps) {
  const detail = course.imageQuestionUploads?.find((item) => item.knowledgePointId === knowledgePointId) ??
    (knowledgePointId === null ? course.imageQuestionUploads?.[0] : undefined);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<SelectedImageFile | null>(null);
  const [cropConfirmed, setCropConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const fileInputId = useId();

  const dynamicChecks = useMemo(
    () => detail === undefined
      ? []
      : buildImageChecks({ cropConfirmed, rows: detail.imageCheckRows, selectedFile }),
    [cropConfirmed, detail, selectedFile],
  );
  const dynamicFileRows = useMemo(
    () => detail === undefined
      ? []
      : buildCurrentFileRows({ cropConfirmed, detail, selectedFile }),
    [cropConfirmed, detail, selectedFile],
  );
  const dynamicStatusRows = useMemo(
    () => detail === undefined
      ? []
      : buildUploadStatusRows({ cropConfirmed, detail, selectedFile, submitMessage }),
    [cropConfirmed, detail, selectedFile, submitMessage],
  );

  if (detail === undefined) {
    return (
      <ImageQuestionUploadServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程没有服务端单题图片文档；生产环境不会用开发 Fixture 补图片草稿、上传资产或 OCR 结果。"
        title="单题图片上传"
      />
    );
  }

  if (detail.status !== "EMPTY") {
    const copy = serviceStateCopy[detail.status];
    return (
      <ImageQuestionUploadServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle={copy.description}
        title={copy.title}
      />
    );
  }

  const activeDetail = detail;

  function handleFileChange(files: FileList | null): void {
    const file = files === null || files.length === 0 ? null : files[0] ?? null;
    if (file === null) {
      return;
    }
    const validationMessage = validateImageFile(file);
    if (validationMessage !== null) {
      setSelectedFile(null);
      setCropConfirmed(false);
      setSubmitMessage(null);
      setErrorMessage(validationMessage);
      return;
    }
    setSelectedFile(toSelectedImageFile(file));
    setCropConfirmed(false);
    setSubmitMessage(null);
    setErrorMessage(null);
  }

  function clearSelection(): void {
    setSelectedFile(null);
    setCropConfirmed(false);
    setSubmitMessage(null);
    setErrorMessage(null);
    if (inputRef.current !== null) {
      inputRef.current.value = "";
    }
  }

  function handleUpload(event?: SyntheticEvent): void {
    event?.preventDefault();
    if (selectedFile === null || !cropConfirmed) {
      return;
    }
    setSubmitMessage(activeDetail.uploadUnavailableMessage);
  }

  return (
    <div className="app-shell image-question-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="ai-tutor" currentUser={currentUser} demoActive={demoActive} />
      <ImageQuestionMobileMenu overviewUrl={overviewUrl} />

      <main className="paper-canvas image-question-canvas" id="main-content">
        <ImageQuestionPageHeader
          dateFootnote={dateFootnote}
          dateTime={dateTime}
          demoActive={demoActive}
          detail={activeDetail}
          overviewUrl={overviewUrl}
        />

        <div className="content-grid image-question-grid">
          <article className="main-column image-question-main" aria-label="单题图片上传">
            <ImageQuestionContext detail={activeDetail} onHubReturn={onHubReturn} />
            <ImageQuestionHero detail={activeDetail} selectedFile={selectedFile} />
            <ImageQuestionWorkflow
              cropConfirmed={cropConfirmed}
              detail={activeDetail}
              selectedFile={selectedFile}
            />

            <div className="image-question-upload-grid">
              <ImageSelector
                detail={activeDetail}
                errorMessage={errorMessage}
                fileInputId={fileInputId}
                inputRef={inputRef}
                onClear={clearSelection}
                onFileChange={handleFileChange}
                selectedFile={selectedFile}
              />
              <div className="image-question-side-panel">
                <CropReview
                  checks={dynamicChecks}
                  detail={activeDetail}
                  onCropConfirm={() => {
                    if (selectedFile !== null) {
                      setCropConfirmed(true);
                    }
                  }}
                  selectedFile={selectedFile}
                />
                <DefinitionList className="image-question-current-file" rows={dynamicFileRows} />
              </div>
            </div>

            <div className="image-question-lower-grid">
              <UploadAction
                cropConfirmed={cropConfirmed}
                detail={activeDetail}
                onKnowledgeReturn={onKnowledgeReturn}
                onSubmit={handleUpload}
                onTextModeOpen={onTextModeOpen}
                selectedFile={selectedFile}
                submitMessage={submitMessage}
              />
              <section className="image-question-fallback-panel" aria-labelledby="image-question-fallback-title">
                <h2 id="image-question-fallback-title">暂不上传也可以</h2>
                <p>你可以改用文字提问，继续当前点练习，或返回知识点。</p>
                <div>
                  <button
                    className="text-button"
                    disabled={activeDetail.textTargetId === null}
                    onClick={() => {
                      if (activeDetail.textTargetId !== null) {
                        onTextModeOpen(activeDetail.textTargetId, "TEXT");
                      }
                    }}
                    type="button"
                  >
                    {activeDetail.textModeLabel}
                    <Icon name="chevronRight" size={16} />
                  </button>
                  <button className="text-button" onClick={onKnowledgeReturn} type="button">
                    {activeDetail.returnKnowledgeLabel}
                    <Icon name="chevronRight" size={16} />
                  </button>
                  <button className="text-button" onClick={onHubReturn} type="button">
                    {activeDetail.returnHubLabel}
                    <Icon name="chevronRight" size={16} />
                  </button>
                </div>
              </section>
            </div>

            <p className="image-question-source-boundary">{activeDetail.sourceBoundary}</p>
          </article>

          <ImageQuestionRightRail detail={activeDetail} dynamicStatusRows={dynamicStatusRows} />
          <ImageQuestionRailCompact detail={activeDetail} dynamicStatusRows={dynamicStatusRows} />
        </div>
      </main>
    </div>
  );
}

export interface ImageQuestionUploadServiceUnavailableProps {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}

export function ImageQuestionUploadServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: ImageQuestionUploadServiceUnavailableProps) {
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
          description="当前没有真实图片上传服务端文档；不会把开发 Fixture、本地文件选择、未确认范围或页面点击伪装成 questionDraft、asset、OCR 结果或 TutorSession。"
          title="单题图片上传服务暂时不可用"
        />
        <a className="secondary-button" href={overviewUrl}>返回课程与资料</a>
      </main>
    </div>
  );
}
