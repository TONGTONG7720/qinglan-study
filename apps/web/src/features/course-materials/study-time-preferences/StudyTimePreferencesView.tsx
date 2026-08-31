import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import type {
  CourseSummary,
  DefinitionRow,
  StudyTimeOrderPolicy,
  StudyTimePreferencesDocument,
  StudyTimePreferencesDocumentStatus,
  StudyTimeScheduleGroup,
} from "../types";
import type { ShanghaiDateTime } from "../use-shanghai-date-time";

const displayableStatuses: readonly StudyTimePreferencesDocumentStatus[] = [
  "FIRST_DEFAULT",
  "CUSTOMIZED",
  "VALIDATION_ERROR",
  "SAVING",
  "SAVE_SUCCESS",
  "SAVE_FAILURE",
  "TODAY_TASK_CONFLICT",
  "VERSION_CONFLICT",
  "OFFLINE_DRAFT",
];

const timeOptions = ["09:00", "10:30", "11:00", "11:30", "12:00", "19:00", "20:00", "21:00"] as const;
const sessionDurationOptions = [20, 30, 40, 45] as const;
const reminderLeadOptions = [0, 5, 10, 15] as const;

type EditableScheduleGroup = Pick<StudyTimeScheduleGroup, "id" | "kind" | "label" | "daySetLabel" | "durationHint"> & {
  readonly startTime: string;
  readonly endTime: string;
};

function isDisplayableStudyTimePreferences(document: StudyTimePreferencesDocument): boolean {
  return displayableStatuses.includes(document.status);
}

function minutesFromTime(value: string): number {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour * 60 + minute;
}

function minutesWithSpaceLabel(minutes: number): string {
  return `${String(minutes)} 分钟`;
}

function minutesCompactLabel(minutes: number): string {
  return `${String(minutes)}分钟`;
}

function reminderStatusLabel(minutes: number): string {
  if (minutes === 0) {
    return "不提前提醒";
  }
  return `提前${String(minutes)}分钟`;
}

function reminderOptionLabel(minutes: number): string {
  if (minutes === 0) {
    return "不提前提醒";
  }
  return `开始前 ${String(minutes)} 分钟`;
}

