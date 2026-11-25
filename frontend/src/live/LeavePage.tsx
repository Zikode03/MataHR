import { useState } from 'react';
import {
  api,
  useApi,
  can,
  today,
  type Session,
  type Page,
  type Employee,
  type Policy,
  type Leave,
} from './api';
import { ActionForm, TextField, field, number, optional, Loading, Empty } from './shared';
type Balance = {
  policyId: string;
  policy: string;
  name?: string;
  configured: boolean;
  unlimited: boolean;
  available: number | null;
};
export function LeavePage({ session }: { session: Session }) {
  const [employeeId, setEmployeeId] = useState(session.employeeId ?? ''),
    [offset, setOffset] = useState(0);
  const policies = useApi<Policy[]>('/leave/policies'),
    requests = useApi<Page<Leave>>('/leave/requests?maxResultCount=25&skipCount=' + offset),
    people = useApi<Page<Employee>>(
      can(session, 'Leave.Review') ? '/employees?maxResultCount=200' : null,
    ),
    balances = useApi<Balance[]>(
      employeeId ? '/leave/balances/' + employeeId + '?year=' + today().slice(0, 4) : null,
    ),
    evidence = useApi<{ id: string; name: string; kind: string }[]>(
      employeeId ? '/documents?employeeId=' + employeeId : null,
    );
  const name = (id: string) =>
    people.data?.items.find((p) => p.id === id)?.name ?? (id === session.employeeId ? 'You' : id);
  function reload() {
    requests.reload();
    balances.reload();
  }
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">DAILY WORKSPACE / LEAVE</div>
          <h1>Leave management</h1>
          <p>Plan time away and keep approval decisions clear.</p>
        </div>
      </div>
      {can(session, 'Leave.Configure') && (
        <label className="live-search">
          Employee
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Choose an employee</option>
            {people.data?.items.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Loading error={balances.error} loading={balances.loading} />
      {balances.data && (
        <section className="card">
          <h2>{today().slice(0, 4)} leave balances</h2>
          <div className="live-kpis">
            {balances.data.map((b) => (
              <div key={b.policyId}>
                <span>
                  {policies.data?.find((p) => p.id === b.policyId)?.name ?? b.policy ?? b.name}
                </span>
                <strong>
                  {!b.configured ? 'Not allocated' : b.unlimited ? 'Unlimited' : b.available}
                </strong>
              </div>
            ))}
          </div>
        </section>
      )}
      {employeeId && (
        <section className="card">
          <ActionForm
            title="Apply for leave"
            submit="Submit application"
            onSave={async (data) => {
              await api(
                '/leave/requests' +
                  (employeeId !== session.employeeId ? '?employeeId=' + employeeId : ''),
                'POST',
                {
                  policyId: field(data, 'policyId'),
                  start: field(data, 'start'),
                  end: field(data, 'end'),
                  reason: field(data, 'reason'),
                  evidenceId: optional(data, 'evidenceId'),
                },
              );
              reload();
            }}
          >
            <label>
              Leave policy
              <select name="policyId" required>
                <option value="">Choose policy</option>
                {policies.data
                  ?.filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </label>
            <TextField name="start" label="From" type="date" />
            <TextField name="end" label="To" type="date" />
            <TextField name="reason" label="Reason" />
            <label>
              Supporting evidence
              <select name="evidenceId">
                <option value="">No evidence attached</option>
                {evidence.data
                  ?.filter((d) => d.kind === 'LeaveEvidence')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </label>
            <p>
              Upload medical or other supporting evidence in your employee record before applying if
              the policy requires it.
            </p>
          </ActionForm>
        </section>
      )}
      <section className="card">
        <h2>Leave applications & decisions</h2>
        <Loading
          error={requests.error || policies.error}
          loading={requests.loading || policies.loading}
        />
        {requests.data?.items.map((row) => (
          <article className="live-document" key={row.id}>
            <div>
              <strong>
                {name(row.employeeId)} ·{' '}
                {policies.data?.find((p) => p.id === row.policyId)?.name ?? 'Leave'}
              </strong>
              <p>
                {row.start} — {row.end} · {row.days} working days
              </p>
              <p>{row.reason}</p>
              <span>
                {row.status} · {row.stage}
              </span>
            </div>
            {can(session, 'Leave.Review') &&
              row.employeeId !== session.employeeId &&
              ['Pending', 'Cancellation pending'].includes(row.status) &&
              (row.stage !== 'HR' || can(session, 'Leave.Configure')) && (
                <ActionForm
                  submit="Record decision"
                  onSave={async (data) => {
                    await api('/leave/requests/' + row.id + '/review', 'POST', {
                      status: field(data, 'status'),
                      note: field(data, 'note'),
                      concurrencyStamp: row.concurrencyStamp,
                    });
                    reload();
                  }}
                >
                  <label>
                    Decision
                    <select name="status">
                      <option>Approved</option>
                      <option>Rejected</option>
                    </select>
                  </label>
                  <TextField name="note" label="Decision reason" />
                </ActionForm>
              )}
            {(row.employeeId === session.employeeId || can(session, 'Leave.Configure')) &&
              row.status === 'Pending' && (
                <ActionForm
                  submit="Withdraw request"
                  onSave={async () => {
                    await api(
                      '/leave/requests/' + row.id + '/withdraw',
                      'POST',
                      row.concurrencyStamp,
                    );
                    reload();
                  }}
                >
                  <p>This withdraws the pending application.</p>
                </ActionForm>
              )}
            {row.employeeId === session.employeeId &&
              row.status === 'Approved' &&
              row.start > today() && (
                <ActionForm
                  submit="Request cancellation"
                  onSave={async () => {
                    await api(
                      '/leave/requests/' + row.id + '/cancel',
                      'POST',
                      row.concurrencyStamp,
                    );
                    reload();
                  }}
                >
                  <p>Cancellation follows the original approval stages.</p>
                </ActionForm>
              )}
          </article>
        ))}
        {requests.data?.totalCount === 0 && <Empty>No leave applications.</Empty>}
        <div className="form-actions">
          <button
            className="secondary"
            disabled={offset === 0}
            onClick={() => setOffset((n) => n - 25)}
          >
            Previous
          </button>
          <span>{requests.data?.totalCount ?? 0} requests</span>
          <button
            className="secondary"
            disabled={offset + 25 >= (requests.data?.totalCount ?? 0)}
            onClick={() => setOffset((n) => n + 25)}
          >
            Next
          </button>
        </div>
      </section>
      {can(session, 'Leave.Configure') && (
        <>
          <section className="card">
            <ActionForm
              title="Create a policy version"
              onSave={async (data) => {
                await api('/leave/policies', 'POST', {
                  name: field(data, 'name'),
                  paid: data.has('paid'),
                  limited: data.has('limited'),
                  annualDays: number(data, 'annualDays'),
                  monthlyAccrual: data.has('monthlyAccrual'),
                  carryLimit: number(data, 'carryLimit'),
                  noticeDays: number(data, 'noticeDays'),
                  evidenceAfter: number(data, 'evidenceAfter'),
                  requiresHr: data.has('requiresHr'),
                });
                policies.reload();
              }}
            >
              <TextField label="Policy name" name="name" />
              <TextField label="Annual days" name="annualDays" type="number" value={21} />
              <TextField label="Carry limit" name="carryLimit" type="number" value={5} />
              <TextField label="Notice days" name="noticeDays" type="number" value={0} />
              <TextField
                label="Evidence after (days)"
                name="evidenceAfter"
                type="number"
                value={0}
              />
              {[
                ['paid', 'Paid leave'],
                ['limited', 'Limited balance'],
                ['monthlyAccrual', 'Monthly accrual'],
                ['requiresHr', 'Require HR after manager review'],
              ].map(([key, label]) => (
                <label className="live-check" key={key}>
                  <input
                    name={key}
                    type="checkbox"
                    defaultChecked={key === 'paid' || key === 'limited'}
                  />
                  {label}
                </label>
              ))}
            </ActionForm>
          </section>
          <section className="card">
            <ActionForm
              title="Allocate or adjust leave"
              onSave={async (data) => {
                await api('/leave/entitlements', 'PUT', {
                  employeeId: field(data, 'employeeId'),
                  policyId: field(data, 'policyId'),
                  year: number(data, 'year'),
                  allocation: number(data, 'allocation'),
                  carry: number(data, 'carry'),
                  adjustment: number(data, 'adjustment'),
                  reason: field(data, 'reason'),
                });
                reload();
              }}
            >
              <label>
                Employee
                <select name="employeeId" required defaultValue={employeeId}>
                  <option value="">Choose…</option>
                  {people.data?.items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Policy
                <select name="policyId" required>
                  <option value="">Choose…</option>
                  {policies.data?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · v{p.version}
                    </option>
                  ))}
                </select>
              </label>
              <TextField name="year" label="Year" type="number" value={today().slice(0, 4)} />
              <TextField name="allocation" label="Allocation" type="number" value={21} />
              <TextField name="carry" label="Carry over" type="number" value={0} />
              <TextField name="adjustment" label="Adjustment" type="number" value={0} />
              <TextField name="reason" label="Reason for adjustment" />
            </ActionForm>
          </section>
          <section className="card">
            <ActionForm
              title="Add a public or company holiday"
              onSave={async (data) => {
                await api('/leave/holidays', 'POST', {
                  date: field(data, 'date'),
                  name: field(data, 'name'),
                });
                balances.reload();
              }}
            >
              <TextField name="date" label="Date" type="date" />
              <TextField name="name" label="Holiday name" />
            </ActionForm>
          </section>
        </>
      )}
    </>
  );
}
