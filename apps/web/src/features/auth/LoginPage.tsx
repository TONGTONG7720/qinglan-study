import { useEffect, useState, type SyntheticEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { HttpError } from "../../api/http-client";
import { loadCurrentUser, login } from "../../api/auth";
import { Icon } from "../../components/Icon";
import { useDocumentMetadata } from "../../hooks/use-document-metadata";

interface LoginLocationState {
  readonly from?: string;
}

function roleHome(roles: readonly string[]): string | null {
  if (roles.length !== 1) return null;
  if (roles[0] === "ADMIN") return "/admin/overview";
  if (roles[0] === "GUARDIAN") return "/guardian/overview";
  if (roles[0] === "STUDENT") return "/student/today";
  return null;
}

export function LoginPage() {
  useDocumentMetadata("登录 · 清朗学习系统", "登录清朗学习系统并安全返回获授权的学习空间。");
  const navigate = useNavigate();
  const location = useLocation();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const state = location.state as LoginLocationState | null;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void loadCurrentUser(controller.signal).then(async (result) => {
      if (!active) return;
      if (result.status === "authenticated") {
        const target = roleHome(result.user.roles);
        if (target !== null) await navigate(target, { replace: true });
        else setMessage("当前会话的安全落点尚未确定，请退出后联系管理员处理。");
      }
      setCheckingSession(false);
    }).catch(() => {
      if (active) setCheckingSession(false);
    });
    return () => {
      active = false;
      controller.abort();
      setPassword("");
    };
  }, [navigate]);

  async function submit(event: SyntheticEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) return;
    if (!navigator.onLine) {
      setPassword("");
      setMessage("当前离线，无法建立新会话。系统不会排队或自动提交密码。");
      return;
    }
    setMessage(null);
    setSubmitting(true);
    try {
      const user = await login({ loginId, password });
      const fallback = roleHome(user.roles);
      if (fallback === null) {
        setPassword("");
        setMessage("登录已确认，但安全落点尚未确定。系统不会在客户端猜测角色入口。");
        return;
      }
      const requested = state?.from;
      const destination = requested?.startsWith("/") === true ? requested : fallback;
      await navigate(destination, { replace: true });
    } catch (error: unknown) {
      if (error instanceof HttpError && (error.status === 400 || error.status === 401)) {
        setMessage("登录标识或密码不正确，或账号暂不可用。");
      } else if (error instanceof HttpError && error.status === 429) {
        setMessage("尝试过于频繁，请稍后再试。");
      } else {
        const current = await loadCurrentUser();
        if (current.status === "authenticated") {
          const target = roleHome(current.user.roles);
          if (target !== null) {
            setPassword("");
            await navigate(target, { replace: true });
            return;
          }
        }
        setMessage("登录结果暂时无法确认；已检查当前会话，仍未获得安全落点。请主动重试。");
      }
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  if (state?.from === "/login") return <Navigate replace to="/student/today" />;
  if (checkingSession) return <main className="auth-checking" role="status">正在检查安全会话…</main>;

  return (
    <main className="auth-page" id="main-content">
      <section className="auth-cover" aria-label="清朗学习品牌">
        <div className="auth-brand">
          <strong>清朗学习</strong>
          <span>INK STUDY ROOM</span>
          <i aria-hidden="true">清朗</i>
        </div>
        <div className="auth-cover-copy">
          <h1>持之以恒<br />水滴石穿</h1>
          <p>邀请制家庭学习空间</p>
          <p>专注本人学习，克制使用数据</p>
        </div>
        <footer><strong>学生 · 家长 · 个人管理员</strong><span>一个入口，按真实权限进入</span></footer>
      </section>

      <section className="auth-form-panel" aria-labelledby="login-title">
        <div className="auth-public-header"><span>账户登录 / SIGN IN</span><time dateTime="2026-08-24"><small>Monday</small><strong>2026-08-24</strong><small>丙午年 七月十二　星期一</small></time></div>
        <header>
          <span>清朗学习账号</span>
          <h2 id="login-title">欢迎回来</h2>
          <p>使用你的登录标识与密码继续</p>
        </header>
        <form onSubmit={(event) => void submit(event)}>
          <label htmlFor="login-id">登录标识</label>
          <input
            autoComplete="username"
            autoCapitalize="none"
            id="login-id"
            maxLength={120}
            minLength={3}
            onChange={(event) => {
              setLoginId(event.target.value);
            }}
            required
            placeholder="请输入登录标识"
            spellCheck={false}
            value={loginId}
          />
          <label htmlFor="login-password">密码</label>
          <div className="auth-password-field"><input autoComplete="current-password" id="login-password" maxLength={128} minLength={12} onChange={(event) => { setPassword(event.target.value); }} placeholder="请输入密码" required type={passwordVisible ? "text" : "password"} value={password} /><button aria-label={passwordVisible ? "隐藏密码" : "显示密码"} aria-pressed={passwordVisible} onClick={() => { setPasswordVisible((visible) => !visible); }} type="button"><Icon name="eye" size={18} /></button></div>
          <Link className="auth-forgot" to="/account/security">忘记密码？</Link>
          {message === null ? null : <p className="auth-error" role="alert">{message}</p>}
          <button className="auth-submit" disabled={submitting} type="submit">
            <span>{submitting ? "正在登录…" : "登录"}</span>
            <Icon name="arrowRight" size={18} />
          </button>
        </form>
        <p className="auth-invite">收到家长邀请？<Link to="/invite/validate">验证邀请</Link></p>
        <footer>
          <Icon name="shieldCheck" size={18} />
          <p>登录反馈不会显示账号是否存在、是否停用或所属角色。<br />登录成功后，系统将按真实权限进入安全首页。</p>
        </footer>
        <p className="auth-public-registration">本产品不开放公开注册，仅接受有效邀请。</p>
      </section>
    </main>
  );
}
