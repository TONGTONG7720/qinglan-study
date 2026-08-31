import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import type { CurrentUserResult } from "../../../api/auth";
import { Icon } from "../../../components/Icon";
import { Sidebar } from "../../../components/Sidebar";
import { StatusPanel } from "../../../components/StatusPanel";
import { useShanghaiDateTime } from "../use-shanghai-date-time";
import { LearningStepper } from "../LearningStepper";
import { FunctionPlot, FunctionValueTable } from "./FunctionPlot";
import { KnowledgeCheck } from "./KnowledgeCheck";
import { KnowledgeIntroRightRail } from "./KnowledgeIntroRightRail";
import type { KnowledgeIntroDocument } from "./types";
import { useKnowledgeIntro } from "./use-knowledge-intro";

export interface KnowledgeIntroRouteProps {
  readonly courseId: string;
  readonly currentUser: CurrentUserResult;
  readonly overviewUrl: string;
}

function KnowledgeIntroLoading({ currentUser }: { readonly currentUser: CurrentUserResult }) {
  return (
    <div className="app-shell knowledge-intro-shell">
      <Sidebar currentUser={currentUser} demoActive />
      <main className="knowledge-intro-canvas service-state-page" id="main-content">
        <div aria-label="正在加载知识导入" className="page-loading" role="status">
          <span className="skeleton-line skeleton-title" />
          <span className="skeleton-line skeleton-copy" />
          <span className="skeleton-line skeleton-divider" />
          <div className="skeleton-columns"><span /><span /></div>
        </div>
      </main>
    </div>
  );
}

function KnowledgeIntroUnavailable({
  currentUser,
  overviewUrl,
  fixtureMissing,
}: {
  readonly currentUser: CurrentUserResult;
  readonly overviewUrl: string;
  readonly fixtureMissing: boolean;
}) {
  return (
    <div className="app-shell knowledge-intro-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive={false} />
      <main className="knowledge-intro-canvas service-state-page" id="main-content">
        <header className="page-header compact">
          <div><h1>知识导入</h1><p>在课程与资料中完成学习前的知识回顾</p></div>
          <span aria-hidden="true" className="page-header-rule" />
        </header>
        <StatusPanel
          description={fixtureMissing
            ? "当前开发 Fixture 只覆盖数学示例。其他课程不会复用不匹配的题目或教材内容。"
            : "当前没有知识导入正文、答题、笔记或证据的生产聚合接口。页面不会用开发 Fixture 冒充生产内容。"}
          title={fixtureMissing ? "该课程没有知识导入演示" : "知识导入服务尚未接入"}
        />
        <Link className="knowledge-back-link" to={overviewUrl}>返回课程与资料</Link>
      </main>
    </div>
  );
}

export function KnowledgeIntroServiceUnavailable({
  currentUser,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly overviewUrl: string;
}) {
  return (
    <KnowledgeIntroUnavailable
      currentUser={currentUser}
      fixtureMissing={false}
      overviewUrl={overviewUrl}
    />
  );
}