function DefinitionList({
  className,
  rows,
}: {
  readonly className?: string;
  readonly rows: readonly DefinitionRow[];
}) {
  return (
    <dl className={["study-time-definition-list", className].filter(Boolean).join(" ")}>
      {rows.map((row) => (
        <div key={row.id}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SectionTitle({ id, title }: { readonly id: string; readonly title: string }) {
  return (
    <div className="study-time-section-title">
      <h2 id={id}>{title}</h2>
      <span aria-hidden="true" />
    </div>
  );
}

function StudyTimeMobileMenu() {
  return (
    <details className="study-time-mobile-menu">
      <summary aria-label="打开移动端学习时间偏好导航">
        <span>
          <strong>清朗学习</strong>
          <small>学习时间偏好</small>
        </span>
        <Icon name="chevronRight" size={18} />
      </summary>
      <nav aria-label="移动端学习时间偏好功能">
        <Link to="/student/today">今日学习</Link>
        <Link to="/student/learn">课程与资料</Link>
        <span aria-current="page">学习时间偏好</span>
      </nav>
    </details>
  );
}

function StudyTimeHeader({
  dateTime,
  document,
}: {
  readonly dateTime: ShanghaiDateTime;
  readonly document: StudyTimePreferencesDocument;
}) {
  const dateLabel = document.id.startsWith("demo-") ? "2026-08-29" : dateTime.date;
  const weekdayLabel = document.id.startsWith("demo-") ? "星期六" : dateTime.weekdayChinese;
  const statusPrefix = `${document.updateStatusLabel} · `;
  const statusDetail = document.updatedAtLabel.startsWith(statusPrefix)
    ? document.updatedAtLabel.slice(statusPrefix.length)
    : document.updatedAtLabel;

  return (
    <header className="page-header study-time-header">
      <div>
        <nav aria-label="面包屑" className="study-time-breadcrumb">
          <span>{document.breadcrumbLabel}</span>
        </nav>
        <div className="study-time-header-title">
          <h1>{document.title}</h1>
          <p>{document.subtitle}</p>
        </div>
      </div>
      <div className="page-date study-time-date" aria-label={`${dateLabel}，${weekdayLabel}，${document.updatedAtLabel}`}>
        <strong>{dateLabel}</strong>
        <span>{weekdayLabel}</span>
        <small><span>{document.updateStatusLabel}</span> · {statusDetail}</small>
      </div>
      <span className="page-header-rule" aria-hidden="true" />
    </header>
  );
}

function ScheduleGroupRow({
  group,
  onTimeChange,
}: {
  readonly group: EditableScheduleGroup;
  readonly onTimeChange: (id: string, field: "startTime" | "endTime", value: string) => void;
}) {
  return (
    <div className="study-time-schedule-row">
      <strong>{group.label}</strong>
      <span>{group.daySetLabel}</span>
      <label>
        <span>开始</span>
        <select
          aria-label={`${group.label}开始时间`}
          value={group.startTime}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onTimeChange(group.id, "startTime", event.target.value);
          }}
        >
          {timeOptions.map((time) => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
      </label>
      <span aria-hidden="true">至</span>
      <label>
        <span>结束</span>
        <select
          aria-label={`${group.label}结束时间`}
          value={group.endTime}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onTimeChange(group.id, "endTime", event.target.value);
          }}
        >
          {timeOptions.map((time) => (
            <option key={time} value={time}>{time}</option>
          ))}
        </select>
      </label>
      <small>{group.durationHint}</small>
    </div>
  );
}

function ScheduleEditor({
  document,
  groups,
  onTimeChange,
}: {
  readonly document: StudyTimePreferencesDocument;
  readonly groups: readonly EditableScheduleGroup[];
  readonly onTimeChange: (id: string, field: "startTime" | "endTime", value: string) => void;
}) {
  return (
    <section aria-labelledby="study-time-schedule-title" className="study-time-schedule">
      <SectionTitle id="study-time-schedule-title" title={document.scheduleTitle} />
      <div className="study-time-schedule-grid">
        <div className="study-time-large-number" aria-label={`${document.largeNumber}${document.largeNumberCaption}`}>
          <strong>{document.largeNumber}</strong>
          <span>{document.largeNumberCaption}</span>
        </div>
        <div className="study-time-schedule-table">
          <div className="study-time-timezone-row">
            <span>时区</span>
            <strong>{document.timezoneLabel}</strong>
            <small>{document.timezoneDescription}</small>
          </div>
          {groups.map((group) => (
            <ScheduleGroupRow group={group} key={group.id} onTimeChange={onTimeChange} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrangementSettings({
  document,
  orderPolicy,
  reminderLeadMinutes,
  sessionDurationMinutes,
  showDueOutsideWindow,
  onOrderChange,
  onReminderChange,
  onSessionDurationChange,
  onShowDueOutsideWindowChange,
}: {
  readonly document: StudyTimePreferencesDocument;
  readonly orderPolicy: StudyTimeOrderPolicy;
  readonly reminderLeadMinutes: number;
  readonly sessionDurationMinutes: number;
  readonly showDueOutsideWindow: boolean;
  readonly onOrderChange: (value: StudyTimeOrderPolicy) => void;
  readonly onReminderChange: (value: number) => void;
  readonly onSessionDurationChange: (value: number) => void;
  readonly onShowDueOutsideWindowChange: (value: boolean) => void;
}) {
  return (
    <section aria-labelledby="study-time-arrangement-title" className="study-time-arrangement">
      <SectionTitle id="study-time-arrangement-title" title={document.arrangementTitle} />
      <div className="study-time-field-row">
        <label htmlFor="study-time-session-duration">单次学习建议</label>
        <select
          id="study-time-session-duration"
          value={String(sessionDurationMinutes)}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onSessionDurationChange(Number(event.target.value));
          }}
        >
          {sessionDurationOptions.map((minutes) => (
            <option key={minutes} value={minutes}>{minutes} 分钟</option>
          ))}
        </select>
      </div>
      <div className="study-time-field-row">
        <label htmlFor="study-time-reminder-lead">提醒时间</label>
        <select
          id="study-time-reminder-lead"
          value={String(reminderLeadMinutes)}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onReminderChange(Number(event.target.value));
          }}
        >
          {reminderLeadOptions.map((minutes) => (
            <option key={minutes} value={minutes}>{reminderOptionLabel(minutes)}</option>
          ))}
        </select>
      </div>
      <div className="study-time-field-row">
        <label htmlFor="study-time-order-policy">任务排序依据</label>
        <select
          id="study-time-order-policy"
          value={orderPolicy}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onOrderChange(event.target.value === "DUE_FIRST_THEN_ESTIMATE" ? "DUE_FIRST_THEN_ESTIMATE" : "DUE_FIRST_THEN_ESTIMATE");
          }}
        >
          <option value="DUE_FIRST_THEN_ESTIMATE">{document.orderPolicyLabel}</option>
        </select>
      </div>
      <label className="study-time-checkbox">
        <input
          checked={showDueOutsideWindow}
          type="checkbox"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onShowDueOutsideWindowChange(event.target.checked);
          }}
        />
        <span>{document.showDueOutsideWindowLabel}</span>
      </label>
      <p>{document.settingsNotice}</p>
      {showDueOutsideWindow ? null : (
        <p aria-live="polite" className="study-time-due-warning">{document.dueVisibilityWarning}</p>
      )}
    </section>
  );
}

