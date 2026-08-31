import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./knowledge-intro/knowledge-intro.css";
import "./practice/practice.css";
import "./subject-detail/subject-detail.css";
import "./textbook-detail/textbook-detail.css";
import "./chapter-detail/chapter-detail.css";
import "./knowledge-point-detail/knowledge-point-detail.css";
import "./question-hub/question-hub.css";
import "./text-question/text-question.css";
import "./image-question/image-question.css";
import "./ocr-confirmation/ocr-confirmation.css";
import "./tutor-session/tutor-session.css";
import "./practice-hub/practice-hub.css";
import "./practice-attempt/practice-attempt.css";
import "./practice-result/practice-result.css";
import "./wrong-book/wrong-book.css";
import "./wrong-item-detail/wrong-item-detail.css";
import "./wrong-item-correction/wrong-item-correction.css";
import "./scheduled-review-attempt/scheduled-review-attempt.css";
import "./review-result/review-result.css";
import "./exam-list/exam-list.css";
import "./exam-entry/exam-entry.css";
import "./exam-detail/exam-detail.css";
import "./exam-analysis/exam-analysis.css";
import "./remediation-plan/remediation-plan.css";
import "./mastery-overview/mastery-overview.css";
import "./mastery-detail/mastery-detail.css";
import "./student-profile/student-profile.css";
import "./textbook-settings/textbook-settings.css";
import "./study-time-preferences/study-time-preferences.css";
import "./family-privacy/family-privacy.css";

import type { CurrentUserResult } from "../../api/auth";
import { Icon } from "../../components/Icon";
import { Sidebar } from "../../components/Sidebar";
import { StatusPanel } from "../../components/StatusPanel";
import { useDocumentMetadata } from "../../hooks/use-document-metadata";
import { CourseFilters, CourseTable } from "./CourseTable";
import { CourseHero } from "./CourseHero";
import {
  KnowledgeIntroRoute,
  KnowledgeIntroServiceUnavailable,
} from "./knowledge-intro/KnowledgeIntroView";
import {
  KnowledgePointDetailRoute,
  KnowledgePointDetailServiceUnavailable,
} from "./knowledge-point-detail/KnowledgePointDetailView";
import {
  QuestionHubRoute,
  QuestionHubServiceUnavailable,
} from "./question-hub/QuestionHubView";
import { getQuestionTargetCopy } from "./question-hub/question-copy";
import { RightRail } from "./RightRail";
import {
  TextQuestionComposerRoute,
  TextQuestionComposerServiceUnavailable,
} from "./text-question/TextQuestionComposerView";
import {
  ImageQuestionUploadRoute,
  ImageQuestionUploadServiceUnavailable,
} from "./image-question/ImageQuestionUploadView";
import {
  OcrConfirmationRoute,
  OcrConfirmationServiceUnavailable,
} from "./ocr-confirmation/OcrConfirmationView";
import {
  TutorSessionRoute,
  TutorSessionServiceUnavailable,
} from "./tutor-session/TutorSessionView";
import {
  TutorResultRoute,
  TutorResultServiceUnavailable,
} from "./tutor-session/TutorResultView";
import {
  PracticeHubRoute,
  PracticeHubServiceUnavailable,
} from "./practice-hub/PracticeHubView";
import {
  PracticeAttemptRoute,
  PracticeAttemptServiceUnavailable,
} from "./practice-attempt/PracticeAttemptView";
import {
  PracticeResultRoute,
  PracticeResultServiceUnavailable,
} from "./practice-result/PracticeResultView";
import {
  WrongBookRoute,
  WrongBookServiceUnavailable,
} from "./wrong-book/WrongBookView";
import {
  WrongItemDetailRoute,
  WrongItemDetailServiceUnavailable,
} from "./wrong-item-detail/WrongItemDetailView";
import {
  WrongItemCorrectionRoute,
  WrongItemCorrectionServiceUnavailable,
} from "./wrong-item-correction/WrongItemCorrectionView";
import {
  ScheduledReviewAttemptRoute,
  ScheduledReviewAttemptServiceUnavailable,
} from "./scheduled-review-attempt/ScheduledReviewAttemptView";
import {
  ReviewResultRoute,
  ReviewResultServiceUnavailable,
} from "./review-result/ReviewResultView";
import {
  ExamListRoute,
  ExamListServiceUnavailable,
} from "./exam-list/ExamListView";
import {
  ExamEntryRoute,
  ExamEntryServiceUnavailable,
} from "./exam-entry/ExamEntryView";
import {
  ExamDetailRoute,
  ExamDetailServiceUnavailable,
} from "./exam-detail/ExamDetailView";
import {
  ExamAnalysisRoute,
  ExamAnalysisServiceUnavailable,
} from "./exam-analysis/ExamAnalysisView";
import {
  RemediationPlanRoute,
  RemediationPlanServiceUnavailable,
} from "./remediation-plan/RemediationPlanView";
import {
  MasteryOverviewRoute,
  MasteryOverviewServiceUnavailable,
} from "./mastery-overview/MasteryOverviewView";
import {
  MasteryDetailRoute,
  MasteryDetailServiceUnavailable,
} from "./mastery-detail/MasteryDetailView";
import {
  StudentProfileRoute,
  StudentProfileServiceUnavailable,
} from "./student-profile/StudentProfileView";
import {
  TextbookSettingsRoute,
  TextbookSettingsServiceUnavailable,
} from "./textbook-settings/TextbookSettingsView";
import {
  StudyTimePreferencesRoute,
  StudyTimePreferencesServiceUnavailable,
} from "./study-time-preferences/StudyTimePreferencesView";
import {
  FamilyPrivacyRoute,
  FamilyPrivacyServiceUnavailable,
} from "./family-privacy/FamilyPrivacyView";
import {
  SubjectDetailRoute,
  SubjectDetailServiceUnavailable,
} from "./subject-detail/SubjectDetailView";
import {
  TextbookDetailRoute,
  TextbookDetailServiceUnavailable,
} from "./textbook-detail/TextbookDetailView";
import {
  ChapterDetailRoute,
  ChapterDetailServiceUnavailable,
} from "./chapter-detail/ChapterDetailView";
import { PracticeRoute, PracticeServiceUnavailable } from "./practice/PracticeView";
import type {
  CourseCatalog,
  CourseCatalogResult,
  CourseSummary,
  Grade,
  KnowledgePointActionKind,
  QuestionModeKind,
  SubjectChapterRow,
  SubjectCode,
  Term,
} from "./types";
import { useCourseMaterialsPageData } from "./use-course-materials-page-data";
import { formatShanghaiDateTime, useShanghaiDateTime } from "./use-shanghai-date-time";

