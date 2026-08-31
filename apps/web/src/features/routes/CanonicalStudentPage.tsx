import { lazy, Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";

const CourseMaterialsPage = lazy(async () => ({ default: (await import("../course-materials/CourseMaterialsPage")).CourseMaterialsPage }));
const StudentHomePage = lazy(async () => ({ default: (await import("../student-home/StudentHomePage")).StudentHomePage }));

export interface CanonicalQueryMapping {
  readonly query: string;
  readonly routeParam?: string;
  readonly value?: string;
}

export interface CanonicalStudentPageProps {
  readonly surface: "today" | "learn";
  readonly view: string;
  readonly mappings?: readonly CanonicalQueryMapping[];
}

export function CanonicalStudentPage({ surface, view, mappings = [] }: CanonicalStudentPageProps) {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const ready = searchParams.get("view") === view;

  useEffect(() => {
    if (ready) return;
    const next = new URLSearchParams(searchParams);
    next.set("view", view);
    for (const mapping of mappings) {
      const value = mapping.routeParam === undefined ? mapping.value : params[mapping.routeParam];
      if (value !== undefined) next.set(mapping.query, value);
    }
    setSearchParams(next, { replace: true });
  }, [mappings, params, ready, searchParams, setSearchParams, view]);

  if (!ready) return <main className="page-loading standalone" aria-label="正在打开页面" role="status" />;
  return <Suspense fallback={<main className="page-loading standalone" aria-label="正在加载页面" role="status" />}>
    {surface === "today" ? <StudentHomePage /> : <CourseMaterialsPage />}
  </Suspense>;
}
