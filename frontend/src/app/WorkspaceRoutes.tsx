import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { can } from '../shared/api';

import { HomePage } from '../features/dashboard/HomePage';

const PeoplePage = lazy(() =>
  import('../features/employees/PeoplePage').then((module) => ({ default: module.PeoplePage })),
);
const OrganisationPage = lazy(() =>
  import('../features/organisation/OrganisationPage').then((module) => ({
    default: module.OrganisationPage,
  })),
);
const AttendancePage = lazy(() =>
  import('../features/attendance/AttendancePage').then((module) => ({
    default: module.AttendancePage,
  })),
);
const LeavePage = lazy(() =>
  import('../features/leave/LeavePage').then((module) => ({ default: module.LeavePage })),
);
const PayrollPage = lazy(() =>
  import('../features/payroll/PayrollPage').then((module) => ({ default: module.PayrollPage })),
);
const AdminPage = lazy(() =>
  import('../features/admin/AdminPage').then((module) => ({ default: module.AdminPage })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);
const AdminProfile = lazy(() =>
  import('../features/admin/AdminProfile').then((module) => ({ default: module.AdminProfile })),
);

const LegacyImportPage = lazy(() =>
  import('../features/admin/LegacyImportPage').then((module) => ({
    default: module.LegacyImportPage,
  })),
);
const AuditTrailPage = lazy(() =>
  import('../features/admin/AuditTrailPage').then((module) => ({ default: module.AuditTrailPage })),
);

function Denied() {
  return (
    <section className="card">
      <h1>Access restricted</h1>
      <p>This workspace is not included in your assigned role.</p>
      <Link to="/dashboard">Return to your workspace</Link>
    </section>
  );
}

import type { WorkspaceShellContext } from './useWorkspaceShell';
// Route checks control which screens can open. The API separately authorises access to each record and action.
export function WorkspaceRoutes({
  context,
}: {
  context: Pick<
    WorkspaceShellContext,
    'navigate' | 'session' | 'setSession' | 'setError' | 'role' | 'location' | 'admin'
  >;
}) {
  const { navigate, session, setSession, setError, role, location, admin } = context;
  return (
    <>
      {' '}
      <Suspense fallback={<p role="status">Loading workspace…</p>}>
        <Routes>
          <Route path="/dashboard" element={<HomePage session={session} role={role} />} />
          <Route
            path="/profile"
            element={admin ? <AdminProfile session={session} /> : <Denied />}
          />
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
            element={can(session, 'Payroll.Own') ? <PayrollPage session={session} /> : <Denied />}
          />
          <Route
            path="/administration/:section?"
            element={
              admin && can(session, 'Accounts') ? (
                location.pathname === '/administration/audit' ? (
                  <AuditTrailPage />
                ) : (
                  <AdminPage session={session} />
                )
              ) : (
                <Denied />
              )
            }
          />
          <Route
            path="/imports"
            element={
              can(session, 'Accounts') ||
              (can(session, 'People.Write') && can(session, 'Organisation.Write')) ? (
                <LegacyImportPage session={session} />
              ) : (
                <Denied />
              )
            }
          />
          <Route path="/self-service" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
