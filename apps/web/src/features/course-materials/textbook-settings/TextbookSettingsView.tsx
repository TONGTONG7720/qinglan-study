import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  TextbookSettingsActionKind,
  TextbookSettingsDocument,
  TextbookSettingsDocumentStatus,
  TextbookSettingsSubjectRow,
  TextbookVerificationMaterial,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly TextbookSettingsDocumentStatus[] = [
  "MIXED_STATUS",
  "ALL_CONFIRMED",
  "GENERIC_GUIDANCE",
  "PENDING_VERIFICATION",
  "RETURNED_UNCLEAR",
  "UPLOADING",
  "SAVE_FAILURE",
  "OFFLINE_PENDING_NOT_UPLOADED",
];

function isDisplayableTextbookSettings(document: TextbookSettingsDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function SectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="textbook-settings-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
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
    <dl className={["textbook-settings-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TextbookSettingsMobileMenu() {
  return (
    <details className="textbook-settings-mobile-menu">
      <summary aria-label="打开移动端教材设置导航">
        <span>
          <strong>清朗学习</strong>
          <small>教材设置</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端教材设置功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <span aria-current="page">教材设置</span>
      </nav>
    </details>
  );
}

function TextbookSettingsHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: TextbookSettingsDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.updateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header textbook-settings-header">
      <div>
        <nav aria-label="面包屑" className="textbook-settings-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="textbook-settings-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date textbook-settings-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.updateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function TextbookStatusSummary({ document }: { readonly document: TextbookSettingsDocument }) {
  return (
    <section aria-labelledby="textbook-settings-summary-title" className="textbook-settings-summary">
      <SectionTitle id="textbook-settings-summary-title" title="启用学科" />
      <div className="textbook-settings-summary-grid">
        <div className="textbook-settings-large-number" aria-label={`${document.enabledSubjectCount}${document.enabledSubjectCaption}`}>
          <strong>{document.enabledSubjectCount}</strong>
          <span>{document.enabledSubjectCaption}</span>
        </div>
        <div className="textbook-settings-metrics" aria-label="教材状态数量">
          {document.metrics.map((metric) => (
            <div key={metric.id}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="textbook-settings-permission-notice">{document.permissionNotice}</p>
    </section>
  );
}

function MaterialsInlineList({
  materials,
}: {
  readonly materials: readonly TextbookVerificationMaterial[];
}) {
  if (materials.length === 0) {
    return <span>尚未提交核验材料</span>;
  }

  return (
    <ul className="textbook-settings-material-inline-list" aria-label="已提交材料">
      {materials.map((material) => (
        <li key={material.id}>
          <Icon name="fileText" size={16} />
          <span>{material.fileName}</span>
          <em>{material.uploadStatusLabel}</em>
        </li>
      ))}
    </ul>
  );
}

function TextbookStatusBadge({ row }: { readonly row: TextbookSettingsSubjectRow }) {
  return (
    <span className={`textbook-settings-status is-${row.status.toLowerCase()}`}>
      {row.statusLabel}
    </span>
  );
}

function actionIconName(kind: TextbookSettingsActionKind): "arrowRight" | "bookOpen" | "upload" {
  if (kind === "SUBMIT_MATERIALS") {
    return "upload";
  }
  if (kind === "VIEW_CONFIRMATION") {
    return "bookOpen";
  }
  return "arrowRight";
}

function TextbookSubjectTable({
  document,
  onAction,
  onRequirement,
}: {
  readonly document: TextbookSettingsDocument;
  readonly onAction: (row: TextbookSettingsSubjectRow, kind: TextbookSettingsActionKind) => void;
  readonly onRequirement: (row: TextbookSettingsSubjectRow) => void;
}) {
  return (
    <section aria-labelledby="textbook-settings-subjects-title" className="textbook-settings-subjects">
      <h2 className="visually-hidden" id="textbook-settings-subjects-title">学科教材状态列表</h2>
      <div className="textbook-settings-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">学科</th>
              <th scope="col">状态</th>
              <th scope="col">教材版本（候选）</th>
              <th scope="col">已提交材料 / 确认时间</th>
              <th scope="col">说明与范围</th>
              <th scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            {document.subjects.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.subjectLabel}</th>
                <td data-label="状态"><TextbookStatusBadge row={row} /></td>
                <td data-label="教材版本（候选）">{row.textbookLabel}</td>
                <td data-label="已提交材料 / 确认时间">
                  {row.materials.length > 0 ? (
                    <MaterialsInlineList materials={row.materials} />
                  ) : (
                    <span>{row.materialOrTimeLabel}</span>
                  )}
                  {row.materials.length > 0 ? <small>{row.materialOrTimeLabel}</small> : null}
                </td>
                <td data-label="说明与范围">
                  <span>{row.scopeLabel}</span>
                  <small>{row.note}</small>
                </td>
                <td data-label="操作">
                  <button
                    aria-label={`${row.subjectLabel} ${row.primaryActionLabel}`}
                    className={row.primaryActionKind === "SUBMIT_MATERIALS" ? "textbook-settings-row-action is-primary" : "textbook-settings-row-action"}
                    type="button"
                    onClick={() => {
                      onAction(row, row.primaryActionKind);
                    }}
                  >
                    {row.primaryActionLabel}
                    <Icon name={actionIconName(row.primaryActionKind)} size={16} />
                  </button>
                  {row.secondaryActionLabel === undefined ? null : (
                    <button
                      aria-label={`${row.subjectLabel} ${row.secondaryActionLabel}`}
                      className="textbook-settings-row-action is-secondary"
                      type="button"
                      onClick={() => {
                        onRequirement(row);
                      }}
                    >
                      {row.secondaryActionLabel}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="textbook-settings-footer-summary">{document.footerSummary}</p>
      <p className="textbook-settings-footer-notice">{document.footerNotice}</p>
    </section>
  );
}

function MaterialPurposeSection({ document }: { readonly document: TextbookSettingsDocument }) {
  return (
    <section aria-labelledby="textbook-settings-purpose-title" className="textbook-settings-purpose">
      <SectionTitle id="textbook-settings-purpose-title" title={document.materialPurposeTitle} />
      <DefinitionList rows={document.materialPurposeRows} />
    </section>
  );
}

function MaterialPanel({
  document,
  row,
}: {
  readonly document: TextbookSettingsDocument;
  readonly row: TextbookSettingsSubjectRow;
}) {
  return (
    <section aria-labelledby="textbook-settings-action-panel-title" className="textbook-settings-action-panel">
      <h3 id="textbook-settings-action-panel-title">{row.subjectLabel} · 已交材料</h3>
      <p>{document.materialPanelNotice}</p>
      <ul className="textbook-settings-material-panel-list">
        {row.materials.map((material) => (
          <li key={material.id}>
            <Icon name="fileText" size={18} />
            <span>
              <strong>{material.fileName}</strong>
              <small>{material.purposeLabel} · {material.fileSizeLabel} · {material.mimeLabel}</small>
            </span>
            <em>{material.uploadStatusLabel}</em>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConfirmationPanel({
  document,
  row,
}: {
  readonly document: TextbookSettingsDocument;
  readonly row: TextbookSettingsSubjectRow;
}) {
  return (
    <section aria-labelledby="textbook-settings-action-panel-title" className="textbook-settings-action-panel">
      <h3 id="textbook-settings-action-panel-title">{row.subjectLabel} · 确认信息</h3>
      <p>{document.confirmationPanelNotice}</p>
      <DefinitionList
        rows={[
          { id: `${row.id}-textbook`, label: "教材", value: row.textbookLabel },
          { id: `${row.id}-confirmed`, label: "确认时间", value: row.materialOrTimeLabel },
          { id: `${row.id}-scope`, label: "范围", value: row.scopeLabel },
        ]}
      />
    </section>
  );
}

function RequirementPanel({
  document,
  row,
}: {
  readonly document: TextbookSettingsDocument;
  readonly row: TextbookSettingsSubjectRow;
}) {
  return (
    <section aria-labelledby="textbook-settings-action-panel-title" className="textbook-settings-action-panel">
      <h3 id="textbook-settings-action-panel-title">{row.subjectLabel} · 材料要求</h3>
      <p>{row.note}</p>
      <ul>
        {document.materialRequirementRows.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function UploadPanel({
  document,
  row,
}: {
  readonly document: TextbookSettingsDocument;
  readonly row: TextbookSettingsSubjectRow;
}) {
  const [coverName, setCoverName] = useState<string | null>(null);
  const [catalogName, setCatalogName] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const readyToSubmit = coverName !== null && catalogName !== null;

  function updateFileName(files: FileList | null, update: (value: string | null) => void): void {
    update(files?.[0]?.name ?? null);
    setFeedback(null);
  }

  return (
    <section aria-labelledby="textbook-settings-action-panel-title" className="textbook-settings-action-panel">
      <h3 id="textbook-settings-action-panel-title">{row.subjectLabel} · {document.uploadPanelTitle}</h3>
      <p>{document.uploadPanelDescription}</p>
      <form
        className="textbook-settings-upload-form"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(document.verificationOperationUnknownMessage);
        }}
      >
        <label>
          <span>{document.uploadCoverLabel}</span>
          <input
            accept="image/jpeg,image/png"
            type="file"
            onChange={(event) => {
              updateFileName(event.currentTarget.files, setCoverName);
            }}
          />
          <small>{coverName ?? "尚未选择封面照片"}</small>
        </label>
        <label>
          <span>{document.uploadCatalogLabel}</span>
          <input
            accept="image/jpeg,image/png"
            type="file"
            onChange={(event) => {
              updateFileName(event.currentTarget.files, setCatalogName);
            }}
          />
          <small>{catalogName ?? "尚未选择目录页照片"}</small>
        </label>
        <ul>
          {document.uploadConstraintRows.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="textbook-settings-local-file-notice">{document.localFileNotice}</p>
        <button disabled={!readyToSubmit} type="submit">
          {document.submitVerificationLabel}
          <Icon name="arrowRight" size={16} />
        </button>
        {feedback === null ? null : <p aria-live="polite" className="textbook-settings-upload-feedback">{feedback}</p>}
      </form>
    </section>
  );
}

function TextbookActionPanel({
  actionKind,
  document,
  row,
}: {
  readonly actionKind: TextbookSettingsActionKind | "REQUIREMENTS";
  readonly document: TextbookSettingsDocument;
  readonly row: TextbookSettingsSubjectRow;
}) {
  if (actionKind === "SUBMIT_MATERIALS") {
    return <UploadPanel document={document} row={row} />;
  }
  if (actionKind === "VIEW_CONFIRMATION") {
    return <ConfirmationPanel document={document} row={row} />;
  }
  if (actionKind === "REQUIREMENTS") {
    return <RequirementPanel document={document} row={row} />;
  }
  return <MaterialPanel document={document} row={row} />;
}

function TextbookSettingsRightRail({ document }: { readonly document: TextbookSettingsDocument }) {
  return (
    <aside aria-label="教材设置辅助信息" className="textbook-settings-right-rail">
      <SectionTitle id="textbook-settings-status-title" title="状态概况" />
      <DefinitionList rows={document.statusOverviewRows} />
      <SectionTitle id="textbook-settings-rules-title" title="核验规则" />
      <ul>
        {document.verificationRuleRows.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <SectionTitle id="textbook-settings-requirements-title" title="材料要求" />
      <ul>
        {document.materialRequirementRows.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <SectionTitle id="textbook-settings-privacy-title" title="服务与隐私" />
      <DefinitionList rows={document.privacyRows} />
    </aside>
  );
}

function TextbookSettingsRailCompact({ document }: { readonly document: TextbookSettingsDocument }) {
  return (
    <details className="textbook-settings-rail-compact">
      <summary>查看状态概况、核验规则、材料要求与隐私</summary>
      <div>
        <SectionTitle id="textbook-settings-compact-status-title" title="状态概况" />
        <DefinitionList rows={document.statusOverviewRows} />
        <SectionTitle id="textbook-settings-compact-rules-title" title="核验规则" />
        <ul>
          {document.verificationRuleRows.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <SectionTitle id="textbook-settings-compact-requirements-title" title="材料要求" />
        <ul>
          {document.materialRequirementRows.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <SectionTitle id="textbook-settings-compact-privacy-title" title="服务与隐私" />
        <DefinitionList rows={document.privacyRows} />
      </div>
    </details>
  );
}

function TextbookSettingsReady({
  currentUser,
  dateTime,
  demoActive,
  document,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: TextbookSettingsDocument;
}) {
  const [activeRow, setActiveRow] = useState<TextbookSettingsSubjectRow | null>(null);
  const [activeAction, setActiveAction] = useState<TextbookSettingsActionKind | "REQUIREMENTS" | null>(null);
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  function openPanel(row: TextbookSettingsSubjectRow, actionKind: TextbookSettingsActionKind | "REQUIREMENTS"): void {
    setActiveRow(row);
    setActiveAction(actionKind);
  }

  return (
    <div className="app-shell textbook-settings-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <TextbookSettingsMobileMenu />
      <main className="paper-canvas textbook-settings-canvas" id="main-content">
        <TextbookSettingsHeader dateTime={dateTime} document={document} />
        <div className="textbook-settings-grid">
          <article aria-label="教材设置" className="textbook-settings-main">
            <TextbookStatusSummary document={document} />
            <TextbookSubjectTable
              document={document}
              onAction={openPanel}
              onRequirement={(row) => {
                openPanel(row, "REQUIREMENTS");
              }}
            />
            {activeRow === null || activeAction === null ? null : (
              <TextbookActionPanel actionKind={activeAction} document={document} row={activeRow} />
            )}
            <MaterialPurposeSection document={document} />
            {sourceBoundary === undefined ? null : <p className="textbook-settings-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="textbook-settings-rail-divider" />
          <TextbookSettingsRightRail document={document} />
          <TextbookSettingsRailCompact document={document} />
        </div>
      </main>
    </div>
  );
}

function TextbookSettingsUnavailableSurface({
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
    <div className="app-shell textbook-settings-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <main className="paper-canvas service-state-page textbook-settings-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="TEXTBOOK_SETTINGS_UNAVAILABLE：当前不会展示虚构教材版本、文件名、assetId、提交时间、已确认范围、核验状态或学生材料。"
          title="教材设置服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function TextbookSettingsLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell textbook-settings-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <main className="paper-canvas textbook-settings-canvas" id="main-content">
        <div aria-label="正在加载教材设置" className="page-loading textbook-settings-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface TextbookSettingsRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function TextbookSettingsRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
}: TextbookSettingsRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      return course.textbookSettings?.find((item) => item.targetId === targetId);
    }
    return course.textbookSettings?.[0];
  }, [course.textbookSettings, targetId]);

  if (document === undefined) {
    return (
      <TextbookSettingsServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-032 教材设置文档；生产环境不会用开发 Fixture 补教材、材料文件、assetId、核验状态或确认范围。"
        title="教材设置"
      />
    );
  }

  if (document.status === "LOADING") {
    return <TextbookSettingsLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableTextbookSettings(document)) {
    return (
      <TextbookSettingsServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="教材设置不可用；当前不会回退到 Fixture，也不会把候选教材、核验材料或确认状态伪装成服务端事实。"
        title="教材设置"
      />
    );
  }

  return (
    <TextbookSettingsReady
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function TextbookSettingsServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的教材设置服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "教材设置",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <TextbookSettingsUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
