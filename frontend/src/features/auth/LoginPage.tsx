import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, Mail, LockKeyhole, Users, CalendarDays, Wallet } from 'lucide-react';
type Props = {
  companyName?: string;
  onAuthenticate: (email: string, password: string) => Promise<void>;
  onRequestReset?: (email: string) => Promise<void>;
  connectionNotice?: ReactNode;
  signInDisabled?: boolean;
};
export function LoginPage({
  companyName = 'Matateni Technologies',
  onAuthenticate,
  onRequestReset,
  connectionNotice,
  signInDisabled = false,
}: Props) {
  const [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [feedback, setFeedback] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || signInDisabled) return;
    setBusy(true);
    setFeedback('');
    try {
      await onAuthenticate(email, password);
      setPassword('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page login-refined">
      <a className="login-skip" href="#login-form">
        Skip to sign in
      </a>
      <section className="login-brand-panel" aria-label="Welcome to MataHR">
        <Link to="/login" className="login-brand">
          <img src="/brand/matateni-emblem.png" alt="" />
          <span>
            Mata<span>HR</span>
            <small>BY MATATENI</small>
          </span>
          <span className="login-brand-description">Human Capital Management</span>
        </Link>
        <div className="login-brand-content">
          <span className="login-eyebrow">MATATENI TECHNOLOGIES</span>
          <h1>
            Your people.
            <br />
            Your operations.
            <br />
            <em>One workspace.</em>
          </h1>
          <p>
            The clarity to manage your workforce.
            <br />
            The space to focus on your people.
          </p>
          <div className="login-brand-features">
            <div>
              <span>
                <Users size={22} />
              </span>
              <div>
                <strong>People Management</strong>
                <small>Onboard, develop and support your team.</small>
              </div>
            </div>
            <div>
              <span>
                <CalendarDays size={22} />
              </span>
              <div>
                <strong>Time & Attendance</strong>
                <small>Bring attendance and leave together.</small>
              </div>
            </div>
            <div>
              <span>
                <Wallet size={22} />
              </span>
              <div>
                <strong>Payroll & Benefits</strong>
                <small>Prepare, review and manage compensation.</small>
              </div>
            </div>
          </div>
        </div>
        <div className="login-brand-footer">
          <span className="login-brand-company">{companyName}</span>
          <span>People. Process. Progress.</span>
        </div>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <h2>Welcome back.</h2>
          {connectionNotice}
          <form id="login-form" onSubmit={submit}>
            <label htmlFor="login-email">Work email</label>
            <div className="login-input">
              <Mail size={17} aria-hidden="true" />
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFeedback('');
                }}
                placeholder="name@matateni.africa"
                aria-describedby="login-feedback"
              />
            </div>
            <div className="login-password-label">
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                onClick={async () => {
                  if (onRequestReset) {
                    if (!email.trim()) {
                      setFeedback('Enter your work email first.');
                      return;
                    }
                    setBusy(true);
                    try {
                      await onRequestReset(email);
                      setFeedback(
                        'If your account is eligible, password reset instructions will be sent to your work email.',
                      );
                    } catch (error) {
                      setFeedback(
                        error instanceof Error ? error.message : 'Recovery could not be requested.',
                      );
                    } finally {
                      setBusy(false);
                    }
                  } else setFeedback('Contact your administrator for account recovery.');
                }}
              >
                Forgot password?
              </button>
            </div>
            <div className="login-input">
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                id="login-password"
                name="password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFeedback('');
                }}
                placeholder="Enter your password"
                aria-describedby="login-feedback"
              />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <button type="submit" className="login-submit" disabled={busy || signInDisabled}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="login-privacy-prompt">
              <LockKeyhole size={15} aria-hidden="true" />
              Review the POPIA privacy notice after sign-in.
            </p>
            <p
              id="login-feedback"
              className={feedback ? 'login-feedback login-inline-feedback' : 'login-feedback'}
              role={feedback ? 'status' : undefined}
            >
              {feedback}
            </p>
          </form>

          <p className="login-access-note">Need access? Contact your HR administrator.</p>
        </div>
        <div className="login-bottomline">
          <span>© {new Date().getFullYear()} MataHR</span>
          <span>People · Process · Performance</span>
        </div>
      </section>
    </div>
  );
}