const LessonSummaryRoute = lazy(async () => ({
  default: (await import("./lesson-summary/LessonSummaryView")).LessonSummaryRoute,
}));
const LessonSummaryServiceUnavailable = lazy(async () => ({
  default: (await import("./lesson-summary/LessonSummaryView")).LessonSummaryServiceUnavailable,
}));
const LessonCompleteRoute = lazy(async () => ({
  default: (await import("./lesson-complete/LessonCompleteView")).LessonCompleteRoute,
}));
const LessonCompleteServiceUnavailable = lazy(async () => ({
  default: (await import("./lesson-complete/LessonCompleteView")).LessonCompleteServiceUnavailable,
}));

const subjectCodes = new Set<SubjectCode>([
  "CHINESE",
  "MATH",
  "ENGLISH",
  "MORALITY",
  "HISTORY",
  "PHYSICS",
  "CHEMISTRY",
]);

const knowledgePointTargetCopy: Record<KnowledgePointActionKind, { readonly title: string; readonly subtitle: string }> = {
  QUESTION: {
    title: "提出问题",
    subtitle: "STU-010 提问服务尚未接入；当前不会创建 TutorSession、提问记录或学习证据。",
  },
  PRACTICE: {
    title: "当前点练习",
    subtitle: "STU-016 当前点练习将在对应页面按顺序实现；当前不会把前端点击伪装成练习提交或掌握证据。",
  },
  EVIDENCE: {
    title: "掌握证据",
    subtitle: "STU-030 掌握证据查询尚未接入；当前不会推断、生成或保存 mastery 状态。",
  },
};

function parseKnowledgePointActionKind(value: string | null): KnowledgePointActionKind {
  if (value === "QUESTION" || value === "PRACTICE" || value === "EVIDENCE") {
    return value;
  }
  return "PRACTICE";
}

function parseQuestionModeKind(value: string | null): QuestionModeKind {
  return value === "IMAGE" ? "IMAGE" : "TEXT";
}

function parseGrade(value: string | null, fallback: Grade): Grade {
  return value === "7" ? 7 : value === "8" ? 8 : value === "9" ? 9 : fallback;
}

function parseTerm(value: string | null, fallback: Term): Term {
  if (value === "SPRING" || value === "AUTUMN") {
    return value;
  }
  return fallback;
}

function parseSubject(value: string | null): SubjectCode | null {
  return value !== null && subjectCodes.has(value as SubjectCode) ? (value as SubjectCode) : null;
}

function LoadingSurface() {
  return (
    <div className="page-loading" aria-label="正在加载课程与资料" role="status">
      <span className="skeleton-line skeleton-title" />
      <span className="skeleton-line skeleton-copy" />
      <span className="skeleton-line skeleton-divider" />
      <div className="skeleton-columns">
        <span />
        <span />
      </div>
    </div>
  );
}

function ExampleServiceUnavailable({ currentUser, overviewUrl }: { readonly currentUser: CurrentUserResult; readonly overviewUrl: string }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive={false} />
      <main className="paper-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div><h1>例题讲解</h1><p>二次函数的图像与性质</p></div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>
        <StatusPanel description="当前没有真实例题讲解 adapter；任务详情页保留了合法课程上下文，但不会伪造进度同步或学习证据。" title="例题讲解服务暂时不可用" />
        <a className="secondary-button" href={overviewUrl}>返回数学课程</a>
      </main>
    </div>
  );
}

export interface CourseMaterialsViewProps {
  readonly catalog: CourseCatalog;
  readonly currentUser: CurrentUserResult;
}

