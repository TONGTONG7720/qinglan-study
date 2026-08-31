import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  StudentProfileDocument,
  StudentProfileSettingEntry,
  StudentProfileStatus,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

interface ProfileDraft {
  readonly displayName: string;
  readonly personalMotto: string;
}

type SaveState = "dirty" | "unknown";

const displayableStatuses: readonly StudentProfileStatus[] = [
  "NORMAL",
  "UNCONFIGURED",
  "SUSPECTED_ERROR_PENDING_REVIEW",
  "SAVE_SUCCESS",
  "SAVE_FAILURE",
  "CORRECTION_UNKNOWN",
  "DELETE_REQUEST_PENDING",
  "DELETE_REQUEST_FAILED",
  "OFFLINE_READONLY",
];

function isDisplayableProfile(document: StudentProfileDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function fieldValue(document: StudentProfileDocument, id: keyof ProfileDraft): string {
  return document.selfServiceFields.find((field) => field.id === id)?.value ?? "";
}

function SectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="student-profile-section-title">
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
    <dl className={["student-profile-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StudentProfileMobileMenu() {
  return (
    <details className="student-profile-mobile-menu">
      <summary aria-label="打开移动端个人资料导航">
        <span>
          <strong>清朗学习</strong>
          <small>个人资料</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端个人资料功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <span aria-current="page">个人资料</span>
      </nav>
    </details>
  );
}

function StudentProfileHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: StudentProfileDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.loadStatusLabel} · `;
  const statusDetail = document.loadedAtLabel.startsWith(statusPrefix)
    ? document.loadedAtLabel.slice(statusPrefix.length)
    : document.loadedAtLabel;

  return (
    <header className="page-header student-profile-header">
      <div>
        <nav aria-label="面包屑" className="student-profile-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="student-profile-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date student-profile-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.loadedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.loadStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function SelfServiceForm({
  document,
}: {
  readonly document: StudentProfileDocument;
}) {
  const [draft, setDraft] = useState<ProfileDraft>({
    displayName: fieldValue(document, "displayName"),
    personalMotto: fieldValue(document, "personalMotto"),
  });
  const [saveState, setSaveState] = useState<SaveState>("dirty");
  const saveMessage = saveState === "unknown"
    ? document.saveOperationUnknownMessage
    : document.selfServiceStatusLabel;

  return (
    <section aria-labelledby="student-profile-self-service-title" className="student-profile-self-service">
      <div className="student-profile-avatar-block">
        <div aria-label={`${document.avatarGlyph}，${document.avatarCaption}`} className="student-profile-avatar">
          {document.avatarGlyph}
        </div>
        <span>{document.avatarCaption}</span>
      </div>
      <form
        aria-describedby="student-profile-save-state"
        className="student-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaveState("unknown");
        }}
      >
        <SectionTitle id="student-profile-self-service-title" title={document.selfServiceTitle} />
        {document.selfServiceFields.map((field) => {
          const value = draft[field.id];
          return (
            <label className="student-profile-field" key={field.id}>
              <span>{field.label}</span>
              <input
                maxLength={field.maxLength}
                name={field.id}
                value={value}
                onChange={(event) => {
                  const nextValue = event.currentTarget.value;
                  setDraft((previous) => ({ ...previous, [field.id]: nextValue }));
                  setSaveState("dirty");
                }}
              />
              <small>
                {field.helperText}
                {field.id === "personalMotto" ? <em>{value.length} / {field.maxLength}</em> : null}
              </small>
            </label>
          );
        })}
        <p aria-live="polite" className={saveState === "unknown" ? "student-profile-save-state is-unknown" : "student-profile-save-state"} id="student-profile-save-state">
          {saveMessage}
        </p>
        <button className="student-profile-primary" type="submit">
          {saveState === "unknown" ? "查询保存结果" : document.saveActionLabel}
          <Icon name="arrowRight" size={16} />
        </button>
      </form>
    </section>
  );
}

function ControlledFacts({ document }: { readonly document: StudentProfileDocument }) {
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionUnknown, setCorrectionUnknown] = useState(false);

  return (
    <section aria-labelledby="student-profile-controlled-title" className="student-profile-controlled">
      <SectionTitle id="student-profile-controlled-title" title={document.controlledTitle} />
      <DefinitionList rows={document.controlledRows} />
      <p>{document.controlledPermissionNotice}</p>
      <div className="student-profile-correction">
        <button
          aria-expanded={correctionOpen}
          className="student-profile-secondary"
          type="button"
          onClick={() => {
            setCorrectionOpen((open) => !open);
          }}
        >
          {document.correctionActionLabel}
        </button>
        {correctionOpen ? (
          <section aria-labelledby="student-profile-correction-title" className="student-profile-correction-panel">
            <h3 id="student-profile-correction-title">{document.correctionTitle}</h3>
            <p>{document.correctionDescription}</p>
            <label>
              <span>说明</span>
              <textarea defaultValue="年级或教材状态与实际不符，请协助核对。" rows={3} />
            </label>
            <button
              type="button"
              onClick={() => {
                setCorrectionUnknown(true);
              }}
            >
              提交纠错请求
            </button>
            {correctionUnknown ? <p aria-live="polite">{document.correctionUnknownMessage}</p> : null}
          </section>
        ) : null}
      </div>
    </section>
  );
}

function SettingsEntry({
  entry,
  onBoundary,
}: {
  readonly entry: StudentProfileSettingEntry;
  readonly onBoundary: (message: string) => void;
}) {
  const iconName = entry.id === "TEXTBOOKS"
    ? "bookOpen"
    : entry.id === "STUDY_TIME"
      ? "clock"
      : "userRound";
  return (
    <button
      className="student-profile-setting-row"
      type="button"
      onClick={() => {
        onBoundary(entry.boundaryMessage);
      }}
    >
      <Icon name={iconName} size={24} />
      <span>
        <strong>{entry.title}</strong>
        <small>{entry.summary}</small>
      </span>
      <em>{entry.statusLabel}</em>
      <b>
        {entry.actionLabel}
        <Icon name="arrowRight" size={16} />
      </b>
    </button>
  );
}

function SettingsAndActions({ document }: { readonly document: StudentProfileDocument }) {
  const [boundary, setBoundary] = useState<string | null>(null);

  return (
    <section aria-labelledby="student-profile-settings-title" className="student-profile-settings">
      <SectionTitle id="student-profile-settings-title" title={document.settingsTitle} />
      <div className="student-profile-setting-list">
        {document.settings.map((entry) => (
          <SettingsEntry entry={entry} key={entry.id} onBoundary={setBoundary} />
        ))}
      </div>
      <div className="student-profile-account-actions">
        {document.accountActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              setBoundary(action.boundaryMessage);
            }}
          >
            <Icon name={action.id.includes("security") ? "lock" : "monitor"} size={20} />
            {action.title}
            <Icon name="arrowRight" size={16} />
          </button>
        ))}
        <p>{document.accountActionsNotice}</p>
      </div>
      {boundary === null ? null : (
        <p aria-live="polite" className="student-profile-setting-boundary">{boundary}</p>
      )}
    </section>
  );
}

function StudentProfileRightRail({ document }: { readonly document: StudentProfileDocument }) {
  return (
    <aside aria-label="学生个人资料辅助信息" className="student-profile-right-rail">
      <SectionTitle id="student-profile-account-status-title" title="账号状态" />
      <DefinitionList rows={document.accountStatusRows} />
      <SectionTitle id="student-profile-field-permission-title" title="字段权限" />
      <DefinitionList rows={document.fieldPermissionRows} />
      <SectionTitle id="student-profile-configuration-title" title="配置状态" />
      <DefinitionList rows={document.configurationRows} />
      <SectionTitle id="student-profile-privacy-title" title="服务与隐私" />
      <DefinitionList rows={document.privacyRows} />
    </aside>
  );
}

function StudentProfileRailCompact({ document }: { readonly document: StudentProfileDocument }) {
  return (
    <details className="student-profile-rail-compact">
      <summary>查看账号状态、字段权限、配置状态与隐私</summary>
      <div>
        <SectionTitle id="student-profile-compact-account-status-title" title="账号状态" />
        <DefinitionList rows={document.accountStatusRows} />
        <SectionTitle id="student-profile-compact-field-permission-title" title="字段权限" />
        <DefinitionList rows={document.fieldPermissionRows} />
        <SectionTitle id="student-profile-compact-configuration-title" title="配置状态" />
        <DefinitionList rows={document.configurationRows} />
        <SectionTitle id="student-profile-compact-privacy-title" title="服务与隐私" />
        <DefinitionList rows={document.privacyRows} />
      </div>
    </details>
  );
}

function StudentProfileReady({
  currentUser,
  dateTime,
  demoActive,
  document,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: StudentProfileDocument;
}) {
  const sourceBoundary = demoActive ? document.sourceBoundary : undefined;

  return (
    <div className="app-shell student-profile-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <StudentProfileMobileMenu />
      <main className="paper-canvas student-profile-canvas" id="main-content">
        <StudentProfileHeader dateTime={dateTime} document={document} />
        <div className="student-profile-grid">
          <article aria-label="学生个人资料" className="student-profile-main">
            <SelfServiceForm document={document} />
            <ControlledFacts document={document} />
            <SettingsAndActions document={document} />
            {sourceBoundary === undefined ? null : <p className="student-profile-source-boundary">{sourceBoundary}</p>}
          </article>
          <span aria-hidden="true" className="student-profile-rail-divider" />
          <StudentProfileRightRail document={document} />
          <StudentProfileRailCompact document={document} />
        </div>
      </main>
    </div>
  );
}

function StudentProfileUnavailableSurface({
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
    <div className="app-shell student-profile-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <main className="paper-canvas service-state-page student-profile-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="STUDENT_PROFILE_UNAVAILABLE：当前不会展示虚构姓名、展示称呼、个人签名、年级、角色、学科、教材状态、学习时间、家庭关系、纠错请求或数据操作状态。"
          title="学生个人资料服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

function StudentProfileLoadingSurface({
  currentUser,
  demoActive,
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive: boolean;
}) {
  return (
    <div className="app-shell student-profile-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <main className="paper-canvas student-profile-canvas" id="main-content">
        <div aria-label="正在加载学生个人资料" className="page-loading student-profile-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

export interface StudentProfileRouteProps {
  readonly course: CourseSummary;
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly overviewUrl: string;
  readonly targetId: string | null;
}

export function StudentProfileRoute({
  course,
  currentUser,
  dateTime,
  demoActive,
  overviewUrl,
  targetId,
}: StudentProfileRouteProps) {
  const document = useMemo(() => {
    if (targetId !== null) {
      return course.studentProfiles?.find((item) => item.targetId === targetId);
    }
    return course.studentProfiles?.[0];
  }, [course.studentProfiles, targetId]);

  if (document === undefined) {
    return (
      <StudentProfileServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-031 学生个人资料文档；生产环境不会用开发 Fixture 补姓名、签名、年级、学科、教材状态或纠错请求。"
        title="学生个人资料"
      />
    );
  }

  if (document.status === "LOADING") {
    return <StudentProfileLoadingSurface currentUser={currentUser} demoActive={demoActive} />;
  }

  if (!isDisplayableProfile(document)) {
    return (
      <StudentProfileServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="学生个人资料不可用；当前不会回退到 Fixture，也不会把正式姓名、年级、角色、学科或教材状态伪装成可自助修改字段。"
        title="学生个人资料"
      />
    );
  }

  return (
    <StudentProfileReady
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
    />
  );
}

export function StudentProfileServiceUnavailable({
  currentUser,
  demoActive = false,
  overviewUrl,
  subtitle = "生产环境没有可用的学生个人资料服务时，页面只显示服务边界，不打包开发 Fixture。",
  title = "学生个人资料",
}: {
  readonly currentUser: CurrentUserResult;
  readonly demoActive?: boolean;
  readonly overviewUrl: string;
  readonly subtitle?: string;
  readonly title?: string;
}) {
  return (
    <StudentProfileUnavailableSurface
      currentUser={currentUser}
      demoActive={demoActive}
      overviewUrl={overviewUrl}
      subtitle={subtitle}
      title={title}
    />
  );
}