function TodayConflict({
  document,
  remainingMinutes,
}: {
  readonly document: StudyTimePreferencesDocument;
  readonly remainingMinutes: number;
}) {
  const difference = Math.max(0, document.taskEstimateMinutes - remainingMinutes);
  const previewRows = difference === 0
    ? [
      ...document.previewRows,
      { id: "dynamic-buffer", timeRange: "11:30–12:00", title: "可留给稍后调整", durationLabel: "30m" },
    ]
    : document.previewRows;
  return (
    <section aria-labelledby="study-time-conflict-title" className="study-time-conflict">
      <h2 id="study-time-conflict-title">{document.conflictTitle}</h2>
      <div className="study-time-conflict-facts" aria-label="今日安排冲突">
        <div>
          <span>现在</span>
          <strong>{document.currentTimeLabel}</strong>
        </div>
        <div>
          <span>周末偏好时段至</span>
          <strong>{document.weekendWindowEndLabel}</strong>
        </div>
        <div>
          <span>剩余可安排约</span>
          <strong>{minutesWithSpaceLabel(remainingMinutes)}</strong>
        </div>
        <div>
          <span>今日待办预计约</span>
          <strong>{minutesWithSpaceLabel(document.taskEstimateMinutes)}</strong>
        </div>
        <div>
          <span>相差约</span>
          <strong>{minutesWithSpaceLabel(difference)}</strong>
        </div>
      </div>
      <p>{document.conflictResolution}</p>
      <ol className="study-time-preview-list" aria-label="今日排序预览">
        {previewRows.map((row) => (
          <li key={row.id}>
            <span>{row.timeRange}</span>
            <strong>{row.title}</strong>
            <em>{row.durationLabel}</em>
          </li>
        ))}
      </ol>
      <p className="study-time-preview-footer">{difference === 0 ? "偏好窗口暂时能覆盖今日预计任务；到期任务仍保持优先。" : document.previewFooter}</p>
    </section>
  );
}

