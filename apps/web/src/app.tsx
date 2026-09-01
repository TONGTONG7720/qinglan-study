import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useSearchParams } from "react-router-dom";

import { ReleaseScopeProvider, runtimeReleaseScope } from "./config/release-scope";
import type { ReleaseScope } from "./config/release-scope-policy";
import { LoginPage } from "./features/auth/LoginPage";
import { CanonicalStudentPage, type CanonicalStudentPageProps } from "./features/routes/CanonicalStudentPage";
import { PlannedSurfacePage, type PlannedRole } from "./features/routes/PlannedSurfacePage";
import { RequestRecoveryCoordinator } from "./features/system/RequestRecoveryCoordinator";
import { RequestRecoveryPage } from "./features/system/RequestRecoveryPage";
import { GlobalErrorBoundary, SystemStatePage } from "./features/system/SystemStatePage";

const StudentHomePage = lazy(async () => ({ default: (await import("./features/student-home/StudentHomePage")).StudentHomePage }));
const CourseMaterialsPage = lazy(async () => ({ default: (await import("./features/course-materials/CourseMaterialsPage")).CourseMaterialsPage }));

interface PlannedRouteSpec { readonly path: string; readonly pageId: string; readonly role: PlannedRole; readonly title: string; }

const plannedRoutes: readonly PlannedRouteSpec[] = [
  { pageId: "AUTH-002", path: "/invite/validate", role: "AUTH", title: "家长邀请验证" },
  { pageId: "AUTH-003", path: "/register/guardian", role: "AUTH", title: "家长注册" },
  { pageId: "AUTH-004", path: "/onboarding/family", role: "AUTH", title: "创建家庭" },
  { pageId: "AUTH-005", path: "/onboarding/student", role: "AUTH", title: "创建学生账号" },
  { pageId: "AUTH-006", path: "/student/first-sign-in", role: "AUTH", title: "学生首次登录确认" },
  { pageId: "AUTH-007", path: "/account/security", role: "AUTH", title: "密码修改与找回" },
  { pageId: "PAR-001", path: "/guardian/overview", role: "GUARDIAN", title: "家长概览" },
  { pageId: "PAR-002", path: "/guardian/students/:studentId/profile", role: "GUARDIAN", title: "学生资料详情" },
  { pageId: "PAR-003", path: "/guardian/students/:studentId/learning-status", role: "GUARDIAN", title: "学习状态" },
  { pageId: "PAR-004", path: "/guardian/students/:studentId/subjects/:subjectCode/trend", role: "GUARDIAN", title: "学科趋势详情" },
  { pageId: "PAR-005", path: "/guardian/students/:studentId/weak-knowledge/:knowledgePointId", role: "GUARDIAN", title: "薄弱知识点详情" },
  { pageId: "PAR-006", path: "/guardian/students/:studentId/plans", role: "GUARDIAN", title: "学习计划列表" },
  { pageId: "PAR-007", path: "/guardian/students/:studentId/plans/:planId", role: "GUARDIAN", title: "学习计划详情" },
  { pageId: "PAR-008", path: "/guardian/students/:studentId/exams", role: "GUARDIAN", title: "考试列表" },
  { pageId: "PAR-009", path: "/guardian/students/:studentId/exams/:examId", role: "GUARDIAN", title: "考试详情" },
  { pageId: "PAR-010", path: "/guardian/students/:studentId/exams/:examId/analysis", role: "GUARDIAN", title: "考试分析" },
  { pageId: "PAR-011", path: "/guardian/students/:studentId/weekly-reports", role: "GUARDIAN", title: "周报列表" },
  { pageId: "PAR-012", path: "/guardian/students/:studentId/weekly-reports/:reportId", role: "GUARDIAN", title: "周报详情" },
  { pageId: "PAR-013", path: "/guardian/family/settings", role: "GUARDIAN", title: "家庭设置" },
  { pageId: "PAR-014", path: "/guardian/family/members", role: "GUARDIAN", title: "家庭成员列表" },
  { pageId: "PAR-015", path: "/guardian/family/members/:memberId", role: "GUARDIAN", title: "家庭成员详情" },
  { pageId: "PAR-016", path: "/guardian/family/ai-usage-budget", role: "GUARDIAN", title: "AI 使用与预算" },
  { pageId: "PAR-017", path: "/guardian/family/data-privacy", role: "GUARDIAN", title: "数据与隐私" },
  { pageId: "PAR-018", path: "/guardian/family/exports/:exportRequestId", role: "GUARDIAN", title: "数据导出状态" },
  { pageId: "PAR-019", path: "/guardian/family/deletion", role: "GUARDIAN", title: "家庭删除流程" },
  { pageId: "ADM-001", path: "/admin/overview", role: "ADMIN", title: "管理概览" },
  { pageId: "ADM-002", path: "/admin/invitations", role: "ADMIN", title: "邀请列表" },
  { pageId: "ADM-003", path: "/admin/invitations/:invitationId", role: "ADMIN", title: "邀请详情" },
  { pageId: "ADM-003", path: "/admin/invitations/prevalidation/:joinAuthorizationId", role: "ADMIN", title: "邀请预校验详情" },
  { pageId: "ADM-004", path: "/admin/users", role: "ADMIN", title: "用户列表" },
  { pageId: "ADM-005", path: "/admin/users/:userId", role: "ADMIN", title: "用户详情" },
  { pageId: "ADM-006", path: "/admin/families", role: "ADMIN", title: "家庭列表" },
  { pageId: "ADM-007", path: "/admin/families/:familyId", role: "ADMIN", title: "家庭详情" },
  { pageId: "ADM-008", path: "/admin/textbooks", role: "ADMIN", title: "教材列表" },
  { pageId: "ADM-009", path: "/admin/textbooks/:textbookIdOrNew/edit", role: "ADMIN", title: "教材新建或编辑" },
  { pageId: "ADM-010", path: "/admin/textbooks/:textbookId", role: "ADMIN", title: "教材详情" },
  { pageId: "ADM-011", path: "/admin/textbooks/:textbookId/curriculum", role: "ADMIN", title: "课程内容树" },
  { pageId: "ADM-012", path: "/admin/textbooks/:textbookId/chapters/:chapterId/edit", role: "ADMIN", title: "章节详情或编辑" },
  { pageId: "ADM-013", path: "/admin/textbooks/:textbookId/knowledge-points/:knowledgePointId/edit", role: "ADMIN", title: "知识点详情或编辑" },
  { pageId: "ADM-014", path: "/admin/textbooks/:textbookId/content/:contentIdOrNew/edit", role: "ADMIN", title: "课程内容编辑器" },
  { pageId: "ADM-015", path: "/admin/model/budget-settings", role: "ADMIN", title: "模型预算设置" },
  { pageId: "ADM-016", path: "/admin/model/usage/:familyMonthId", role: "ADMIN", title: "模型使用详情" },
  { pageId: "ADM-017", path: "/admin/ai-error-cases", role: "ADMIN", title: "AI 错误案例列表" },
  { pageId: "ADM-018", path: "/admin/ai-error-cases/:caseId", role: "ADMIN", title: "AI 错误案例详情" },
  { pageId: "ADM-019", path: "/admin/deletion-jobs", role: "ADMIN", title: "删除作业列表" },
  { pageId: "ADM-020", path: "/admin/deletion-jobs/:jobId", role: "ADMIN", title: "删除作业详情" },
];

