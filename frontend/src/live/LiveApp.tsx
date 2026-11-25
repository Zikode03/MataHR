import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import {
  LogOut,
  Users,
  Clock3,
  Network,
  CalendarDays,
  Wallet,
  LayoutDashboard,
  ShieldCheck,
  Menu,
} from 'lucide-react';
import { LoginPage } from '../auth/LoginPage';
import { api, ApiError, can, message, type Session, type Role } from './api';
import { ActionForm, field, TextField } from './shared';
import { HomePage } from './HomePage';
import './live.css';

const PeoplePage = lazy(() =>
  import('./PeoplePage').then((module) => ({ default: module.PeoplePage })),
);
const OrganisationPage = lazy(() =>
  import('./OrganisationPage').then((module) => ({ default: module.OrganisationPage })),
);
const AttendancePage = lazy(() =>
  import('./AttendancePage').then((module) => ({ default: module.AttendancePage })),
);
const LeavePage = lazy(() =>
  import('./LeavePage').then((module) => ({ default: module.LeavePage })),
);
const PayrollPage = lazy(() =>
  import('./PayrollPage').then((module) => ({ default: module.PayrollPage })),
);
const AdminPage = lazy(() =>
  import('./AdminPage').then((module) => ({ default: module.AdminPage })),
);

