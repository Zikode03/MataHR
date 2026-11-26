import { initialAccounts, accountForEmail, roleLabels, type UserAccount } from './access';
import type { PreviewDestination } from './previewSession';
import { PrivacyNotice } from './PrivacyNotice';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  Users,
  BriefcaseBusiness,
  CalendarDays,
  Wallet,
} from 'lucide-react';
type Props = {
  companyName?: string;
  hrEmail?: string;
  accounts?: UserAccount[];
  onContinue?: (destination: PreviewDestination, accountId?: string) => void;
  onAuthenticate?: (email: string, password: string) => Promise<void>;
  onRequestReset?: (email: string) => Promise<void>;
  connectionNotice?: ReactNode;
  signInDisabled?: boolean;
};
export function LoginPage({
  companyName = 'Matateni Technologies',
  hrEmail = '',
  accounts = initialAccounts(),
  onContinue,
  onAuthenticate,
  onRequestReset,
  connectionNotice,
  signInDisabled = false,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [feedback, setFeedback] = useState(''),
    [help, setHelp] = useState(false),
    [pending, setPending] = useState<UserAccount | null>(null),
    [privacyOpen, setPrivacyOpen] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (onAuthenticate) {
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
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password.trim()) {
      setFeedback('Enter a work email and sample password to continue with the demo.');
      return;
    }
    const account = accountForEmail(accounts, email);
    setPassword('');
    if (!account) {
      setFeedback(
        'No active demo account is assigned to that email. Choose a demo workspace below or contact your administrator.',
      );
      return;
    }
    setFeedback('');
    setPending(account);
    setPrivacyOpen(true);
  }
  function preview(destination: PreviewDestination) {
    const account = accounts.find((a) => a.active && a.role === destination);
    setPassword('');
    if (!account) {
      setFeedback('No active demo account is assigned to this role.');
      return;
    }
    setFeedback('');
    setPending(account);
    setPrivacyOpen(true);
  }
  function closePrivacy() {
    setPrivacyOpen(false);
    setPending(null);
  }
  function acknowledge() {
    const destination = pending;
    closePrivacy();
    if (destination) onContinue?.(destination.role, destination.id);
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
                aria-describedby="login-preview-note"
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
                  } else setHelp(true);
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
                aria-describedby="login-preview-note"
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
              id="login-preview-note"
              className={
                feedback ? 'login-preview-note login-inline-feedback' : 'login-preview-note'
              }
              role={feedback ? 'status' : undefined}
            >
              {feedback ||
                (onAuthenticate
                  ? ''
                  : 'Demo sign-in: use an assigned demo email and sample password. Real authentication is not connected.')}
            </p>
          </form>
          {help && (
            <div className="login-help" role="status">
              <strong>Let’s get you back in.</strong>
              <p>
                Password recovery is not connected in this preview.
                {hrEmail ? (
                  <>
                    {' '}
                    Contact HR at <a href={'mailto:' + hrEmail}>{hrEmail}</a> for account
                    assistance.
                  </>
                ) : (
                  ' Contact your HR team for account assistance.'
                )}
              </p>
              <button type="button" onClick={() => setHelp(false)}>
                Close
              </button>
            </div>
          )}
          {!onAuthenticate && (
            <>
              <div className="login-demo-divider">
                <span />
                Explore a workspace
                <span />
              </div>
              <div className="login-demo-links login-role-links">
                {(['admin', 'hr', 'manager', 'employee'] as const).map((role) => (
                  <button
                    type="button"
                    key={role}
                    aria-label={'Explore ' + (role === 'hr' ? 'HR' : role) + ' workspace'}
                    onClick={() => preview(role)}
                  >
                    {role === 'employee' ? <Users size={16} /> : <BriefcaseBusiness size={16} />}
                    <span>
                      {role === 'admin'
                        ? 'Admin workspace'
                        : role === 'hr'
                          ? 'HR workspace'
                          : role === 'manager'
                            ? 'Manager workspace'
                            : 'Employee workspace'}
                      <small>
                        {accounts.find((a) => a.active && a.role === role)?.email ??
                          'No active account'}
                      </small>
                    </span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="login-access-note">
            Need access? Contact your HR administrator.
          </p>
        </div>
        <div className="login-bottomline">
          <span>© {new Date().getFullYear()} MataHR</span>
          <span>People · Process · Performance</span>
        </div>
      </section>
      {privacyOpen && (
        <PrivacyNotice
          companyName={companyName}
          hrEmail={hrEmail}
          onClose={closePrivacy}
          onAcknowledge={acknowledge}
          continuing={Boolean(pending)}
        />
      )}
    </div>
  );
}