function StudyTimeRightRail({
  document,
  remainingMinutes,
  reminderLeadMinutes,
  sessionDurationMinutes,
}: {
  readonly document: StudyTimePreferencesDocument;
  readonly remainingMinutes: number;
  readonly reminderLeadMinutes: number;
  readonly sessionDurationMinutes: number;
}) {
  const difference = Math.max(0, document.taskEstimateMinutes - remainingMinutes);
  const statusRows: readonly DefinitionRow[] = document.statusRows.map((row) => {
    if (row.semanticKey === "SESSION_DURATION") {
      return { ...row, value: minutesCompactLabel(sessionDurationMinutes) };
    }
    if (row.semanticKey === "REMINDER_LEAD") {
      return { ...row, value: reminderStatusLabel(reminderLeadMinutes) };
    }
    return row;
  });
  const conflictRows: readonly DefinitionRow[] = document.conflictRows.map((row) => {
    if (row.semanticKey === "REMAINING_MINUTES") {
      return { ...row, value: minutesWithSpaceLabel(remainingMinutes) };
    }
    if (row.semanticKey === "DIFFERENCE_MINUTES") {
      return { ...row, value: minutesWithSpaceLabel(difference) };
    }
    return row;
  });

  return (
    <aside aria-label="学习时间偏好辅助信息" className="study-time-right-rail">
      <SectionTitle id="study-time-status-title" title="偏好状态" />
      <DefinitionList rows={statusRows} />
      <SectionTitle id="study-time-purpose-title" title="设置用途" />
      <ul>
        {document.purposeRows.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>
      <SectionTitle id="study-time-rail-conflict-title" title="今日冲突" />
      <DefinitionList rows={conflictRows} />
      <SectionTitle id="study-time-privacy-title" title="服务与隐私" />
      <DefinitionList rows={document.privacyRows} />
    </aside>
  );
}

function StudyTimeCompactRail({
  document,
  remainingMinutes,
  reminderLeadMinutes,
  sessionDurationMinutes,
}: {
  readonly document: StudyTimePreferencesDocument;
  readonly remainingMinutes: number;
  readonly reminderLeadMinutes: number;
  readonly sessionDurationMinutes: number;
}) {
  const difference = Math.max(0, document.taskEstimateMinutes - remainingMinutes);
  const statusRows: readonly DefinitionRow[] = document.statusRows.map((row) => {
    if (row.semanticKey === "SESSION_DURATION") {
      return { ...row, value: minutesCompactLabel(sessionDurationMinutes) };
    }
    if (row.semanticKey === "REMINDER_LEAD") {
      return { ...row, value: reminderStatusLabel(reminderLeadMinutes) };
    }
    return row;
  });
  const conflictRows: readonly DefinitionRow[] = document.conflictRows.map((row) => {
    if (row.semanticKey === "REMAINING_MINUTES") {
      return { ...row, value: minutesWithSpaceLabel(remainingMinutes) };
    }
    if (row.semanticKey === "DIFFERENCE_MINUTES") {
      return { ...row, value: minutesWithSpaceLabel(difference) };
    }
    return row;
  });
  return (
    <details className="study-time-rail-compact">
      <summary>查看状态、用途、冲突摘要与隐私</summary>
      <div>
        <SectionTitle id="study-time-compact-status-title" title="偏好状态" />
        <DefinitionList rows={statusRows} />
        <SectionTitle id="study-time-compact-purpose-title" title="设置用途" />
        <ul>
          {document.purposeRows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
        <SectionTitle id="study-time-compact-conflict-title" title="今日冲突" />
        <DefinitionList rows={conflictRows} />
        <SectionTitle id="study-time-compact-privacy-title" title="服务与隐私" />
        <DefinitionList rows={document.privacyRows} />
      </div>
    </details>
  );
}

function StudyTimePreferencesView({
  currentUser,
  dateTime,
  demoActive,
  document,
  sourceBoundary,
}: {
  readonly currentUser: CurrentUserResult;
  readonly dateTime: ShanghaiDateTime;
  readonly demoActive: boolean;
  readonly document: StudyTimePreferencesDocument;
  readonly sourceBoundary?: string;
}) {
  const [groups, setGroups] = useState<readonly EditableScheduleGroup[]>(() => document.scheduleGroups.map((group) => ({ ...group })));
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(document.sessionDurationMinutes);
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState(document.reminderLeadMinutes);
  const [orderPolicy, setOrderPolicy] = useState<StudyTimeOrderPolicy>(document.orderPolicy);
  const [showDueOutsideWindow, setShowDueOutsideWindow] = useState(document.showDueOutsideWindow);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [restorePending, setRestorePending] = useState(false);

  const weekendGroup = groups.find((group) => group.kind === "WEEKEND") ?? groups[0];
  const remainingMinutes = useMemo(() => {
    if (weekendGroup === undefined) {
      return document.remainingMinutes;
    }
    return Math.max(0, minutesFromTime(weekendGroup.endTime) - minutesFromTime(document.currentTimeLabel));
  }, [document.currentTimeLabel, document.remainingMinutes, weekendGroup]);
  const hasInvalidTime = groups.some((group) => minutesFromTime(group.startTime) >= minutesFromTime(group.endTime));

  function updateGroupTime(id: string, field: "startTime" | "endTime", value: string) {
    setFeedback(null);
    setRestorePending(false);
    setGroups((current) => current.map((group) => (group.id === id ? { ...group, [field]: value } : group)));
  }

  function savePreferences() {
    setRestorePending(false);
    if (hasInvalidTime) {
      setFeedback("STUDY_TIME_VALIDATION_ERROR：每组偏好时段必须满足开始时间早于结束时间；冲突提示不作为校验错误。");
      return;
    }
    setFeedback(document.saveOperationUnknownMessage);
  }

  function restoreSnapshot() {
    if (!restorePending) {
      setRestorePending(true);
      setFeedback("再次点击“恢复上次保存”确认丢弃本页未保存修改；不会写入服务端。");
      return;
    }
    setGroups(document.scheduleGroups.map((group) => ({ ...group })));
    setSessionDurationMinutes(document.sessionDurationMinutes);
    setReminderLeadMinutes(document.reminderLeadMinutes);
    setOrderPolicy(document.orderPolicy);
    setShowDueOutsideWindow(document.showDueOutsideWindow);
    setRestorePending(false);
    setFeedback(document.restoreConfirmMessage);
  }

  return (
    <div className="app-shell study-time-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <StudyTimeMobileMenu />
      <main className="paper-canvas study-time-canvas" id="main-content">
        <StudyTimeHeader dateTime={dateTime} document={document} />
        <div className="study-time-grid">
          <article aria-label="学习时间偏好" className="study-time-main">
            <ScheduleEditor document={document} groups={groups} onTimeChange={updateGroupTime} />
            <ArrangementSettings
              document={document}
              orderPolicy={orderPolicy}
              reminderLeadMinutes={reminderLeadMinutes}
              sessionDurationMinutes={sessionDurationMinutes}
              showDueOutsideWindow={showDueOutsideWindow}
              onOrderChange={setOrderPolicy}
              onReminderChange={(value) => {
                setReminderLeadMinutes(value);
                setFeedback(null);
                setRestorePending(false);
              }}
              onSessionDurationChange={(value) => {
                setSessionDurationMinutes(value);
                setFeedback(null);
                setRestorePending(false);
              }}
              onShowDueOutsideWindowChange={(value) => {
                setShowDueOutsideWindow(value);
                setFeedback(null);
                setRestorePending(false);
              }}
            />
            <TodayConflict document={document} remainingMinutes={remainingMinutes} />
            <div className="study-time-actions" aria-label="学习时间偏好操作">
              <button type="button" onClick={savePreferences}>
                {document.saveActionLabel}
                <Icon name="arrowRight" size={16} />
              </button>
              <button type="button" onClick={restoreSnapshot}>{restorePending ? "确认恢复上次保存" : document.restoreActionLabel}</button>
              <Link to={document.backUrl}>{document.backActionLabel}</Link>
            </div>
            <p className="study-time-action-boundary">{document.actionBoundary}</p>
            {feedback === null ? null : <p aria-live="polite" className="study-time-feedback">{feedback}</p>}
            {demoActive && sourceBoundary !== undefined ? <p className="study-time-source-boundary">{sourceBoundary}</p> : null}
            <StudyTimeCompactRail
              document={document}
              remainingMinutes={remainingMinutes}
              reminderLeadMinutes={reminderLeadMinutes}
              sessionDurationMinutes={sessionDurationMinutes}
            />
          </article>
          <span aria-hidden="true" className="study-time-rail-divider" />
          <StudyTimeRightRail
            document={document}
            remainingMinutes={remainingMinutes}
            reminderLeadMinutes={reminderLeadMinutes}
            sessionDurationMinutes={sessionDurationMinutes}
          />
        </div>
      </main>
    </div>
  );
}

export function StudyTimePreferencesServiceUnavailable({
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
    <div className="app-shell study-time-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentItemId="student-profile" currentUser={currentUser} demoActive={demoActive} profileActive />
      <StudyTimeMobileMenu />
      <main className="paper-canvas service-state-page study-time-canvas" id="main-content">
        <header className="page-header compact">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel
          description="STUDY_TIME_SETTINGS_UNAVAILABLE：当前不会展示虚构偏好时段、冲突、预览、保存状态或提醒配置。"
          title="学习时间偏好服务暂时不可用"
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export function StudyTimePreferencesRoute({
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
      return course.studyTimePreferences?.find((item) => item.targetId === targetId);
    }
    return course.studyTimePreferences?.[0];
  }, [course.studyTimePreferences, targetId]);

  if (document === undefined || !isDisplayableStudyTimePreferences(document)) {
    return (
      <StudyTimePreferencesServiceUnavailable
        currentUser={currentUser}
        demoActive={demoActive}
        overviewUrl={overviewUrl}
        subtitle="当前课程上下文没有可用的 STU-033 学习时间偏好文档；不会回退到示例时段、冲突、预览或提醒配置，也不会隐藏到期任务。"
        title="学习时间偏好"
      />
    );
  }

  return (
    <StudyTimePreferencesView
      currentUser={currentUser}
      dateTime={dateTime}
      demoActive={demoActive}
      document={document}
      sourceBoundary={document.sourceBoundary}
    />
  );
}