interface StudentRouteSpec extends CanonicalStudentPageProps { readonly path: string; }

const studentRoutes: readonly StudentRouteSpec[] = [
  { path: "/student/today/tasks/:taskId", surface: "today", view: "task-detail", mappings: [{ query: "task", routeParam: "taskId" }] },
  { path: "/student/plans", surface: "today", view: "plans" },
  { path: "/student/plans/:planId", surface: "today", view: "plan-detail", mappings: [{ query: "plan", routeParam: "planId" }] },
  { path: "/student/learn/subjects/:subjectCode", surface: "learn", view: "subject-detail", mappings: [{ query: "subject", routeParam: "subjectCode" }] },
  { path: "/student/learn/subjects/:subjectCode/textbook", surface: "learn", view: "textbook-detail", mappings: [{ query: "subject", routeParam: "subjectCode" }] },
  { path: "/student/learn/subjects/:subjectCode/chapters/:chapterId", surface: "learn", view: "chapter-detail", mappings: [{ query: "subject", routeParam: "subjectCode" }, { query: "chapter", routeParam: "chapterId" }] },
  { path: "/student/learn/subjects/:subjectCode/chapters/:chapterId/knowledge-points/:knowledgePointId", surface: "learn", view: "knowledge-point-detail", mappings: [{ query: "subject", routeParam: "subjectCode" }, { query: "chapter", routeParam: "chapterId" }, { query: "knowledge", routeParam: "knowledgePointId" }] },
  { path: "/student/questions", surface: "learn", view: "question-hub" },
  { path: "/student/questions/new/text", surface: "learn", view: "text-question-composer" },
  { path: "/student/questions/new/image", surface: "learn", view: "image-question-upload" },
  { path: "/student/questions/:questionDraftId/ocr-confirmation", surface: "learn", view: "ocr-confirmation", mappings: [{ query: "draft", routeParam: "questionDraftId" }] },
  { path: "/student/tutor/sessions/:tutorSessionId", surface: "learn", view: "hint-first-tutor-session", mappings: [{ query: "session", routeParam: "tutorSessionId" }] },
  { path: "/student/tutor/sessions/:tutorSessionId/result", surface: "learn", view: "tutor-session-result", mappings: [{ query: "session", routeParam: "tutorSessionId" }] },
  { path: "/student/practice", surface: "learn", view: "practice-hub" },
  { path: "/student/practice/attempts/:attemptId", surface: "learn", view: "practice-attempt", mappings: [{ query: "attempt", routeParam: "attemptId" }] },
  { path: "/student/practice/attempts/:attemptId/result", surface: "learn", view: "practice-result", mappings: [{ query: "attempt", routeParam: "attemptId" }] },
  { path: "/student/wrong-book", surface: "learn", view: "wrong-book" },
  { path: "/student/wrong-book/items/:wrongItemId", surface: "learn", view: "wrong-item-detail", mappings: [{ query: "wrongItem", routeParam: "wrongItemId" }] },
  { path: "/student/wrong-book/items/:wrongItemId/correction", surface: "learn", view: "wrong-item-correction", mappings: [{ query: "wrongItem", routeParam: "wrongItemId" }] },
  { path: "/student/reviews/:reviewId/attempt", surface: "learn", view: "scheduled-review-attempt", mappings: [{ query: "review", routeParam: "reviewId" }] },
  { path: "/student/reviews/:reviewId/result", surface: "learn", view: "review-result", mappings: [{ query: "review", routeParam: "reviewId" }] },
  { path: "/student/exams", surface: "learn", view: "exam-list" },
  { path: "/student/exams/new", surface: "learn", view: "exam-entry" },
  { path: "/student/exams/:examId", surface: "learn", view: "exam-detail", mappings: [{ query: "exam", routeParam: "examId" }] },
  { path: "/student/exams/:examId/analysis", surface: "learn", view: "exam-analysis", mappings: [{ query: "exam", routeParam: "examId" }] },
  { path: "/student/exams/:examId/remediation/:planId", surface: "learn", view: "remediation-plan", mappings: [{ query: "exam", routeParam: "examId" }, { query: "plan", routeParam: "planId" }] },
  { path: "/student/mastery", surface: "learn", view: "mastery-overview" },
  { path: "/student/mastery/:knowledgePointId", surface: "learn", view: "mastery-detail", mappings: [{ query: "knowledge", routeParam: "knowledgePointId" }] },
  { path: "/student/profile", surface: "learn", view: "student-profile" },
  { path: "/student/settings/textbooks", surface: "learn", view: "textbook-settings" },
  { path: "/student/settings/study-time", surface: "learn", view: "study-time-preferences" },
  { path: "/student/settings/family-privacy", surface: "learn", view: "family-privacy" },
];

