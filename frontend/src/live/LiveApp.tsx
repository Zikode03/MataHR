import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
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
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  FileClock,
  UserRoundCog,
  Import,
  Settings2,
} from 'lucide-react';
import { LoginPage } from '../auth/LoginPage';
import { api, ApiError, can, message, type Session, type Role } from './api';
import { ActionForm, field, TextField } from './shared';
import { HomePage } from './HomePage';
import { AdminNotifications } from './AdminNotifications';
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
const SettingsPage = lazy(() =>
  import('./SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

export function LiveApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [compact, setCompact] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tenant, setTenant] = useState(''),
    [mfa, setMfa] = useState(false),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState<Role>('Employee'),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setCompact(
          !!session &&
            localStorage.getItem('matahr:density:' + session.tenantId + ':' + session.id) ===
              'compact',
        );
      } catch {
        setCompact(false);
      }
    };
    read();
    window.addEventListener('matahr:preferences-changed', read);
    return () => window.removeEventListener('matahr:preferences-changed', read);
  }, [session?.id, session?.tenantId]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)');
    const resized = () => {
      if (!mobile.matches) setMenu(false);
    };
    mobile.addEventListener('change', resized);
    return () => mobile.removeEventListener('change', resized);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    document.querySelector<HTMLAnchorElement>('.live-sidebar nav a')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [menu]);
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
        if (config.status === 'fulfilled') {
          setTenant(config.value.tenantId ?? '');
          if (!config.value.tenantId)
            setError('Organisation setup is missing on the server. Contact your administrator.');
        } else setError('Cannot connect to MataHR. Check that the backend is running, then retry.');
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
  async function retryConnection() {
    setBusy(true);
    try {
      const config = await api<{ tenantId: string }>('/auth/config');
      if (!config.tenantId)
        throw Error('Organisation setup is missing on the server. Contact your administrator.');
      setTenant(config.tenantId);
      setError('');
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
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
          signInDisabled={!tenant || busy}
          connectionNotice={
            !tenant || error ? (
              <div className="login-connection-notice" role="status">
                <p>{error || 'Connecting to your organisation…'}</p>
                {!tenant && (
                  <button type="button" onClick={retryConnection} disabled={busy}>
                    {busy ? 'Connecting…' : 'Retry connection'}
                  </button>
                )}
              </div>
            ) : undefined
          }
          onRequestReset={async (email) => {
            await api('/auth/password/request-reset', 'POST', { tenantId: tenant, email });
          }}
        />
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
      show: can(session, 'Attendance.Own') && (!admin || !!session.employeeId),
    },
    {
      to: '/leave',
      label: manager ? 'Leave & approvals' : 'Leave management',
      icon: CalendarDays,
      show: can(session, 'Leave.Own') && (!admin || !!session.employeeId),
    },
    {
      to: '/payroll',
      label: hr ? 'Payroll & benefits' : 'My payslips & benefits',
      icon: Wallet,
      show: can(session, 'Payroll.Own') && (!admin || !!session.employeeId),
    },
    {
      to: '/administration/users',
      label: 'User management',
      icon: UserRoundCog,
      show: admin && can(session, 'Accounts'),
    },
    {
      to: '/administration/permissions',
      label: 'Roles & permissions',
      icon: ShieldCheck,
      show: admin && can(session, 'Accounts'),
    },
    {
      to: '/administration/audit',
      label: 'Audit trail',
      icon: FileClock,
      show: admin && can(session, 'Accounts') && can(session, 'Audit'),
    },
    {
      to: '/imports',
      label: 'Legacy import',
      icon: Import,
      show:
        (admin && can(session, 'Accounts')) ||
        (hr && can(session, 'People.Write') && can(session, 'Organisation.Write')),
    },
    { to: '/settings/general', label: 'Settings', icon: Settings2, show: true },
  ].filter((x) => x.show);
  const roleName = admin
    ? 'System administrator'
    : hr
      ? 'Human resources'
      : manager
        ? 'Manager'
        : 'Employee';
  return (
    <div
      className={
        'shell live-shell ' +
        (collapsed ? 'live-shell-collapsed ' : '') +
        (compact ? 'live-compact' : '')
      }
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menu && (
        <button
          className="live-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside id="workspace-navigation" className={'sidebar live-sidebar ' + (menu ? 'open' : '')}>
        <Link to="/dashboard" className="live-logo" aria-label="MataHR home">
          <img src="/brand/matateni-emblem.png" alt="" />
          <div className="live-wordmark">
            <strong>
              Mata<span>HR</span>
            </strong>
            <small>BY MATATENI</small>
          </div>
        </Link>
        <button
          className="live-mobile-close"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        >
          <X size={19} />
        </button>
        <nav aria-label="Main navigation">
          {['Workspace', 'Administration'].map((group) => {
            const items = nav.filter(
              (item) =>
                (item.to.startsWith('/administration') ||
                  item.to === '/imports' ||
                  (admin && item.to.startsWith('/settings'))) ===
                (group === 'Administration'),
            );
            return (
              items.length > 0 && (
                <div className="live-nav-section" key={group}>
                  <p>{group}</p>
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMenu(false)}
                    >
                      <item.icon size={19} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )
            );
          })}
        </nav>
        <div className="live-sidebar-logout">
          <button
            type="button"
            disabled={busy}
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              setMenu(false);
              void signOut();
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{busy ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </aside>
      <div className="content" inert={menu || undefined}>
        <header className="live-header">
          <button
            className="menu-toggle"
            aria-label="Toggle navigation"
            aria-expanded={menu}
            aria-controls="workspace-navigation"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <button
            className="live-sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-controls="workspace-navigation"
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <div className="live-header-actions">
            {admin && can(session, 'Accounts') && can(session, 'Audit') && (
              <AdminNotifications key={session.tenantId + session.id} session={session} />
            )}
            {session.roles.length > 1 && (
              <label className="live-role-switch">
                <span className="live-workspace-label">Workspace</span>
                <select
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as Role);
                    setMenu(false);
                    navigate('/dashboard');
                  }}
                >
                  {session.roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
            )}
            <details className="live-account-menu" key={location.pathname}>
              <summary aria-label="Account menu">
                <span className="live-account-avatar">
                  {session.email.slice(0, 1).toUpperCase()}
                </span>
                <span className="live-account-identity">
                  <strong>{roleName}</strong>
                  <small>{session.email}</small>
                </span>
                <ChevronDown size={15} />
              </summary>
              <div className="live-account-popover">
                <strong>{session.email}</strong>
                <span>{roleName}</span>
                <Link to="/settings/security">Account security</Link>
              </div>
            </details>
          </div>
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
                path="/settings/:section?"
                element={
                  <SettingsPage
                    key={location.pathname}
                    session={session}
                    onPasswordChanged={() => {
                      setSession(null);
                      setError('Password updated. Sign in with your new password.');
                      navigate('/login', { replace: true });
                    }}
                  />
                }
              />
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
                path="/administration/:section?"
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