export function CourseMaterialsView({ catalog, currentUser }: CourseMaterialsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const grade = parseGrade(searchParams.get("grade"), catalog.courses[0]?.grade ?? 7);
  const term = parseTerm(searchParams.get("term"), catalog.courses[0]?.term ?? "AUTUMN");
  const rawSubject = searchParams.get("subject");
  const requestedSubject = parseSubject(rawSubject);
  const liveDateTime = useShanghaiDateTime();
  const dateTime = useMemo(
    () => catalog.source === "DEVELOPMENT_FIXTURE"
      ? formatShanghaiDateTime(new Date(catalog.generatedAt))
      : liveDateTime,
    [catalog.generatedAt, catalog.source, liveDateTime],
  );
  const dateFootnote = catalog.source === "DEVELOPMENT_FIXTURE"
    ? "丙午年 七月初十 · 星期六"
    : `${dateTime.weekdayChinese} · Asia/Shanghai`;
  const view = searchParams.get("view");

  const courses = useMemo(
    () => catalog.courses.filter((course) => course.grade === grade && course.term === term),
    [catalog.courses, grade, term],
  );
  const selectedSubject =
    requestedSubject ??
    courses.find((course) => course.subjectCode === "MATH")?.subjectCode ??
    courses[0]?.subjectCode ??
    null;
  const subjectNotApplicable =
    rawSubject !== null &&
    (requestedSubject === null || !courses.some((course) => course.subjectCode === requestedSubject));
  const featuredCourse =
    courses.find((course) => course.subjectCode === selectedSubject) ??
    courses.find((course) => course.subjectCode === "MATH") ??
    courses[0];

  useEffect(() => {
    if (announcement === null) {
      return undefined;
    }
    const timer = window.setTimeout(() => { setAnnouncement(null); }, 4_000);
    return () => { window.clearTimeout(timer); };
  }, [announcement]);

  function updateFilter(key: "grade" | "term", value: string): void {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete("subject");
    setSearchParams(next, { replace: true });
  }

  function selectCourse(course: CourseSummary): void {
    const next = new URLSearchParams(searchParams);
    next.set("subject", course.subjectCode);
    setSearchParams(next, { replace: false });
    setAnnouncement(`已选择${course.subjectLabel}；课程详情将在课程服务接入后开放。`);
  }

  function selectRecentMaterial(subjectCode: SubjectCode, title: string): void {
    const course = catalog.courses.find((item) => item.subjectCode === subjectCode);
    if (course !== undefined) {
      selectCourse(course);
      setAnnouncement(`已定位“${title}”所属的${course.subjectLabel}课程。`);
    }
  }

  function enterCourse(course: CourseSummary): void {
    const next = new URLSearchParams(searchParams);
    next.set("subject", course.subjectCode);
    next.set("view", "subject-detail");
    next.delete("chapter");
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openSubjectTextbook(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "textbook-detail");
    next.delete("chapter");
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openSubjectChapter(chapter: SubjectChapterRow): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "chapter-detail");
    next.set("chapter", chapter.id);
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openTextbookChapter(chapterId: string): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "chapter-detail");
    next.set("chapter", chapterId);
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openChapterKnowledgePoint(targetId: string): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "knowledge-point-detail");
    next.set("knowledge", targetId);
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openKnowledgePointAction(targetId: string, actionKind: KnowledgePointActionKind): void {
    const next = new URLSearchParams(searchParams);
    if (actionKind === "QUESTION") {
      next.set("view", "question-hub");
      next.delete("target");
      next.delete("action");
      next.delete("mode");
      next.delete("session");
    } else if (actionKind === "PRACTICE") {
      next.set("view", "practice-hub");
      next.set("target", targetId);
      next.delete("action");
      next.delete("mode");
      next.delete("draft");
      next.delete("session");
    } else {
      next.set("view", "knowledge-point-target");
      next.set("target", targetId);
      next.set("action", actionKind);
      next.delete("mode");
      next.delete("session");
    }
    setSearchParams(next, { replace: false });
  }

  function openQuestionMode(targetId: string, modeKind: QuestionModeKind): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", modeKind === "TEXT" ? "text-question-composer" : "image-question-upload");
    next.set("target", targetId);
    next.set("mode", modeKind);
    next.delete("action");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function changeQuestionContext(): void {
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    next.delete("chapter");
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function returnQuestionToKnowledgePoint(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "knowledge-point-detail");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function returnOcrToImageUpload(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "image-question-upload");
    next.delete("action");
    next.delete("mode");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function returnTutorToQuestion(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "ocr-confirmation");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function returnTextQuestionToHub(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "question-hub");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openQuestionFallback(targetId: string, actionKind: KnowledgePointActionKind): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", actionKind === "PRACTICE" ? "practice-hub" : "knowledge-point-target");
    next.set("target", targetId);
    if (actionKind === "PRACTICE") {
      next.delete("action");
    } else {
      next.set("action", actionKind);
    }
    next.delete("mode");
    next.delete("draft");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openQuestionNotes(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "summary");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function returnKnowledgePointToChapter(chapterId: string | null): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "chapter-detail");
    if (chapterId === null) {
      next.delete("chapter");
    } else {
      next.set("chapter", chapterId);
    }
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openKnowledgePointTutor(targetId: string | null): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "ai-tutor");
    if (targetId === null) {
      next.delete("target");
    } else {
      next.set("target", targetId);
    }
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openChapterTextbook(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "textbook-detail");
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  function openSubjectTutor(): void {
    const next = new URLSearchParams(searchParams);
    next.set("view", "ai-tutor");
    next.delete("chapter");
    next.delete("knowledge");
    next.delete("target");
    next.delete("action");
    next.delete("mode");
    next.delete("session");
    setSearchParams(next, { replace: false });
  }

  const overviewParams = new URLSearchParams(searchParams);
  overviewParams.delete("view");
  overviewParams.delete("chapter");
  overviewParams.delete("knowledge");
  overviewParams.delete("target");
  overviewParams.delete("action");
  overviewParams.delete("mode");
  overviewParams.delete("draft");
  overviewParams.delete("session");
  overviewParams.delete("attempt");
  overviewParams.delete("review");
  overviewParams.delete("wrongItem");
  overviewParams.delete("wrongStatus");
  overviewParams.delete("wrongSubject");
  overviewParams.delete("wrongSort");
  overviewParams.delete("examStatus");
  overviewParams.delete("examSubject");
  overviewParams.delete("examSort");
  overviewParams.delete("exam");
  overviewParams.delete("analysis");
  overviewParams.delete("plan");
  overviewParams.delete("masteryStatus");
  overviewParams.delete("profileAction");
  const overviewQuery = overviewParams.toString();
  const overviewUrl = overviewQuery.length === 0 ? "/student/learn" : `/student/learn?${overviewQuery}`;
  const knowledgeIntroParams = new URLSearchParams(overviewParams);
  knowledgeIntroParams.set("view", "knowledge-intro");
  const knowledgeIntroUrl = `/student/learn?${knowledgeIntroParams.toString()}`;
  const practiceParams = new URLSearchParams(overviewParams);
  practiceParams.set("view", "practice");
  const practiceUrl = `/student/learn?${practiceParams.toString()}`;
  const practiceHubParams = new URLSearchParams(overviewParams);
  practiceHubParams.set("view", "practice-hub");
  const practiceAttemptChapterId = searchParams.get("chapter");
  const practiceAttemptKnowledgePointId = searchParams.get("knowledge");
  if (practiceAttemptChapterId !== null) {
    practiceHubParams.set("chapter", practiceAttemptChapterId);
  }
  if (practiceAttemptKnowledgePointId !== null) {
    practiceHubParams.set("knowledge", practiceAttemptKnowledgePointId);
  }
  const practiceHubUrl = `/student/learn?${practiceHubParams.toString()}`;
  const summaryParams = new URLSearchParams(overviewParams);
  summaryParams.set("view", "summary");
  const summaryUrl = `/student/learn?${summaryParams.toString()}`;
  const subjectDetailParams = new URLSearchParams(overviewParams);
  subjectDetailParams.set("view", "subject-detail");
  const subjectDetailUrl = `/student/learn?${subjectDetailParams.toString()}`;
  const knowledgePointDetailParams = new URLSearchParams(searchParams);
  knowledgePointDetailParams.set("view", "knowledge-point-detail");
  knowledgePointDetailParams.delete("target");
  knowledgePointDetailParams.delete("action");
  knowledgePointDetailParams.delete("mode");
  knowledgePointDetailParams.delete("draft");
  knowledgePointDetailParams.delete("session");
  const knowledgePointDetailUrl = `/student/learn?${knowledgePointDetailParams.toString()}`;
  const questionHubParams = new URLSearchParams(searchParams);
  questionHubParams.set("view", "question-hub");
  questionHubParams.delete("target");
  questionHubParams.delete("action");
  questionHubParams.delete("mode");
  questionHubParams.delete("draft");
  questionHubParams.delete("session");
  const questionHubUrl = `/student/learn?${questionHubParams.toString()}`;

  if (view === "subject-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <SubjectDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级或学期不包含该学科；返回课程与资料，不泄露其他范围。"
          title="学科范围不可用"
        />
      );
    }
    return (
      <SubjectDetailRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        onChapterOpen={openSubjectChapter}
        onTextbookOpen={openSubjectTextbook}
        onTutorOpen={openSubjectTutor}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (view === "textbook-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <TextbookDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级或学期不包含该教材；返回课程与资料，不泄露其他范围。"
          title="教材范围不可用"
        />
      );
    }
    return (
      <TextbookDetailRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        onChapterOpen={openTextbookChapter}
        overviewUrl={overviewUrl}
        subjectDetailUrl={subjectDetailUrl}
      />
    );
  }

  if (view === "chapter-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ChapterDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级或学期不包含该章节；返回课程与资料，不泄露其他范围。"
          title="章节范围不可用"
        />
      );
    }
    return (
      <ChapterDetailRoute
        chapterId={searchParams.get("chapter")}
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        onKnowledgePointOpen={openChapterKnowledgePoint}
        onTextbookOpen={openChapterTextbook}
        onTutorOpen={openSubjectTutor}
        overviewUrl={overviewUrl}
        subjectDetailUrl={subjectDetailUrl}
      />
    );
  }

  if (view === "knowledge-point-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <KnowledgePointDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={subjectDetailUrl}
          subtitle="当前冻结年级、学期或学科不包含该知识点；返回课程与资料，不泄露其他范围。"
          title="知识点范围不可用"
        />
      );
    }
    return (
      <KnowledgePointDetailRoute
        chapterId={searchParams.get("chapter")}
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        onActionOpen={openKnowledgePointAction}
        onChapterReturn={returnKnowledgePointToChapter}
        onTextbookOpen={openChapterTextbook}
        onTutorOpen={openKnowledgePointTutor}
        overviewUrl={overviewUrl}
        subjectDetailUrl={subjectDetailUrl}
      />
    );
  }

  if (view === "question-hub") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <QuestionHubServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该提问上下文；返回课程与资料，不泄露其他范围。"
          title="提问中心"
        />
      );
    }
    return (
      <QuestionHubRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        onContextChange={changeQuestionContext}
        onFallbackOpen={openQuestionFallback}
        onKnowledgeReturn={returnQuestionToKnowledgePoint}
        onModeOpen={openQuestionMode}
        onNotesOpen={openQuestionNotes}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (view === "question-mode-target" && featuredCourse !== undefined) {
    const targetCopy = getQuestionTargetCopy(parseQuestionModeKind(searchParams.get("mode")));
    return (
      <QuestionHubServiceUnavailable
        currentUser={currentUser}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={questionHubUrl}
        subtitle={targetCopy.subtitle}
        title={targetCopy.title}
      />
    );
  }

  if (view === "text-question-composer") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <TextQuestionComposerServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该文字提问上下文；返回课程与资料，不泄露其他范围。"
          title="文字提问"
        />
      );
    }
    return (
      <TextQuestionComposerRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        onHubReturn={returnTextQuestionToHub}
        onImageModeOpen={openQuestionMode}
        onKnowledgeReturn={returnQuestionToKnowledgePoint}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (view === "image-question-upload") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ImageQuestionUploadServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该单题图片上下文；返回课程与资料，不泄露其他范围。"
          title="单题图片上传"
        />
      );
    }
    return (
      <ImageQuestionUploadRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        onHubReturn={returnTextQuestionToHub}
        onKnowledgeReturn={returnQuestionToKnowledgePoint}
        onTextModeOpen={openQuestionMode}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (view === "ocr-confirmation") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <OcrConfirmationServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该 OCR 确认上下文；返回课程与资料，不泄露其他范围。"
          title="OCR 结果确认"
        />
      );
    }
    return (
      <OcrConfirmationRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        draftId={searchParams.get("draft")}
        knowledgePointId={searchParams.get("knowledge")}
        onHubReturn={returnTextQuestionToHub}
        onImageUploadReturn={returnOcrToImageUpload}
        onTextModeOpen={openQuestionMode}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (view === "hint-first-tutor-session") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <TutorSessionServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该提示辅导上下文；返回课程与资料，不泄露其他范围。"
          title="提示优先辅导"
        />
      );
    }
    return (
      <TutorSessionRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateFootnote={dateFootnote}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        onQuestionReturn={returnTutorToQuestion}
        overviewUrl={overviewUrl}
        sessionId={searchParams.get("session")}
      />
    );
  }

  if (view === "tutor-session-result") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <TutorResultServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该辅导结果上下文；返回课程与资料，不泄露其他范围。"
          title="辅导结果"
        />
      );
    }
    return (
      <TutorResultRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        knowledgePointUrl={knowledgePointDetailUrl}
        overviewUrl={overviewUrl}
        sessionId={searchParams.get("session")}
      />
    );
  }

  if (view === "practice-hub") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <PracticeHubServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该练习上下文；返回课程与资料，不泄露其他范围。"
          title="练习中心"
        />
      );
    }
    return (
      <PracticeHubRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        knowledgePointUrl={knowledgePointDetailUrl}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "practice-attempt") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <PracticeAttemptServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该练习作答上下文；返回课程与资料，不泄露其他 attempt。"
          title="独立练习"
        />
      );
    }
    return (
      <PracticeAttemptRoute
        attemptId={searchParams.get("attempt")}
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        practiceHubUrl={practiceHubUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "practice-result") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <PracticeResultServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该练习结果上下文；返回课程与资料，不泄露其他 attempt。"
          title="练习结果"
        />
      );
    }
    return (
      <PracticeResultRoute
        attemptId={searchParams.get("attempt")}
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        overviewUrl={overviewUrl}
        practiceHubUrl={practiceHubUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "wrong-book") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <WrongBookServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该错题本上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="错题本"
        />
      );
    }
    return (
      <WrongBookRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "wrong-item-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <WrongItemDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该错题详情上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="错题详情"
        />
      );
    }
    return (
      <WrongItemDetailRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
        wrongItemId={searchParams.get("wrongItem")}
      />
    );
  }

  if (view === "wrong-item-correction") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <WrongItemCorrectionServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该错题订正上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="错题订正"
        />
      );
    }
    return (
      <WrongItemCorrectionRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
        wrongItemId={searchParams.get("wrongItem")}
      />
    );
  }

  if (view === "scheduled-review-attempt") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ScheduledReviewAttemptServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该到期复习上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="到期复习"
        />
      );
    }
    return (
      <ScheduledReviewAttemptRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        reviewId={searchParams.get("review")}
        targetId={searchParams.get("target")}
        wrongItemId={searchParams.get("wrongItem")}
      />
    );
  }

  if (view === "review-result") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ReviewResultServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该复习结果上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="复习结果"
        />
      );
    }
    return (
      <ReviewResultRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        reviewId={searchParams.get("review")}
        targetId={searchParams.get("target")}
        wrongItemId={searchParams.get("wrongItem")}
      />
    );
  }

  if (view === "exam-list") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ExamListServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该考试记录上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="考试记录"
        />
      );
    }
    return (
      <ExamListRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "exam-entry") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ExamEntryServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该考试录入上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="考试录入"
        />
      );
    }
    return (
      <ExamEntryRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        examId={searchParams.get("exam")}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "exam-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ExamDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该考试详情上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="考试详情"
        />
      );
    }
    return (
      <ExamDetailRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        examId={searchParams.get("exam")}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "exam-analysis") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <ExamAnalysisServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该考试分析上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="考试分析"
        />
      );
    }
    return (
      <ExamAnalysisRoute
        analysisId={searchParams.get("analysis")}
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        examId={searchParams.get("exam")}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "remediation-plan") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <RemediationPlanServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该补救计划上下文；返回课程与资料，不泄露其他学生或家庭记录。"
          title="补救计划"
        />
      );
    }
    return (
      <RemediationPlanRoute
        analysisId={searchParams.get("analysis")}
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        examId={searchParams.get("exam")}
        overviewUrl={overviewUrl}
        planId={searchParams.get("plan")}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "mastery-overview") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <MasteryOverviewServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该掌握概览上下文；返回课程与资料，不泄露其他学生或家庭证据。"
          title="掌握概览"
        />
      );
    }
    return (
      <MasteryOverviewRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "mastery-detail") {
    if (subjectNotApplicable || featuredCourse === undefined) {
      return (
        <MasteryDetailServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前冻结年级、学期或学科不包含该掌握证据上下文；返回课程与资料，不泄露其他学生或家庭证据。"
          title="知识点掌握详情"
        />
      );
    }
    return (
      <MasteryDetailRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        knowledgePointId={searchParams.get("knowledge")}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "student-profile") {
    if (featuredCourse === undefined) {
      return (
        <StudentProfileServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前没有可用的学生个人资料上下文；返回课程与资料，不泄露其他学生或家庭资料。"
          title="学生个人资料"
        />
      );
    }
    return (
      <StudentProfileRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "textbook-settings") {
    if (featuredCourse === undefined) {
      return (
        <TextbookSettingsServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前没有可用的教材设置上下文；返回课程与资料，不泄露其他学生或家庭教材材料。"
          title="教材设置"
        />
      );
    }
    return (
      <TextbookSettingsRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "study-time-preferences") {
    if (featuredCourse === undefined) {
      return (
        <StudyTimePreferencesServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前没有可用的学习时间偏好上下文；返回课程与资料，不泄露其他学生或家庭偏好。"
          title="学习时间偏好"
        />
      );
    }
    return (
      <StudyTimePreferencesRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "family-privacy") {
    if (featuredCourse === undefined) {
      return (
        <FamilyPrivacyServiceUnavailable
          currentUser={currentUser}
          demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
          overviewUrl={overviewUrl}
          subtitle="当前没有可用的家庭与隐私上下文；返回课程与资料，不泄露其他学生或家庭成员关系。"
          title="家庭与隐私"
        />
      );
    }
    return (
      <FamilyPrivacyRoute
        course={featuredCourse}
        currentUser={currentUser}
        dateTime={dateTime}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={overviewUrl}
        targetId={searchParams.get("target")}
      />
    );
  }

  if (view === "knowledge-point-target" && featuredCourse !== undefined) {
    const targetCopy = knowledgePointTargetCopy[parseKnowledgePointActionKind(searchParams.get("action"))];
    return (
      <KnowledgePointDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={knowledgePointDetailUrl}
        subtitle={targetCopy.subtitle}
        title={targetCopy.title}
      />
    );
  }

  if (view === "ai-tutor" && featuredCourse !== undefined) {
    return (
      <SubjectDetailServiceUnavailable
        currentUser={currentUser}
        demoActive={catalog.source === "DEVELOPMENT_FIXTURE"}
        overviewUrl={subjectDetailUrl}
        subtitle="AI 辅导会话服务尚未接入；当前页面不会创建 TutorSession 或学习证据。"
        title="AI 辅导"
      />
    );
  }

  if (view === "example" && featuredCourse !== undefined) {
    return <ExampleServiceUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />;
  }

  if (view === "lesson-complete" && featuredCourse !== undefined) {
    return (
      <Suspense fallback={<LoadingSurface />}>
        <LessonCompleteRoute courseId={featuredCourse.id} currentUser={currentUser} overviewUrl={overviewUrl} summaryUrl={summaryUrl} />
      </Suspense>
    );
  }

  if (view === "summary" && featuredCourse !== undefined) {
    return (
      <Suspense fallback={<LoadingSurface />}>
        <LessonSummaryRoute
          courseId={featuredCourse.id}
          currentUser={currentUser}
          overviewUrl={overviewUrl}
          practiceUrl={practiceUrl}
        />
      </Suspense>
    );
  }

  if (view === "knowledge-intro" && featuredCourse !== undefined) {
    return (
      <KnowledgeIntroRoute
        courseId={featuredCourse.id}
        currentUser={currentUser}
        overviewUrl={overviewUrl}
      />
    );
  }

  if (view === "practice" && featuredCourse !== undefined) {
    return (
      <PracticeRoute
        courseId={featuredCourse.id}
        currentUser={currentUser}
        knowledgeIntroUrl={knowledgeIntroUrl}
        overviewUrl={overviewUrl}
      />
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <Sidebar currentUser={currentUser} demoActive={catalog.source === "DEVELOPMENT_FIXTURE"} />

      <main className="paper-canvas" id="main-content">
        <header className="page-header">
          <div>
            <h1>课程与资料</h1>
            <p>循教材而进，依章节成章</p>
          </div>
          <div className="page-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}`}>
            <span>{dateTime.weekdayEnglish}</span>
            <strong>{dateTime.date}</strong>
            <small>{dateFootnote}</small>
          </div>
          <span className="page-header-rule" aria-hidden="true" />
        </header>

        <div className="content-grid">
          <section className="main-column" aria-labelledby="my-courses-title">
            <div className="section-title">
              <h2 id="my-courses-title">我的课程</h2>
              <span aria-hidden="true" />
            </div>

            {featuredCourse === undefined ? (
              <StatusPanel
                description="当前年级和学期还没有可展示的课程，请更换筛选条件。"
                title="暂无课程"
              />
            ) : (
              <CourseHero course={featuredCourse} onEnter={enterCourse} />
            )}

            <span className="content-divider" aria-hidden="true" />

            <div className="course-list-heading">
              <h2>全部课程</h2>
              <CourseFilters
                grade={grade}
                onGradeChange={(value) => { updateFilter("grade", String(value)); }}
                onTermChange={(value) => { updateFilter("term", value); }}
                term={term}
              />
            </div>

            <CourseTable courses={courses} onSelect={selectCourse} selectedSubject={selectedSubject} />
          </section>

          <RightRail
            catalog={catalog}
            expanded={recentExpanded}
            onExpandedChange={setRecentExpanded}
            onMaterialSelect={selectRecentMaterial}
            visibleCourses={courses}
          />
        </div>
      </main>

      {announcement === null ? null : (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{announcement}</span>
          <button aria-label="关闭提示" onClick={() => { setAnnouncement(null); }} type="button">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

function ReadyPage({
  catalogResult,
  currentUser,
}: {
  readonly catalogResult: CourseCatalogResult;
  readonly currentUser: CurrentUserResult;
}) {
  const [searchParams] = useSearchParams();
  if (catalogResult.status === "unavailable") {
    const requestedView = searchParams.get("view");
    if (
      requestedView === "knowledge-intro" ||
      requestedView === "example" ||
      requestedView === "practice" ||
      requestedView === "summary" ||
      requestedView === "lesson-complete" ||
      requestedView === "subject-detail" ||
      requestedView === "textbook-detail" ||
      requestedView === "chapter-detail" ||
      requestedView === "knowledge-point-detail" ||
      requestedView === "knowledge-point-target" ||
      requestedView === "question-hub" ||
      requestedView === "question-mode-target" ||
      requestedView === "text-question-composer" ||
      requestedView === "image-question-upload" ||
      requestedView === "ocr-confirmation" ||
      requestedView === "hint-first-tutor-session" ||
      requestedView === "tutor-session-result" ||
      requestedView === "practice-hub" ||
      requestedView === "practice-attempt" ||
      requestedView === "practice-result" ||
      requestedView === "wrong-book" ||
      requestedView === "wrong-item-detail" ||
      requestedView === "wrong-item-correction" ||
      requestedView === "scheduled-review-attempt" ||
      requestedView === "review-result" ||
      requestedView === "exam-list" ||
      requestedView === "exam-entry" ||
      requestedView === "exam-detail" ||
      requestedView === "exam-analysis" ||
      requestedView === "remediation-plan" ||
      requestedView === "mastery-overview" ||
      requestedView === "mastery-detail" ||
      requestedView === "student-profile" ||
      requestedView === "textbook-settings" ||
      requestedView === "study-time-preferences" ||
      requestedView === "family-privacy" ||
      requestedView === "ai-tutor"
    ) {
      const overviewParams = new URLSearchParams(searchParams);
      overviewParams.delete("view");
      overviewParams.delete("chapter");
      overviewParams.delete("knowledge");
      overviewParams.delete("target");
      overviewParams.delete("action");
      overviewParams.delete("mode");
      overviewParams.delete("draft");
      overviewParams.delete("session");
      overviewParams.delete("attempt");
      overviewParams.delete("review");
      overviewParams.delete("wrongStatus");
      overviewParams.delete("wrongSubject");
      overviewParams.delete("wrongSort");
      overviewParams.delete("wrongItem");
      overviewParams.delete("exam");
      overviewParams.delete("analysis");
      overviewParams.delete("plan");
      overviewParams.delete("examStatus");
      overviewParams.delete("examSubject");
      overviewParams.delete("examSort");
      overviewParams.delete("masteryStatus");
      overviewParams.delete("profileAction");
      const overviewQuery = overviewParams.toString();
      const overviewUrl = overviewQuery.length === 0 ? "/student/learn" : `/student/learn?${overviewQuery}`;
      return requestedView === "example"
        ? <ExampleServiceUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />
        : requestedView === "practice"
          ? <PracticeServiceUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />
        : requestedView === "practice-hub"
          ? (
            <PracticeHubServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的练习推荐服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="练习中心"
            />
          )
        : requestedView === "practice-attempt"
          ? (
            <PracticeAttemptServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的练习作答服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="独立练习"
            />
          )
        : requestedView === "practice-result"
          ? (
            <PracticeResultServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的练习结果服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="练习结果"
            />
          )
        : requestedView === "wrong-book"
          ? (
            <WrongBookServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的错题本服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="错题本"
            />
          )
        : requestedView === "wrong-item-detail"
          ? (
            <WrongItemDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的错题详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="错题详情"
            />
          )
        : requestedView === "wrong-item-correction"
          ? (
            <WrongItemCorrectionServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的错题订正服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="错题订正"
            />
          )
        : requestedView === "scheduled-review-attempt"
          ? (
            <ScheduledReviewAttemptServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的到期复习作答服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="到期复习"
            />
          )
        : requestedView === "review-result"
          ? (
            <ReviewResultServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的复习结果服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="复习结果"
            />
          )
        : requestedView === "exam-list"
          ? (
            <ExamListServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的考试列表服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="考试记录"
            />
          )
        : requestedView === "exam-entry"
          ? (
            <ExamEntryServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的考试录入服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="考试录入"
            />
          )
        : requestedView === "exam-detail"
          ? (
            <ExamDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的考试详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="考试详情"
            />
          )
        : requestedView === "exam-analysis"
          ? (
            <ExamAnalysisServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的考试分析服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="考试分析"
            />
          )
        : requestedView === "remediation-plan"
          ? (
            <RemediationPlanServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的补救计划服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="补救计划"
            />
          )
        : requestedView === "mastery-overview"
          ? (
            <MasteryOverviewServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的掌握证据服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="掌握概览"
            />
          )
        : requestedView === "mastery-detail"
          ? (
            <MasteryDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的知识点掌握详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="知识点掌握详情"
            />
          )
        : requestedView === "student-profile"
          ? (
            <StudentProfileServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的学生个人资料服务时，页面只显示服务边界，不打包开发 Fixture，也不新增 /student/profile 路由。"
              title="学生个人资料"
            />
          )
        : requestedView === "textbook-settings"
          ? (
            <TextbookSettingsServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的教材设置服务时，页面只显示服务边界，不打包开发 Fixture，也不新增 /student/settings/textbooks 路由。"
              title="教材设置"
            />
          )
        : requestedView === "study-time-preferences"
          ? (
            <StudyTimePreferencesServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的学习时间偏好服务时，页面只显示服务边界，不打包开发 Fixture，也不新增 /student/settings/study-time 路由。"
              title="学习时间偏好"
            />
          )
        : requestedView === "family-privacy"
          ? (
            <FamilyPrivacyServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的家庭与隐私服务时，页面只显示服务边界，不打包开发 Fixture，也不新增 /student/settings/family-privacy 路由。"
              title="家庭与隐私"
            />
          )
        : requestedView === "question-hub" || requestedView === "question-mode-target"
          ? (
            <QuestionHubServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的提问中心服务时，页面只显示服务边界，不打包开发 Fixture。"
              title={requestedView === "question-hub" ? "提问中心" : "提问方式"}
            />
          )
        : requestedView === "text-question-composer"
          ? (
            <TextQuestionComposerServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的文字提问服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="文字提问"
            />
          )
        : requestedView === "image-question-upload"
          ? (
            <ImageQuestionUploadServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的单题图片上传服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="单题图片上传"
            />
          )
        : requestedView === "ocr-confirmation"
          ? (
            <OcrConfirmationServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的 OCR 确认服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="OCR 结果确认"
            />
          )
        : requestedView === "hint-first-tutor-session"
          ? (
            <TutorSessionServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的提示优先辅导服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="提示优先辅导"
            />
          )
        : requestedView === "tutor-session-result"
          ? (
            <TutorResultServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的辅导结果服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="辅导结果"
            />
          )
        : requestedView === "lesson-complete"
          ? <Suspense fallback={<LoadingSurface />}><LessonCompleteServiceUnavailable currentUser={currentUser} overviewUrl={overviewUrl} /></Suspense>
        : requestedView === "summary"
          ? <Suspense fallback={<LoadingSurface />}><LessonSummaryServiceUnavailable currentUser={currentUser} overviewUrl={overviewUrl} /></Suspense>
          : requestedView === "textbook-detail"
          ? (
            <TextbookDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的教材详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="教材详情"
            />
          )
          : requestedView === "knowledge-point-detail" || requestedView === "knowledge-point-target"
          ? (
            <KnowledgePointDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的知识点详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title={requestedView === "knowledge-point-detail" ? "知识点详情" : "知识点目标"}
            />
          )
          : requestedView === "chapter-detail"
          ? (
            <ChapterDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的章节详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="章节详情"
            />
          )
          : requestedView === "subject-detail" || requestedView === "ai-tutor"
          ? (
            <SubjectDetailServiceUnavailable
              currentUser={currentUser}
              overviewUrl={overviewUrl}
              subtitle="生产环境没有可用的课程详情服务时，页面只显示服务边界，不打包开发 Fixture。"
              title="课程详情服务暂时不可用"
            />
          )
          : <KnowledgeIntroServiceUnavailable currentUser={currentUser} overviewUrl={overviewUrl} />;
    }
    const unavailableCopy = {
      NOT_AUTHENTICATED: ["需要登录学生账号", "请先建立学生会话，再读取本人教材上下文。生产环境不会显示虚构课程。"],
      STUDENT_ROLE_REQUIRED: ["当前账号不是学生账号", "课程与资料页按学生 OWN 边界读取；家长和管理员账号不会在这里代入学生身份。"],
      COURSE_SERVICE_UNAVAILABLE: ["课程数据暂时不可用", "学生身份已识别，但教材上下文接口当前无法完成读取。请检查 API 与数据库状态后重试。"],
    } as const;
    const [title, description] = unavailableCopy[catalogResult.reason];
    return (
      <div className="app-shell">
        <Sidebar currentUser={currentUser} demoActive={false} />
        <main className="paper-canvas service-state-page" id="main-content">
          <header className="page-header compact">
            <div>
              <h1>课程与资料</h1>
              <p>循教材而进，依章节成章</p>
            </div>
            <span className="page-header-rule" aria-hidden="true" />
          </header>
          <StatusPanel
            actionLabel={catalogResult.reason === "NOT_AUTHENTICATED" ? "前往登录" : "重新加载"}
            description={description}
            onAction={() => {
              if (catalogResult.reason === "NOT_AUTHENTICATED") window.location.assign("/login");
              else window.location.reload();
            }}
            title={title}
          />
        </main>
      </div>
    );
  }

  return <CourseMaterialsView catalog={catalogResult.catalog} currentUser={currentUser} />;
}

export function CourseMaterialsPage() {
  const [searchParams] = useSearchParams();
  const knowledgeIntroActive = searchParams.get("view") === "knowledge-intro";
  const practiceActive = searchParams.get("view") === "practice";
  const exampleActive = searchParams.get("view") === "example";
  const summaryActive = searchParams.get("view") === "summary";
  const lessonCompleteActive = searchParams.get("view") === "lesson-complete";
  const subjectDetailActive = searchParams.get("view") === "subject-detail";
  const textbookDetailActive = searchParams.get("view") === "textbook-detail";
  const chapterDetailActive = searchParams.get("view") === "chapter-detail";
  const knowledgePointDetailActive = searchParams.get("view") === "knowledge-point-detail";
  const knowledgePointTargetActive = searchParams.get("view") === "knowledge-point-target";
  const questionHubActive = searchParams.get("view") === "question-hub";
  const questionModeTargetActive = searchParams.get("view") === "question-mode-target";
  const textQuestionActive = searchParams.get("view") === "text-question-composer";
  const imageQuestionActive = searchParams.get("view") === "image-question-upload";
  const ocrConfirmationActive = searchParams.get("view") === "ocr-confirmation";
  const hintFirstTutorActive = searchParams.get("view") === "hint-first-tutor-session";
  const tutorResultActive = searchParams.get("view") === "tutor-session-result";
  const practiceHubActive = searchParams.get("view") === "practice-hub";
  const practiceAttemptActive = searchParams.get("view") === "practice-attempt";
  const practiceResultActive = searchParams.get("view") === "practice-result";
  const wrongBookActive = searchParams.get("view") === "wrong-book";
  const wrongItemDetailActive = searchParams.get("view") === "wrong-item-detail";
  const wrongItemCorrectionActive = searchParams.get("view") === "wrong-item-correction";
  const scheduledReviewAttemptActive = searchParams.get("view") === "scheduled-review-attempt";
  const reviewResultActive = searchParams.get("view") === "review-result";
  const examListActive = searchParams.get("view") === "exam-list";
  const examEntryActive = searchParams.get("view") === "exam-entry";
  const examDetailActive = searchParams.get("view") === "exam-detail";
  const examAnalysisActive = searchParams.get("view") === "exam-analysis";
  const remediationPlanActive = searchParams.get("view") === "remediation-plan";
  const masteryOverviewActive = searchParams.get("view") === "mastery-overview";
  const masteryDetailActive = searchParams.get("view") === "mastery-detail";
  const studentProfileActive = searchParams.get("view") === "student-profile";
  const textbookSettingsActive = searchParams.get("view") === "textbook-settings";
  const studyTimePreferencesActive = searchParams.get("view") === "study-time-preferences";
  const familyPrivacyActive = searchParams.get("view") === "family-privacy";
  useDocumentMetadata(
    lessonCompleteActive
      ? "本课完成 · 清朗学习系统"
      : studentProfileActive
      ? "学生个人资料 · 清朗学习系统"
      : textbookSettingsActive
      ? "教材设置 · 清朗学习系统"
      : studyTimePreferencesActive
      ? "学习时间偏好 · 清朗学习系统"
      : familyPrivacyActive
      ? "家庭与隐私 · 清朗学习系统"
      : masteryDetailActive
      ? "知识点掌握详情 · 清朗学习系统"
      : masteryOverviewActive
      ? "掌握概览 · 清朗学习系统"
      : remediationPlanActive
      ? "补救计划 · 清朗学习系统"
      : examAnalysisActive
      ? "考试分析 · 清朗学习系统"
      : examDetailActive
      ? "考试详情 · 清朗学习系统"
      : examEntryActive
      ? "考试录入 · 清朗学习系统"
      : examListActive
      ? "考试记录 · 清朗学习系统"
      : reviewResultActive
      ? "复习结果 · 清朗学习系统"
      : scheduledReviewAttemptActive
      ? "到期复习 · 清朗学习系统"
      : wrongItemCorrectionActive
      ? "错题订正 · 清朗学习系统"
      : wrongItemDetailActive
      ? "错题详情 · 清朗学习系统"
      : wrongBookActive
      ? "错题本 · 清朗学习系统"
      : practiceResultActive
      ? "练习结果 · 清朗学习系统"
      : practiceAttemptActive
      ? "独立练习 · 清朗学习系统"
      : practiceHubActive
      ? "练习中心 · 清朗学习系统"
      : tutorResultActive
      ? "辅导结果 · 清朗学习系统"
      : hintFirstTutorActive
      ? "提示优先辅导 · 清朗学习系统"
      : ocrConfirmationActive
      ? "确认识别题面 · 清朗学习系统"
      : imageQuestionActive
      ? "单题图片上传 · 清朗学习系统"
      : textQuestionActive
      ? "文字提问 · 清朗学习系统"
      : questionHubActive || questionModeTargetActive
      ? "提问中心 · 清朗学习系统"
      : knowledgePointDetailActive || knowledgePointTargetActive
      ? "知识点详情 · 清朗学习系统"
      : chapterDetailActive
      ? "21.2 课时详情 · 清朗学习系统"
      : textbookDetailActive
      ? "数学教材详情 · 清朗学习系统"
      : subjectDetailActive
      ? "数学课程详情 · 清朗学习系统"
      : exampleActive
      ? "例题讲解 · 清朗学习系统"
      : summaryActive
      ? "归纳总结 · 清朗学习系统"
      : practiceActive
      ? "随堂练习 · 清朗学习系统"
      : knowledgeIntroActive
        ? "知识导入 · 清朗学习系统"
        : "课程与资料 · 清朗学习系统",
    lessonCompleteActive
      ? "清朗学习系统课时完成页面，用于回看当前演示会话的流程、归纳、练习和待确认状态。"
      : studentProfileActive
      ? "清朗学习系统学生个人资料页面，用于核对本人正式资料、编辑允许自助设置的字段，并明确资料服务、纠错和隐私边界。"
      : textbookSettingsActive
      ? "清朗学习系统教材设置页面，用于查看本人启用学科的教材状态、提交真实封面与目录材料，并明确核验、上传、家庭隔离和未接入边界。"
      : studyTimePreferencesActive
      ? "清朗学习系统学习时间偏好页面，用于设置本人建议排序、提醒和预计任务用时，并明确不作为在线时长目标、任务权限或完成证据。"
      : familyPrivacyActive
      ? "清朗学习系统家庭与隐私页面，用于查看只读家庭关系、家庭可见聚合范围和本人私密资产删除请求边界。"
      : masteryDetailActive
      ? "清朗学习系统知识点掌握详情边界页面，用于保留服务端 knowledgePointId 且不伪造掌握证据。"
      : masteryOverviewActive
      ? "清朗学习系统掌握概览页面，用于查看本人知识点证据、覆盖期与可解释阶段判断，并明确不使用排名、百分比或雷达图。"
      : remediationPlanActive
      ? "清朗学习系统补救计划页面，用于按已确认失分与基础依赖逐项完成本人补救任务，并明确完成事件、版本重算和掌握证据边界。"
      : examAnalysisActive
      ? "清朗学习系统考试分析页面，用于展示本人已确认失分项的可追溯归因、可靠性、数据边界和补救顺序。"
      : examDetailActive
      ? "清朗学习系统考试详情页面，用于展示本人确认的考试事实、失分项、记录版本和分析入口，并明确详情不可用边界。"
      : examEntryActive
      ? "清朗学习系统考试录入页面，用于手工记录本人确认的考试事实、评分量尺和逐条失分项，并明确保存结果未知边界。"
      : examListActive
      ? "清朗学习系统考试记录页面，用于查看本人手工确认的考试事实、录入完整度和分析状态边界。"
      : reviewResultActive
      ? "清朗学习系统复习结果页面，用于展示服务端确认后的本条错题恢复证据，并说明一次复习不会直接建立永久掌握。"
      : scheduledReviewAttemptActive
      ? "清朗学习系统到期复习作答页面，用于在服务端确认到期后完成同知识点新变式独立作答，并在提交前保护旧答案。"
      : wrongItemCorrectionActive
      ? "清朗学习系统错题订正页面，用于重新独立作答、说明错因、确认提交边界，并明确订正通过不等于已恢复或已掌握。"
      : wrongItemDetailActive
      ? "清朗学习系统错题详情页面，用于只读查看本人错题事实、原答、错因、来源证据和订正入口边界。"
      : wrongBookActive
      ? "清朗学习系统错题本页面，用于按订正、到期复习和已恢复状态整理本人错题摘要。"
      : practiceResultActive
      ? "清朗学习系统练习结果页面，用于展示服务端确认的判题、错因、错题创建和证据边界。"
      : practiceAttemptActive
      ? "清朗学习系统独立练习作答页面，用于完成服务端确认的最后一题草稿、提交确认和结果未知边界。"
      : practiceHubActive
      ? "清朗学习系统练习中心页面，用于聚合当前知识点独立练习和到期错题恢复，并在真实推荐服务接入前显示边界。"
      : tutorResultActive
      ? "清朗学习系统辅导结果页面，用于区分提示后理解、独立作答证据和掌握证据边界。"
      : hintFirstTutorActive
      ? "清朗学习系统提示优先辅导页面，用于在真实辅导服务接入前展示首提示、学生回答和服务边界。"
      : ocrConfirmationActive
      ? "清朗学习系统 OCR 结果确认页面，用于对照原图修正低置信识别片段，并在真实服务接入前显示边界。"
      : imageQuestionActive
      ? "清朗学习系统单题图片上传页面，用于在已确认学习上下文内选择一张单题图片、确认范围并显示上传服务边界。"
      : textQuestionActive
      ? "清朗学习系统文字提问页面，用于在已确认学习上下文内填写问题、尝试步骤和隐私确认。"
      : questionHubActive
      ? "清朗学习系统提问中心页面，用于确认学习上下文并选择文字或单题图片提问方式。"
      : questionModeTargetActive
      ? "清朗学习系统提问方式服务边界页面，用于保留下游目标上下文且不创建 AI 会话。"
      : knowledgePointDetailActive
      ? "清朗学习系统知识点详情页面，用于查看受控知识点解释、数学图像和服务边界。"
      : knowledgePointTargetActive
      ? "清朗学习系统知识点目标服务边界页面，用于保留下游目标上下文且不伪造练习或证据。"
      : chapterDetailActive
      ? "清朗学习系统章节详情页面，用于查看章节说明、知识点顺序、内容依据和服务边界。"
      : textbookDetailActive
      ? "清朗学习系统数学教材详情页面，用于只读查看服务端确认的教材目录、核验状态和隐私边界。"
      : subjectDetailActive
      ? "清朗学习系统数学学科详情页面，用于查看章节目录、本章资料和服务边界。"
      : exampleActive
      ? "清朗学习系统例题讲解服务边界页面，用于保留合法课程上下文且不伪造进度。"
      : summaryActive
      ? "清朗学习系统课时归纳总结页面，用于学生以自己的话整理可复习的方法。"
      : practiceActive
      ? "清朗学习系统随堂练习页面，用于独立作答、提示分层与提交后的本地演示校验。"
      : knowledgeIntroActive
      ? "清朗学习系统知识导入页面，用于回顾前置知识并完成理解检查。"
      : "清朗学习系统课程与资料页面，用于查找课程、教材与最近学习资料。",
  );
  const state = useCourseMaterialsPageData();

  if (state.status === "loading") {
    return <LoadingSurface />;
  }
  if (state.status === "error") {
    return (
      <div className="service-state-page standalone">
        <StatusPanel
          actionLabel="重新加载"
          description="页面数据初始化失败。请检查本地环境后重试。"
          onAction={() => { window.location.reload(); }}
          title="无法加载课程与资料"
          tone="error"
        />
      </div>
    );
  }

  return <ReadyPage catalogResult={state.catalogResult} currentUser={state.currentUser} />;
}