const readOnlyBetaBoundaryPaths = [
  "/invite/*",
  "/register/*",
  "/onboarding/*",
  "/account/*",
  "/guardian/*",
  "/admin/*",
  "/student/*",
] as const;

function RouteLoading() { return <main className="page-loading standalone" aria-label="正在打开页面" role="status" />; }

function StudentSurface({
  releaseScope,
  surface,
}: {
  readonly releaseScope: ReleaseScope;
  readonly surface: "today" | "learn";
}) {
  const [searchParams] = useSearchParams();
  if (releaseScope === "READ_ONLY_BETA" && searchParams.has("view")) {
    return <SystemStatePage kind="limited-release" />;
  }
  return surface === "today" ? <StudentHomePage /> : <CourseMaterialsPage />;
}

function ApplicationRoutes({ releaseScope }: { readonly releaseScope: ReleaseScope }) {
  return <Routes>
    <Route element={<Navigate replace to={releaseScope === "READ_ONLY_BETA" ? "/login" : "/student/today"} />} path="/" />
    <Route element={<LoginPage />} path="/login" />
    <Route element={<RequestRecoveryPage kind="session-expired" />} path="/session-expired" />
    <Route element={<RequestRecoveryPage kind="offline" />} path="/offline" />
    <Route element={<RequestRecoveryPage kind="error" />} path="/error-recovery" />
    <Route element={<SystemStatePage kind="limited-release" />} path="/limited-release" />
    <Route element={<StudentSurface releaseScope={releaseScope} surface="today" />} path="/student/today" />
    <Route element={<StudentSurface releaseScope={releaseScope} surface="learn" />} path="/student/learn" />
    {releaseScope === "FULL_PREVIEW"
      ? studentRoutes.map(({ path, ...props }) => <Route key={path} element={<CanonicalStudentPage {...props} />} path={path} />)
      : readOnlyBetaBoundaryPaths.map((path) => <Route key={path} element={<SystemStatePage kind="limited-release" />} path={path} />)}
    {releaseScope === "FULL_PREVIEW"
      ? plannedRoutes.map((route) => <Route key={`${route.pageId}:${route.path}`} element={<PlannedSurfacePage pageId={route.pageId} role={route.role} title={route.title} />} path={route.path} />)
      : null}
    <Route element={<SystemStatePage kind="not-found" />} path="*" />
  </Routes>;
}

export interface AppProps {
  readonly releaseScope?: ReleaseScope;
}

export function App({ releaseScope = runtimeReleaseScope }: AppProps = {}) {
  return (
    <ReleaseScopeProvider scope={releaseScope}>
      <GlobalErrorBoundary>
        <RequestRecoveryCoordinator />
        <Suspense fallback={<RouteLoading />}>
          <ApplicationRoutes releaseScope={releaseScope} />
        </Suspense>
      </GlobalErrorBoundary>
    </ReleaseScopeProvider>
  );
}
