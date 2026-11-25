import { useState } from 'react';
import { api, useApi, can, download, month, type Session, type Page, type Employee } from './api';
import { ActionForm, field, number, optional, TextField, Loading, Empty } from './shared';
type Benefit = {
  id: string;
  employeeId: string;
  name: string;
  employer: number;
  employeeCost: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};
type Run = {
  id: string;
  period: string;
  status: string;
  hash: string;
  preparedBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  concurrencyStamp: string;
};
type Payslip = {
  id: string;
  employeeId: string;
  runId: string;
  documentId: string;
  released: boolean;
};
type Readiness = {
  period: string;
  ready: boolean;
  issues: string[];
  rows: {
    employeeId: string;
    number: string;
    basic: number;
    allowance: number;
    deduction: number;
    employerBenefits: number;
    employeeBenefits: number;
    approvedHours: number;
    overtimeHours: number;
    overtimePay: number;
    unpaidDays: number;
    pending: number;
  }[];
};
type Salary = {
  employeeId: string;
  basic: number;
  allowance: number;
  deduction: number;
  hourlyRate: number;
  overtimeMultiplier: number;
  effectiveFrom: string;
};
const zar = (value: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(value);
export function PayrollPage({ session }: { session: Session }) {
  const manage = can(session, 'Payroll.Manage'),
    [period, setPeriod] = useState(month()),
    [feedback, setFeedback] = useState('');
  const people = useApi<Page<Employee>>(manage ? '/employees?maxResultCount=200' : null),
    benefits = useApi<Benefit[]>('/payroll/benefits'),
    payslips = useApi<Payslip[]>('/payroll/payslips'),
    runs = useApi<Run[]>(manage ? '/payroll/runs' : null),
    readiness = useApi<Readiness>(manage ? '/payroll/readiness?period=' + period : null),
    salaries = useApi<Salary[]>(manage ? '/payroll/salaries' : null),
    documents = useApi<{ id: string; employeeId: string; name: string; verified: boolean }[]>(
      manage ? '/payroll/documents' : null,
    );
  const name = (id: string) =>
    people.data?.items.find((p) => p.id === id)?.name ?? (id === session.employeeId ? 'You' : id);
  const refresh = () => {
    runs.reload();
    readiness.reload();
    benefits.reload();
    payslips.reload();
    salaries.reload();
  };
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">DAILY WORKSPACE / PAYROLL</div>
          <h1>{manage ? 'Payroll & benefits' : 'My payslips & benefits'}</h1>
          <p>
            {manage
              ? 'Prepare dated inputs, reconcile sources and release verified provider payslips.'
              : 'Your released payslips and benefit enrollments.'}
          </p>
        </div>
        {manage && (
          <label>
            Pay period
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
        )}
      </div>
      {feedback && (
        <p role="alert" className="notice live-error">
          {feedback}
        </p>
      )}
      {manage && (
        <>
          <section className="card">
            <h2>Payroll readiness · {period}</h2>
            <Loading error={readiness.error} loading={readiness.loading} />
            {readiness.data?.issues.map((issue, i) => (
              <p key={i} className="notice live-error">
                {issue}
              </p>
            ))}
            {readiness.data?.ready && (
              <p className="live-success">Inputs are reconciled and ready for review.</p>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Basic</th>
                    <th>Allowance</th>
                    <th>Deductions</th>
                    <th>Approved hours</th>
                    <th>Overtime</th>
                    <th>Unpaid days</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.data?.rows.map((row) => (
                    <tr key={row.employeeId}>
                      <td>{name(row.employeeId)}</td>
                      <td>{zar(row.basic)}</td>
                      <td>{zar(row.allowance)}</td>
                      <td>{zar(row.deduction + row.employeeBenefits)}</td>
                      <td>{row.approvedHours}</td>
                      <td>{zar(row.overtimePay)}</td>
                      <td>{row.unpaidDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ActionForm
              submit="Prepare / regenerate draft"
              onSave={async () => {
                await api('/payroll/runs', 'POST', { period });
                refresh();
              }}
            >
              <p>
                Drafts preserve their source fingerprint. Changed sources must be reconciled before
                review or approval.
              </p>
            </ActionForm>
          </section>
          <section className="card">
            <h2>Payroll runs</h2>
            <Loading error={runs.error} loading={runs.loading} />
            {runs.data?.map((run) => (
              <article key={run.id} className="live-document">
                <div>
                  <strong>{run.period}</strong>
                  <p>{run.status}</p>
                </div>
                {run.status !== 'Approved' ? (
                  <ActionForm
                    submit={run.status === 'Draft' ? 'Mark reviewed' : 'Approve payroll inputs'}
                    onSave={async (data) => {
                      await api('/payroll/runs/' + run.id + '/transition', 'POST', {
                        status: run.status === 'Draft' ? 'Reviewed' : 'Approved',
                        note: field(data, 'note'),
                        concurrencyStamp: run.concurrencyStamp,
                      });
                      refresh();
                    }}
                  >
                    <TextField label="Review reason" name="note" />
                    <p>
                      Review and final approval require the independent users enforced by the
                      backend.
                    </p>
                  </ActionForm>
                ) : (
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        const exported = await api<{ period: string; contentJson: string }>(
                          '/payroll/runs/' + run.id + '/export',
                        );
                        const url = URL.createObjectURL(
                          new Blob([exported.contentJson], { type: 'application/json' }),
                        );
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'payroll-inputs-' + run.period + '.json';
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch (error) {
                        setFeedback(error instanceof Error ? error.message : 'Export failed.');
                      }
                    }}
                  >
                    Export approved inputs
                  </button>
                )}
              </article>
            ))}
            {!runs.data?.length && <Empty>No payroll runs prepared.</Empty>}
          </section>
          <section className="card">
            <h2>Compensation history</h2>
            <Loading error={salaries.error} loading={salaries.loading} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Effective from</th>
                    <th>Basic</th>
                    <th>Allowance</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.data?.map((row) => (
                    <tr key={row.employeeId + row.effectiveFrom}>
                      <td>{name(row.employeeId)}</td>
                      <td>{row.effectiveFrom}</td>
                      <td>{zar(row.basic)}</td>
                      <td>{zar(row.allowance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ActionForm
              title="Add compensation revision"
              onSave={async (data) => {
                await api('/payroll/salaries', 'PUT', {
                  employeeId: field(data, 'employeeId'),
                  effectiveFrom: field(data, 'effectiveFrom'),
                  basic: number(data, 'basic'),
                  allowance: number(data, 'allowance'),
                  deduction: number(data, 'deduction'),
                  hourlyRate: number(data, 'hourlyRate'),
                  overtimeMultiplier: number(data, 'overtimeMultiplier'),
                });
                refresh();
              }}
            >
              <EmployeeSelect people={people.data?.items ?? []} />
              <TextField
                name="effectiveFrom"
                label="Effective from (first of month)"
                type="date"
                value={period + '-01'}
              />
              {[
                ['basic', 'Monthly basic'],
                ['allowance', 'Allowance'],
                ['deduction', 'Deduction'],
                ['hourlyRate', 'Hourly overtime rate'],
                ['overtimeMultiplier', 'Overtime multiplier'],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    name={key}
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    defaultValue={key === 'overtimeMultiplier' ? 1.5 : 0}
                  />
                </label>
              ))}
            </ActionForm>
          </section>
        </>
      )}
      <section className="card">
        <h2>Benefits</h2>
        <Loading error={benefits.error} loading={benefits.loading} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {manage && <th>Employee</th>}
                <th>Benefit</th>
                <th>Employer contribution</th>
                <th>Employee contribution</th>
                <th>Effective period</th>
              </tr>
            </thead>
            <tbody>
              {benefits.data?.map((b) => (
                <tr key={b.id}>
                  {manage && <td>{name(b.employeeId)}</td>}
                  <td>{b.name}</td>
                  <td>{zar(b.employer)}</td>
                  <td>{zar(b.employeeCost)}</td>
                  <td>
                    {b.effectiveFrom} — {b.effectiveTo ?? 'Ongoing'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!benefits.data?.length && <Empty>No benefit enrollments.</Empty>}
        {manage && (
          <ActionForm
            title="Enroll an employee in a benefit"
            onSave={async (data) => {
              await api('/payroll/benefits', 'POST', {
                employeeId: field(data, 'employeeId'),
                name: field(data, 'name'),
                employer: number(data, 'employer'),
                employeeCost: number(data, 'employeeCost'),
                effectiveFrom: field(data, 'effectiveFrom'),
                effectiveTo: optional(data, 'effectiveTo'),
              });
              refresh();
            }}
          >
            <EmployeeSelect people={people.data?.items ?? []} />
            <TextField name="name" label="Benefit name" />
            <label>
              Employer contribution
              <input type="number" name="employer" min="0" step="0.01" required />
            </label>
            <label>
              Employee contribution
              <input type="number" name="employeeCost" min="0" step="0.01" required />
            </label>
            <TextField
              name="effectiveFrom"
              label="Effective from (first of month)"
              type="date"
              value={period + '-01'}
            />
            <TextField
              name="effectiveTo"
              label="Exclusive end (first of month)"
              type="date"
              required={false}
            />
          </ActionForm>
        )}
      </section>
      <section className="card">
        <h2>{manage ? 'Provider payslips' : 'My payslips'}</h2>
        <Loading error={payslips.error || documents.error} loading={payslips.loading} />
        {payslips.data?.map((p) => (
          <div key={p.id} className="live-document">
            <span>
              <strong>{manage ? name(p.employeeId) : 'Payslip'}</strong>
              <small>
                {runs.data?.find((r) => r.id === p.runId)?.period ?? p.runId} ·{' '}
                {p.released ? 'Released' : 'Not released'}
              </small>
            </span>
            <button
              className="secondary"
              onClick={async () => {
                try {
                  download(await api('/payroll/payslips/' + p.id + '/download'));
                } catch (error) {
                  setFeedback(error instanceof Error ? error.message : 'Download failed.');
                }
              }}
            >
              Download
            </button>
            {manage && !p.released && (
              <ActionForm
                submit="Release to employee"
                onSave={async () => {
                  await api('/payroll/payslips/' + p.id + '/release', 'POST');
                  payslips.reload();
                }}
              >
                <p>Release this verified payslip to the employee.</p>
              </ActionForm>
            )}
          </div>
        ))}
        {!payslips.data?.length && <Empty>No released payslips are available.</Empty>}
        {manage && (
          <>
            <p>
              Upload provider PDFs through the employee record, then have another HR user verify
              them here.
            </p>
            {documents.data
              ?.filter((d) => !d.verified)
              .map((d) => (
                <ActionForm
                  key={d.id}
                  title={d.name}
                  submit="Verify provider payslip"
                  onSave={async (data) => {
                    await api('/documents/' + d.id + '/verify', 'POST', {
                      purpose: 'Payslip',
                      attestation: field(data, 'note'),
                      signedOn: null,
                    });
                    documents.reload();
                  }}
                >
                  <p>{name(d.employeeId)}</p>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () => {
                      try {
                        download(await api('/payroll/documents/' + d.id + '/download'));
                      } catch (error) {
                        setFeedback(
                          error instanceof Error
                            ? error.message
                            : 'Unable to inspect this payslip.',
                        );
                      }
                    }}
                  >
                    Inspect uploaded payslip
                  </button>
                  <TextField name="note" label="Verification attestation" />
                </ActionForm>
              ))}
            <ActionForm
              title="Attach verified provider payslip"
              onSave={async (data) => {
                await api('/payroll/runs/' + field(data, 'runId') + '/payslips', 'POST', {
                  employeeId: field(data, 'employeeId'),
                  documentId: field(data, 'documentId'),
                });
                payslips.reload();
              }}
            >
              <EmployeeSelect people={people.data?.items ?? []} />
              <label>
                Approved payroll run
                <select name="runId" required>
                  <option value="">Choose…</option>
                  {runs.data
                    ?.filter((r) => r.status === 'Approved')
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.period}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Verified document
                <select name="documentId" required>
                  <option value="">Choose…</option>
                  {documents.data
                    ?.filter((d) => d.verified)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {name(d.employeeId)} · {d.name}
                      </option>
                    ))}
                </select>
              </label>
            </ActionForm>
          </>
        )}
      </section>
    </>
  );
}
function EmployeeSelect({ people }: { people: Employee[] }) {
  return (
    <label>
      Employee
      <select name="employeeId" required>
        <option value="">Choose…</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
