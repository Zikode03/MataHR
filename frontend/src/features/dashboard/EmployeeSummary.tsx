import { Link } from 'react-router-dom';
import { useApi, type Session, type Page } from '../../shared/api';
import type { WorkSession } from '../attendance/types';
import type { Policy } from '../leave/types';

import { Loading } from '../../shared/ui';

export function EmployeeSummary({ session }: { session: Session }) {
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
    <div className="app-summary-grid">
      <section className="card">
        <h2>My recorded hours</h2>
        <Loading error={records.error || overtime.error} loading={records.loading} />
        <div className="app-hours-grid">
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
          <div key={balance.policyId} className="app-balance-row">
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
