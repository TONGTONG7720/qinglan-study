import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  FamilyPrivateAssetDeletionState,
  FamilyPrivateAssetRow,
  FamilyPrivacyDocument,
  FamilyPrivacyDocumentStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

type DeletionMode = "idle" | "confirming" | "pending" | "unknown";

const displayableStatuses: readonly FamilyPrivacyDocumentStatus[] = [
  "RELATIONSHIP_READONLY",
  "ASSET_LIST_EMPTY",
  "ASSET_LIST_WITH_DATA",
  "DELETE_CONFIRMING",
  "DELETE_PENDING",
  "DELETE_COMPLETED",
  "DELETE_FAILED",
  "DELETE_UNKNOWN",
  "ACCOUNT_PROCESSING_REQUEST",
  "OFFLINE_READONLY",
];

function isDisplayableFamilyPrivacy(document: FamilyPrivacyDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function SectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="family-privacy-section-title">
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
    <dl className={["family-privacy-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function FamilyPrivacyMobileMenu() {
  return (
    <details className="family-privacy-mobile-menu">
      <summary aria-label="打开移动端家庭与隐私导航">
        <span>
          <strong>清朗学习</strong>
          <small>家庭与隐私</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端家庭与隐私功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <span aria-current="page">隐私与家庭隔离</span>
      </nav>
    </details>
  );
}

function FamilyPrivacyHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: FamilyPrivacyDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.updateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header family-privacy-header">
      <div>
        <nav aria-label="面包屑" className="family-privacy-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="family-privacy-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date family-privacy-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.updateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function RelationshipSummary({ document }: { readonly document: FamilyPrivacyDocument }) {
  return (
    <section aria-labelledby="family-privacy-relationship-title" className="family-privacy-relationship">
      <SectionTitle id="family-privacy-relationship-title" title={document.relationshipTitle} />
      <div className="family-privacy-relationship-grid">
        <div className="family-privacy-large-number" aria-label={`${document.largeNumber}${document.largeNumberCaption}`}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <div className="family-privacy-relationship-rows">
          {document.relationshipRows.map((row) => (
            <div key={row.id}>
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </div>
          ))}
        </div>
      </div>
      <p className="family-privacy-boundary">{document.relationshipBoundary}</p>
    </section>
  );
}

function VisibilityBoundary({ document }: { readonly document: FamilyPrivacyDocument }) {
  return (
    <section aria-labelledby="family-privacy-visibility-title" className="family-privacy-visibility">
      <SectionTitle id="family-privacy-visibility-title" title={document.visibilityTitle} />
      <div className="family-privacy-visibility-grid">
        <div>
          <h3>{document.familyVisibleTitle}</h3>
          <ul>
            {document.familyVisibleRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>{document.privateByDefaultTitle}</h3>
          <ul>
            {document.privateByDefaultRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="family-privacy-boundary">{document.visibilityBoundary}</p>
    </section>
  );
}

function deletionStateLabel(state: FamilyPrivateAssetDeletionState, selected: boolean, mode: DeletionMode): string {
  if (selected && mode === "pending") {
    return "删除处理中";
  }
  if (selected && mode === "unknown") {
    return "结果待查询";
  }
  if (state === "PENDING") {
    return "删除处理中";
  }
  if (state === "COMPLETED") {
    return "已删除";
  }
  if (state === "FAILED") {
    return "删除失败";
  }
  if (state === "UNKNOWN") {
    return "结果待查询";
  }
  return "可删除";
}

function PrivateAssetList({
  deletionMode,
  document,
  selectedAssetId,
  onDelete,
}: {
  readonly deletionMode: DeletionMode;
  readonly document: FamilyPrivacyDocument;
  readonly selectedAssetId: string | null;
  readonly onDelete: (assetId: string) => void;
}) {
  return (
    <table className="family-privacy-asset-table">
      <caption>{document.privateDataTitle}</caption>
      <thead>
        <tr>
          <th scope="col">数据</th>
          <th scope="col">类型</th>
          <th scope="col">创建时间</th>
          <th scope="col">使用位置</th>
          <th scope="col">状态</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>
        {document.privateAssets.map((asset) => {
          const selected = selectedAssetId === asset.assetId;
          const stateLabel = deletionStateLabel(asset.deletionState, selected, deletionMode);
          return (
            <tr key={asset.id}>
              <td data-label="数据">
                <strong>{asset.name}</strong>
              </td>
              <td data-label="类型">{asset.typeLabel}</td>
              <td data-label="创建时间">{asset.createdAtLabel}</td>
              <td data-label="使用位置">{asset.usageLabel}</td>
              <td data-label="状态">
                <span className={selected && deletionMode !== "idle" ? "family-privacy-asset-state is-active" : "family-privacy-asset-state"}>
                  {selected && deletionMode !== "idle" ? stateLabel : asset.visibilityLabel}
                </span>
              </td>
              <td data-label="操作">
                <button
                  aria-label={`${asset.deleteActionLabel}${asset.name}`}
                  className="family-privacy-delete-button"
                  disabled={selected && deletionMode === "pending"}
                  type="button"
                  onClick={() => {
                    onDelete(asset.assetId);
                  }}
                >
                  {asset.deleteActionLabel}
                  <Icon name="arrowRight" size={14} />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AssetDeletionPanel({
  asset,
  mode,
  onCancel,
  onConfirm,
  onQueryOriginalOperation,
}: {
  readonly asset: FamilyPrivateAssetRow | undefined;
  readonly mode: DeletionMode;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly onQueryOriginalOperation: () => void;
}) {
  if (asset === undefined || mode === "idle") {
    return null;
  }

  if (mode === "confirming") {
    return (
      <section
        aria-labelledby="family-privacy-delete-confirm-title"
        aria-describedby="family-privacy-delete-confirm-description"
        className="family-privacy-delete-panel"
        role="dialog"
        aria-modal="false"
      >
        <h3 id="family-privacy-delete-confirm-title">{asset.confirmTitle}</h3>
        <p id="family-privacy-delete-confirm-description">{asset.confirmDescription}</p>
        <ul>
          {asset.confirmItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <div>
          <button type="button" onClick={onConfirm}>确认提交删除请求</button>
          <button type="button" onClick={onCancel}>取消</button>
        </div>
      </section>
    );
  }

  if (mode === "pending") {
    return (
      <section aria-live="polite" className="family-privacy-delete-panel is-pending">
        <h3>删除请求处理中</h3>
        <p>{asset.pendingMessage}</p>
        <button type="button" onClick={onQueryOriginalOperation}>查询原 operation</button>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="family-privacy-delete-panel is-unknown">
      <h3>删除结果待查询</h3>
      <p>{asset.unknownMessage}</p>
      <button type="button" onClick={onCancel}>返回列表状态</button>
    </section>
  );
}

function pendingSummary(document: FamilyPrivacyDocument, deletionMode: DeletionMode): string {
  if (deletionMode === "pending") {
    return document.privateDataSummary.replace("处理中 0", "处理中 1");
  }
  return document.privateDataSummary;
}

function railPrivateDataRows(document: FamilyPrivacyDocument, deletionMode: DeletionMode): readonly DefinitionRow[] {
  if (deletionMode !== "pending") {
    return document.privateDataRows;
  }
  return document.privateDataRows.map((row) => (
    row.label === "删除处理中" ? { ...row, value: "1" } : row
  ));
}

function PrivateDataSection({
  deletionMode,
  document,
  selectedAsset,
  selectedAssetId,
  onCancelDeletion,
  onConfirmDeletion,
  onDeleteAsset,
  onQueryOriginalOperation,
}: {
  readonly deletionMode: DeletionMode;
  readonly document: FamilyPrivacyDocument;
  readonly selectedAsset: FamilyPrivateAssetRow | undefined;
  readonly selectedAssetId: string | null;
  readonly onCancelDeletion: () => void;
  readonly onConfirmDeletion: () => void;
  readonly onDeleteAsset: (assetId: string) => void;
  readonly onQueryOriginalOperation: () => void;
}) {
  return (
    <section aria-labelledby="family-privacy-private-data-title" className="family-privacy-private-data">
      <SectionTitle id="family-privacy-private-data-title" title={document.privateDataTitle} />
      {document.privateAssets.length === 0 ? (
        <p className="family-privacy-empty">当前没有可管理的本人私密资产；页面不会制造题图或会话记录。</p>
      ) : (
        <PrivateAssetList
          deletionMode={deletionMode}
          document={document}
          selectedAssetId={selectedAssetId}
          onDelete={onDeleteAsset}
        />
      )}
      <p className="family-privacy-private-summary">{pendingSummary(document, deletionMode)}</p>
      <p className="family-privacy-delete-notice">{document.deleteNotice}</p>
      <AssetDeletionPanel
        asset={selectedAsset}
        mode={deletionMode}
        onCancel={onCancelDeletion}
        onConfirm={onConfirmDeletion}
        onQueryOriginalOperation={onQueryOriginalOperation}
      />
    </section>
  );
}

function DataProcessingSection({
  document,
}: {
  readonly document: FamilyPrivacyDocument;
}) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestUnknown, setRequestUnknown] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <section aria-labelledby="family-privacy-data-processing-title" className="family-privacy-data-processing">
      <SectionTitle id="family-privacy-data-processing-title" title={document.dataProcessingTitle} />
      <p>{document.dataProcessingDescription}</p>
      <div className="family-privacy-actions" aria-label="本人数据处理操作">
        <button
          type="button"
          onClick={() => {
            setRequestOpen(true);
            setRequestUnknown(false);
          }}
        >
          {document.manageDataActionLabel}
          <Icon name="arrowRight" size={16} />
        </button>
        <Link to={document.backUrl}>{document.backActionLabel}</Link>
        <button
          type="button"
          onClick={() => {
            setPrivacyOpen((open) => !open);
          }}
        >
          {document.privacyExplanationActionLabel}
        </button>
      </div>
      <p className="family-privacy-account-boundary">{document.accountBoundary}</p>
      {requestOpen ? (
        <section aria-labelledby="family-privacy-request-title" className="family-privacy-request-panel">
          <h3 id="family-privacy-request-title">{document.manageDataRequestTitle}</h3>
          <p>{document.manageDataRequestDescription}</p>
          <ul>
            {document.manageDataRequestRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setRequestUnknown(true);
            }}
          >
            查询请求状态
          </button>
          {requestUnknown ? <p aria-live="polite">{document.accountRequestUnknownMessage}</p> : null}
        </section>
      ) : null}
      {privacyOpen ? (
        <p aria-live="polite" className="family-privacy-explanation">
          隐私说明：家庭端只读取聚合与最小必要学习支持信息；完整 AI 对话、私人题图、原始作答和未授权个人说明默认不向家庭展示。
        </p>
      ) : null}
    </section>
  );
}

function FamilyPrivacyRightRail({
  deletionMode,
  document,
}: {
  readonly deletionMode: DeletionMode;
  readonly document: FamilyPrivacyDocument;
}) {
  return (
    <aside aria-label="家庭与隐私辅助信息" className="family-privacy-right-rail">
      <SectionTitle id="family-privacy-status-title" title="关系状态" />
      <DefinitionList rows={document.relationStatusRows} />
      <SectionTitle id="family-privacy-data-title" title="私密数据" />
      <DefinitionList rows={railPrivateDataRows(document, deletionMode)} />
      <SectionTitle id="family-privacy-deletion-rules-title" title="删除规则" />
      <ul>
        {document.deletionRuleRows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <SectionTitle id="family-privacy-security-title" title="服务与安全" />
      <ul>
        {document.securityRows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
    </aside>
  );
}

function FamilyPrivacyCompactRail({
  deletionMode,
  document,
}: {
  readonly deletionMode: DeletionMode;
  readonly document: FamilyPrivacyDocument;
}) {
  return (
    <details className="family-privacy-rail-compact">
      <summary>查看关系状态、私密数据、删除规则与安全</summary>
      <div>
        <SectionTitle id="family-privacy-compact-status-title" title="关系状态" />
        <DefinitionList rows={document.relationStatusRows} />
        <SectionTitle id="family-privacy-compact-data-title" title="私密数据" />
        <DefinitionList rows={railPrivateDataRows(document, deletionMode)} />
        <SectionTitle id="family-privacy-compact-deletion-rules-title" title="删除规则" />
        <ul>
          {document.deletionRuleRows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
        <SectionTitle id="family-privacy-compact-security-title" title="服务与安全" />
        <ul>
          {document.securityRows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function FamilyPrivacyReady({
  currentUser,
  dateTime,
  demoActive,
  document,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: FamilyPrivacyDocument;
}) {
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [deletionMode, setDeletionMode] = useState<DeletionMode>("idle");
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;
  const selectedAsset = useMemo(() => {
    if (selectedAssetId === null) {
      return undefined;
    }
    return document.privateAssets.find((asset) => asset.assetId === selectedAssetId);
  }, [document.privateAssets, selectedAssetId]);

  function startDeletion(assetId: string) {
    setSelectedAssetId(assetId);
    setDeletionMode("confirming");
  }

  function cancelDeletion() {
    setSelectedAssetId(null);
    setDeletionMode("idle");
  }

  return (
    <div className="app-shell family-privacy-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="family-privacy" currentUser={currentUser} demoActive={demoActive} />
      <FamilyPrivacyMobileMenu />
      <main className="paper-canvas family-privacy-canvas" id="main-content">
        <FamilyPrivacyHeader dateTime={dateTime} document={document} />
        <div className="family-privacy-grid">
          <article aria-label="家庭与隐私" className="family-privacy-main">
            <RelationshipSummary document={document} />
            <VisibilityBoundary document={document} />
            <PrivateDataSection
              deletionMode={deletionMode}
              document={document}
              selectedAsset={selectedAsset}
              selectedAssetId={selectedAssetId}
              onCancelDeletion={cancelDeletion}
              onConfirmDeletion={() => {
                setDeletionMode("pending");
              }}
              onDeleteAsset={startDeletion}
              onQueryOriginalOperation={() => {
                setDeletionMode("unknown");
              }}
            />
            <DataProcessingSection document={document} />
            {sourceBoundary === undefined ? null : <p className="family-privacy-source-boundary">{sourceBoundary}</p>}
            <FamilyPrivacyCompactRail deletionMode={deletionMode} document={document} />
          </article>
          <span aria-hidden="true" className="family-privacy-rail-divider" />
          <FamilyPrivacyRightRail deletionMode={deletionMode} document={document} />
        </div>
      </main>
    </div>
  );
}

function FamilyPrivacyLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell family-privacy-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="family-privacy" currentUser={currentUser} demoActive={demoActive} />
      <main className="paper-canvas family-privacy-canvas" id="main-content">
        <div aria-label="正在加载家庭与隐私" className="page-loading family-privacy-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export function FamilyPrivacyServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle,
  title,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle: string;
  readonly title: string;
}) {
  return (
    <div className="app-shell family-privacy-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="family-privacy" currentUser={currentUser} demoActive={demoActive} />
      <FamilyPrivacyMobileMenu />
      <main className="paper-canvas service-state-page family-privacy-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="FAMILY_PRIVACY_UNAVAILABLE：当前不会展示虚构家庭关系、成员信息、私题图片、辅导会话、删除 operation、本人数据请求或账号处理状态。"
          title="家庭与隐私服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export function FamilyPrivacyRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
}: {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}) {
  const document = useMemo(() => {
    if (targetId !== null) {
      return course.familyPrivacy?.find((item) => item.targetId === targetId);
    }
    return course.familyPrivacy?.[0];
  }, [course.familyPrivacy, targetId]);

  if (document === undefined) {
    return (
      <FamilyPrivacyServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-034 家庭与隐私文档；不会回退到示例家庭关系、assetId、会话或删除 operation。"
        title="家庭与隐私"
      />
    );
  }

  if (document.status === "LOADING") {
    return <FamilyPrivacyLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableFamilyPrivacy(document)) {
    return (
      <FamilyPrivacyServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="家庭与隐私设置不可用；当前不会回退到 Fixture，也不会泄露成员关系、资产存在性或账号处理结果。"
        title="家庭与隐私"
      />
    );
  }

  return (
    <FamilyPrivacyReady
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}
