import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useApi, type Session } from '../../shared/api';
import type { Employee } from '../employees/types';

import { Loading, Empty } from '../../shared/ui';

export type DashboardSummary = {
  headcount: number;
  newJoiners: number;
  recordedToday: number;
  onLeaveToday: number;
  pendingLeave: number;
  pendingAttendance: number;
  pendingTimeRequests: number;
  preparedPayrollInputs: number | null;
};

export function DashboardHeader({
  title,
  description,
  role,
  actions,
}: {
  title: string;
  description: string;
  role?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {role && <div className="eyebrow">MATAHR / {role.toUpperCase()}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className={actions ? 'admin-overview-actions' : undefined}>
        <span>
          {new Intl.DateTimeFormat('en-ZA', {
            dateStyle: 'long',
            timeZone: 'Africa/Johannesburg',
          }).format(new Date())}
        </span>
        {actions}
      </div>
    </div>
  );
}
export function WorkforceMetrics({
  summary,
  team = false,
}: {
  summary: DashboardSummary;
  team?: boolean;
}) {
  return (
    <div className="app-kpis">
      {[
        [summary.headcount, team ? 'Team members' : 'Employees'],
        [summary.recordedToday, 'Clocked in today'],
        [summary.onLeaveToday, 'On leave today'],
        [summary.pendingLeave, 'Leave awaiting review'],
      ].map(([value, label]) => (
        <div key={String(label)}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
export function EmployeeProfile({ session, hero = false }: { session: Session; hero?: boolean }) {
  const own = useApi<Employee>(session.employeeId ? '/employees/' + session.employeeId : null);
  return (
    <>
      <Loading loading={own.loading} error={own.error} />{' '}
      {own.data && (
        <section className={'card app-profile-strip ' + (hero ? 'app-profile-hero' : '')}>
          <span className="app-initials">
            {own.data.name
              .split(' ')
              .map((x) => x[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <h2>{own.data.name}</h2>
            <p>
              {own.data.number} · Joined {own.data.started}
            </p>
            <Link to="/employees">View my employee record →</Link>
          </div>
        </section>
      )}
      {!session.employeeId && (
        <Empty>
          Your account is not linked to an employee. An administrator can link it before you clock
          in or apply for leave.
        </Empty>
      )}
    </>
  );
}
export function PersonalWorkspaceLinks() {
  return (
    <div className="app-action-links">
      <Link className="card" to="/register">
        <h2>My working day</h2>
        <p>Clock in, clock out and review your attendance.</p>
        <span>Open digital register →</span>
      </Link>
      <Link className="card" to="/leave">
        <h2>Leave & requests</h2>
        <p>Check balances and manage leave requests.</p>
        <span>Open leave workspace →</span>
      </Link>
      <Link className="card" to="/payroll">
        <h2>Payslips & benefits</h2>
        <p>Access your released payslips and benefit information.</p>
        <span>Open payroll workspace →</span>
      </Link>
    </div>
  );
}
export function ReviewQueue({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="card">
      <h2>Review queue</h2>
      <div className="app-list">
        <Link to="/leave">
          Leave decisions <strong>{summary.pendingLeave}</strong>
        </Link>
        <Link to="/register">
          Attendance reviews <strong>{summary.pendingAttendance}</strong>
        </Link>
        <Link to="/register">
          Correction and overtime requests <strong>{summary.pendingTimeRequests}</strong>
        </Link>
      </div>
    </section>
  );
}