export function LiveApp() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tenant, setTenant] = useState(''),
    [mfa, setMfa] = useState(false),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState<Role>('Employee'),
    [menu, setMenu] = useState(false);
  const loadSession = useCallback(async () => {
    const account = await api<Session>('/auth/me');
    setSession(account);
    setRole(
      account.roles.includes('Admin')
        ? 'Admin'
        : account.roles.includes('HR')
          ? 'HR'
          : account.roles.includes('Manager')
            ? 'Manager'
            : 'Employee',
    );
  }, []);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api<{ tenantId: string }>('/auth/config'), api<Session>('/auth/me')]).then(
      ([config, account]) => {
        if (!active) return;
        if (config.status === 'fulfilled') setTenant(config.value.tenantId ?? '');
        if (account.status === 'fulfilled') {
          setSession(account.value);
          setRole(
            account.value.roles.includes('Admin')
              ? 'Admin'
              : account.value.roles.includes('HR')
                ? 'HR'
                : account.value.roles.includes('Manager')
                  ? 'Manager'
                  : 'Employee',
          );
        } else if (!(account.reason instanceof ApiError && account.reason.status === 401))
          setError('Cannot reach the MataHR API. Make sure the backend is running, then retry.');
        setLoading(false);
      },
    );
    const expired = () => {
      setSession(null);
      setError('Your session expired. Please sign in again.');
    };
    window.addEventListener('matahr:session-expired', expired);
    return () => {
      active = false;
      window.removeEventListener('matahr:session-expired', expired);
    };
  }, []);
  async function signIn(email: string, password: string) {
    if (!tenant) throw Error('Enter the organisation ID supplied by your administrator.');
    const result = await api<{ requiresTwoFactor: boolean }>('/auth/login', 'POST', {
      tenantId: tenant,
      email,
      password,
    });
    if (result.requiresTwoFactor) {
      setMfa(true);
      return;
    }
    await loadSession();
    navigate('/dashboard', { replace: true });
  }
  async function signOut() {
    setBusy(true);
    try {
      await api('/auth/logout', 'POST');
      setSession(null);
      setMfa(false);
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
        setMfa(false);
        navigate('/login', { replace: true });
      } else setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="live-start" role="status">
        Connecting to MataHR…
      </main>
    );
  if (!session) {
    if (mfa)
      return (
        <main className="live-start">
          <section className="card">
            <ActionForm
              title="Verify your sign-in"
              submit="Verify"
              onSave={async (data) => {
                await api('/auth/mfa/login', 'POST', {
                  code: field(data, 'code'),
                  recoveryCode: data.has('recoveryCode'),
                });
                await loadSession();
                setMfa(false);
                navigate('/dashboard', { replace: true });
              }}
            >
              <TextField label="Authenticator or recovery code" name="code" />
              <label className="live-check">
                <input type="checkbox" name="recoveryCode" />
                Use a recovery code
              </label>
            </ActionForm>
            <button className="secondary" onClick={() => setMfa(false)}>
              Back to sign in
            </button>
          </section>
        </main>
      );
    return (
      <>
        <LoginPage
          onAuthenticate={signIn}
          onRequestReset={async (email) => {
            await api('/auth/password/request-reset', 'POST', { tenantId: tenant, email });
          }}
        />
        {(!tenant || error) && (
          <aside className="live-connection">
            <p role="alert">{error || 'Your organisation ID is required.'}</p>
            <label>
              Organisation ID
              <input
                value={tenant}
                onChange={(e) => setTenant(e.target.value)}
                placeholder="Organisation UUID"
              />
            </label>
            <button onClick={() => window.location.reload()}>Retry connection</button>
          </aside>
        )}
      </>
    );
  }
  if (session.requiresPasswordChange)
    return (
      <main className="live-start">
        <section className="card">
          <ActionForm
            title="Choose your own password"
            submit="Change password"
            onSave={async (data) => {
              await api('/auth/password', 'POST', {
                currentPassword: field(data, 'currentPassword'),
                newPassword: field(data, 'newPassword'),
              });
              setSession(null);
              setError('Your password was changed. Sign in with your new password.');
              navigate('/login');
            }}
          >
            <TextField type="password" name="currentPassword" label="Temporary password" />
            <label>
              New password
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                minLength={14}
                required
              />
              <small>
                Use at least 14 characters including uppercase, lowercase, a number and a symbol.
              </small>
            </label>
          </ActionForm>
        </section>
      </main>
    );
  if (!session.privacyAcknowledged)
    return (
      <main className="live-start">
        <section className="card live-privacy">
          <ShieldCheck size={30} />
          <h1>Your information at work</h1>
          <p>
            MataHR processes your employee record, employment documents, attendance, leave and
            payroll inputs for workforce administration. Access is limited by your assigned role.
          </p>
          <p>
            If you request on-site clock-in verification, your browser location is checked against
            the configured workplace boundary. The attendance record keeps the measured distance,
            accuracy and verification result, rather than your precise coordinates. A short-lived
            on-site code is also required. Remote work and exceptions are reviewed separately.
          </p>
          <p>
            You may ask HR for access to or correction of your information, the employer’s
            Information Officer details, and its retention and privacy policies. Acknowledging this
            notice records that you have read it; it is not blanket consent or a waiver of your
            POPIA rights.
          </p>
          <p>
            Notice version: {session.privacyVersion}.{' '}
            <a href="https://inforegulator.org.za/" target="_blank" rel="noreferrer">
              Information Regulator
            </a>
          </p>
          {error && (
            <p role="alert" className="live-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/auth/privacy', 'POST');
                  await loadSession();
                  setError('');
                } catch (error) {
                  setError(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              I acknowledge · open workspace
            </button>
            <button className="secondary" disabled={busy} onClick={signOut}>
              Sign out
            </button>
          </div>
        </section>
      </main>
    );
  const hr = role === 'HR',
    admin = role === 'Admin',
    manager = role === 'Manager';
  const nav = [
    {
      to: '/dashboard',
      label: admin ? 'System overview' : manager ? 'My team' : hr ? 'HR dashboard' : 'My workspace',
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: '/employees',
      label: hr ? 'Employees' : manager ? 'Team directory' : 'My profile',
      icon: Users,
      show: (!admin || !!session.employeeId) && can(session, 'People.Read'),
    },
    {
      to: '/organisation',
      label: 'Organisation',
      icon: Network,
      show: !admin && can(session, 'Organisation.Read'),
    },
    {
      to: '/register',
      label: 'Digital register',
      icon: Clock3,
      show: can(session, 'Attendance.Own'),
    },
    {
      to: '/leave',
      label: manager ? 'Leave & approvals' : 'Leave management',
      icon: CalendarDays,
      show: can(session, 'Leave.Own'),
    },
    {
      to: '/payroll',
      label: hr ? 'Payroll & benefits' : 'My payslips & benefits',
      icon: Wallet,
      show: can(session, 'Payroll.Own'),
    },
    {
      to: '/administration',
      label: 'Users & permissions',
      icon: ShieldCheck,
      show: admin && can(session, 'Accounts'),
    },
    {
      to: '/imports',
      label: 'Legacy import',
      icon: Users,
      show:
        (admin && can(session, 'Accounts')) ||
        (hr && can(session, 'People.Write') && can(session, 'Organisation.Write')),
    },
  ].filter((x) => x.show);
  return (
    <div className="shell live-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className={'sidebar live-sidebar ' + (menu ? 'open' : '')}>
        <Link to="/dashboard" className="live-logo">
          <img src="/brand/matateni-emblem.png" alt="" />
          <strong>
            Mata<span>HR</span>
          </strong>
        </Link>
        <p className="eyebrow">{role} workspace</p>
        <nav>
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={() => setMenu(false)}>
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="live-sidebar-bottom">
          <small>Signed in as</small>
          <strong>{session.email}</strong>
          <button className="secondary" disabled={busy} onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="content">
        <header>
          <button
            className="menu-toggle"
            aria-label="Toggle navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <span className="workspace-title">
            Matateni Technologies <span>/ People workspace</span>
          </span>
          {session.roles.length > 1 ? (
            <label className="live-role-switch">
              Workspace
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  navigate('/dashboard');
                }}
              >
                {session.roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          ) : (
            <span className="live-role-label">{role}</span>
          )}
        </header>
        <main id="main-content">
          {error && (
            <p role="alert" className="notice live-error">
              {error}
              <button onClick={() => setError('')}>Dismiss</button>
            </p>
          )}
          <Suspense fallback={<p role="status">Loading workspace…</p>}>
            <Routes>
              <Route path="/dashboard" element={<HomePage session={session} role={role} />} />
              <Route
                path="/employees/*"
                element={
                  can(session, 'People.Read') && (!admin || !!session.employeeId) ? (
                    <PeoplePage session={session} />
                  ) : (
                    <Denied />
                  )
                }
              />
              <Route
                path="/organisation"
                element={
                  !admin && can(session, 'Organisation.Read') ? (
                    <div className="org-page">
                      <OrganisationPage session={session} />
                    </div>
                  ) : (
                    <Denied />
                  )
                }
              />
              <Route
                path="/register"
                element={
                  can(session, 'Attendance.Own') ? <AttendancePage session={session} /> : <Denied />
                }
              />
              <Route path="/attendance" element={<Navigate to="/register" replace />} />
              <Route
                path="/leave"
                element={can(session, 'Leave.Own') ? <LeavePage session={session} /> : <Denied />}
              />
              <Route
                path="/payroll"
                element={
                  can(session, 'Payroll.Own') ? <PayrollPage session={session} /> : <Denied />
                }
              />
              <Route
                path="/administration"
                element={
                  admin && can(session, 'Accounts') ? <AdminPage session={session} /> : <Denied />
                }
              />
              <Route
                path="/imports"
                element={
                  can(session, 'Accounts') ||
                  (can(session, 'People.Write') && can(session, 'Organisation.Write')) ? (
                    <AdminPage session={session} imports />
                  ) : (
                    <Denied />
                  )
                }
              />
              <Route path="/self-service" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
        <footer>MataHR · Matateni Technologies</footer>
      </div>
    </div>
  );
}
function Denied() {
  return (
    <section className="card">
      <h1>Access restricted</h1>
      <p>This workspace is not included in your assigned role.</p>
      <Link to="/dashboard">Return to your workspace</Link>
    </section>
  );
}