function PreviousKnowledgeTable({ document }: { readonly document: KnowledgeIntroDocument }) {
  return (
    <table className="previous-knowledge-table" data-od-id="knowledge-prior-table">
      <caption className="sr-only">知识导入所需的前置知识</caption>
      <tbody>
        {document.priorKnowledge.map((item) => (
          <tr key={item.term}><th scope="row">{item.term}</th><td>{item.explanation}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function ProcessFlow({ steps }: { readonly steps: readonly string[] }) {
  return (
    <ol className="mini-process-flow" data-od-id="knowledge-process-flow" aria-label="描点法步骤">
      {steps.map((step, index) => (
        <li key={step}>
          <span>{index + 1}</span>
          <strong>{step}</strong>
        </li>
      ))}
    </ol>
  );
}

function KnowledgeIntroReady({
  currentUser,
  document,
  overviewUrl,
}: {
  readonly currentUser: CurrentUserResult;
  readonly document: KnowledgeIntroDocument;
  readonly overviewUrl: string;
}) {
  const dateTime = useShanghaiDateTime();
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (announcement === null) return undefined;
    const timer = window.setTimeout(() => { setAnnouncement(null); }, 4_000);
    return () => { window.clearTimeout(timer); };
  }, [announcement]);

  function announceUnavailable(label: string): void {
    setAnnouncement(`${label}尚未接入；当前知识导入状态没有写入生产数据。`);
  }

  return (
    <div className="app-shell knowledge-intro-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <Sidebar currentUser={currentUser} demoActive />

      <main className="knowledge-intro-canvas" data-od-id="knowledge-intro-page" id="main-content">
        <div className="knowledge-intro-page">
          <header className="knowledge-intro-header">
            <nav aria-label="面包屑" className="knowledge-breadcrumb" data-od-id="knowledge-breadcrumb">
              <Link to={overviewUrl}>课程与资料</Link><Icon name="chevronRight" size={16} />
              <span>{document.subjectLabel}</span><Icon name="chevronRight" size={16} />
              <span aria-current="page">知识导入</span>
            </nav>
            <div className="knowledge-title-row">
              <div>
                <h1>{document.title}</h1>
                <p>{document.subtitle}</p>
                <span className="fixture-badge">Fixture 演示</span>
              </div>
              <div className="knowledge-date" aria-label={`${dateTime.date}，${dateTime.weekdayChinese}`}>
                <strong>{dateTime.date}</strong>
                <span>{dateTime.weekdayChinese} · Asia/Shanghai</span>
                <small>实时日期 · 学习内容为虚构演示</small>
              </div>
            </div>
          </header>

          <LearningStepper
            currentStepNumber={1}
            estimatedMinutes={document.estimatedMinutes}
            odId="knowledge-stepper"
            onStepActivate={(step) => { announceUnavailable(step.label); }}
            steps={document.steps}
          />

          <div className="knowledge-intro-layout">
            <article className="knowledge-main-column" aria-labelledby="knowledge-main-title">
              <header className="knowledge-section-intro">
                <h2 id="knowledge-main-title">知识导入</h2>
                <h3>从函数到图像</h3>
                <p>函数关系可以通过解析式、表格和图像表达。学习时先回顾坐标系与描点方法。</p>
              </header>

              <section className="knowledge-review" data-od-id="knowledge-review" aria-labelledby="knowledge-review-title">
                <h3 id="knowledge-review-title">前置知识回顾</h3>
                <div><PreviousKnowledgeTable document={document} /><ProcessFlow steps={document.processSteps} /></div>
              </section>

              <section className="function-study" data-od-id="knowledge-function-study" aria-labelledby="function-study-title">
                <h3 id="function-study-title">观察函数 · {document.functionStudy.formula}</h3>
                <div className="function-study-grid">
                  <FunctionPlot formula={document.functionStudy.formula} points={document.functionStudy.points} />
                  <div>
                    <FunctionValueTable formula={document.functionStudy.formula} points={document.functionStudy.points} />
                    <aside className="explanation-note"><p>{document.functionStudy.explanation}</p></aside>
                  </div>
                </div>
              </section>

              <KnowledgeCheck check={document.check} />

              <footer className="knowledge-actions">
                <button
                  className="primary-button"
                  data-od-id="knowledge-complete-intro"
                  onClick={() => { announceUnavailable("例题讲解"); }}
                  type="button"
                >
                  <span>完成知识导入，进入例题讲解</span><Icon name="arrowRight" size={18} />
                </button>
                <Link className="knowledge-back-link" data-od-id="knowledge-back-course" to={overviewUrl}>
                  <span>返回课程详情</span><Icon name="arrowRight" size={16} />
                </Link>
              </footer>
            </article>

            <span aria-hidden="true" className="knowledge-rail-divider" />
            <KnowledgeIntroRightRail document={document} />
          </div>
        </div>
      </main>

      {announcement === null ? null : (
        <div className="toast" role="status">
          <Icon name="info" size={18} /><span>{announcement}</span>
          <button aria-label="关闭提示" onClick={() => { setAnnouncement(null); }} type="button">
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

export function KnowledgeIntroRoute({ courseId, currentUser, overviewUrl }: KnowledgeIntroRouteProps) {
  const state = useKnowledgeIntro(courseId);
  if (state.status === "loading") return <KnowledgeIntroLoading currentUser={currentUser} />;
  if (state.status === "error") {
    return (
      <div className="app-shell knowledge-intro-shell">
        <Sidebar currentUser={currentUser} demoActive={false} />
        <main className="knowledge-intro-canvas service-state-page" id="main-content">
          <StatusPanel actionLabel="重新加载" description="知识导入数据初始化失败，请重试。" onAction={() => { window.location.reload(); }} title="无法加载知识导入" tone="error" />
        </main>
      </div>
    );
  }
  if (state.result.status === "unavailable") {
    return (
      <KnowledgeIntroUnavailable
        currentUser={currentUser}
        fixtureMissing={state.result.reason === "FIXTURE_NOT_AVAILABLE_FOR_COURSE"}
        overviewUrl={overviewUrl}
      />
    );
  }
  return <KnowledgeIntroReady currentUser={currentUser} document={state.result.document} overviewUrl={overviewUrl} />;
}
