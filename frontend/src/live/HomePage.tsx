import { Link } from 'react-router-dom';
import {
  useApi,
  periodQuery,
  type Session,
  type Role,
  type Page,
  type Employee,
  type Account,
  type WorkSession,
  type Policy,
} from './api';
import { Loading, Empty } from './shared';
type Summary = {
  headcount: number;
  newJoiners: number;
  recordedToday: number;
  onLeaveToday: number;
  pendingLeave: number;
  pendingAttendance: number;
  pendingTimeRequests: number;
  preparedPayrollInputs: number | null;
};
export function HomePage({ session, role }: { session: Session; role: Role }) {
  const summary = useApi<Summary>(role === 'Admin' ? null : '/dashboard?' + periodQuery());
  const own = useApi<Employee>(session.employeeId ? '/employees/' + session.employeeId : null);
  const accounts = useApi<Page<Account>>(
    role === 'Admin' ? '/admin/accounts?maxResultCount=1' : null,
  );
  const title =
    role === 'Admin'
      ? 'System overview'
      : role === 'HR'
        ? 'HR dashboard'
        : role === 'Manager'
          ? 'My team'
          : 'My workspace';
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">MATAHR / {role.toUpperCase()}</div>
          <h1>{title}</h1>
          <p>
            {role === 'Admin'
              ? 'Manage secure access to your organisation.'
              : role === 'HR'
                ? 'Your workforce and the decisions that need attention.'
                : role === 'Manager'
                  ? 'Keep your team’s working day moving.'
                  : 'Your working day, requests and employment information.'}
          </p>
        </div>
        <span>{new Intl.DateTimeFormat('en-ZA', { dateStyle: 'long' }).format(new Date())}</span>
      </div>
      <Loading
        loading={summary.loading || accounts.loading}
        error={summary.error || accounts.error}
      />
      {role === 'Admin' ? (
        <>
          <section className="card">
            <h2>Access administration</h2>
            <p>
              {accounts.data?.totalCount ?? '—'} registered accounts. Personnel and payroll access
              are controlled separately from system administration.
            </p>
            <Link className="primary" to="/administration">
              Manage users & permissions
            </Link>
          </section>
          <section className="card">
            <h2>Existing records</h2>
            <p>
              Review a tenant-scoped legacy import before bringing existing accounts into the ABP
              account store.
            </p>
            <Link to="/imports">Review legacy accounts →</Link>
          </section>
        </>
      ) : (
        <>
          {(role === 'HR' || role === 'Manager') && summary.data && (
            <div className="live-kpis">
              {[
                [summary.data.headcount, role === 'Manager' ? 'Team members' : 'Employees'],
                [summary.data.recordedToday, 'Clocked in today'],
                [summary.data.onLeaveToday, 'On leave today'],
                [summary.data.pendingLeave, 'Leave awaiting review'],
              ].map(([value, label]) => (
                <div key={String(label)}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          )}
          {own.data && (
            <section
              className={
                'card live-profile-strip ' + (role === 'Employee' ? 'live-profile-hero' : '')
              }
            >
              <span className="live-initials">
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
              Your account is not linked to an employee. An administrator can link it before you
              clock in or apply for leave.
            </Empty>
          )}
          {role === 'Employee' && session.employeeId && <EmployeeSummary session={session} />}
          <div className="live-action-links">
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
          {(role === 'HR' || role === 'Manager') && summary.data && (
            <section className="card">
              <h2>Review queue</h2>
              <div className="live-list">
                <Link to="/leave">
                  Leave decisions <strong>{summary.data.pendingLeave}</strong>
                </Link>
                <Link to="/register">
                  Attendance reviews <strong>{summary.data.pendingAttendance}</strong>
                </Link>
                <Link to="/register">
                  Correction and overtime requests{' '}
                  <strong>{summary.data.pendingTimeRequests}</strong>
                </Link>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function EmployeeSummary({ session }: { session: Session }) {
  const date = new Date(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Johannesburg',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()) + 'T12:00:00Z',
  );
  const day = date.toISOString().slice(0, 10),
    first = day.slice(0, 7) + '-01';
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const monday = date.toISOString().slice(0, 10),
    from = monday < first ? monday : first;
  const records = useApi<Page<WorkSession>>(
    '/attendance?from=' + from + '&to=' + day + '&maxResultCount=200',
  );
  const overtime = useApi<{ kind: string; status: string; start: string; end: string }[]>(
    '/attendance/requests?from=' + first + '&to=' + day,
  );
  const balances = useApi<
    { policyId: string; configured: boolean; unlimited: boolean; available: number | null }[]
  >('/leave/balances/' + session.employeeId + '?year=' + day.slice(0, 4));
  const policies = useApi<Policy[]>('/leave/policies');
  const hours = (since: string) =>
    (records.data?.items ?? [])
      .filter((r) => r.date >= since && r.status !== 'Rejected')
      .reduce(
        (sum, r) =>
          sum +
          Math.max(0, Date.parse(r.end ?? new Date().toISOString()) - Date.parse(r.start)) /
            3600000,
        0,
      );
  const extra = (overtime.data ?? [])
    .filter((r) => r.kind === 'Overtime' && r.status === 'Approved')
    .reduce((sum, r) => sum + (Date.parse(r.end) - Date.parse(r.start)) / 3600000, 0);
  return (
    <div className="live-summary-grid">
      <section className="card">
        <h2>My recorded hours</h2>
        <Loading error={records.error || overtime.error} loading={records.loading} />
        <div className="live-hours-grid">
          {[
            [hours(day), 'Today'],
            [hours(monday), 'This week'],
            [hours(first), 'This month'],
            [extra, 'Approved overtime this month'],
          ].map(([value, label]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>
                {records.loading || overtime.loading ? '—' : Number(value).toFixed(1) + 'h'}
              </strong>
            </div>
          ))}
        </div>
        <p>
          Recorded time includes attendance awaiting review. It is not a measure of productivity.
        </p>
        <Link className="primary" to="/register">
          Open digital register
        </Link>
      </section>
      <section className="card">
        <h2>My leave balances</h2>
        <Loading error={balances.error} loading={balances.loading} />
        {balances.data?.map((balance) => (
          <div key={balance.policyId} className="live-balance-row">
            <span>{policies.data?.find((p) => p.id === balance.policyId)?.name ?? 'Leave'}</span>
            <strong>
              {!balance.configured
                ? 'Not allocated'
                : balance.unlimited
                  ? 'Unlimited'
                  : balance.available}
            </strong>
          </div>
        ))}
        <p>Balances include reserved pending applications.</p>
        <Link className="primary" to="/leave">
          Apply for leave
        </Link>
      </section>
    </div>
  );
}
