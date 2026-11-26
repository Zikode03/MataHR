import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api, useApi, can, type Session, type Page, type Account, type Role } from './api';
import { ActionForm, field, optional, TextField, Loading, Empty } from './shared';
type ImportPreview = {
  id: string;
  kind: string;
  expiresAt: string;
  fingerprint: string;
  rows: { sourceId: string; label: string; status: string; detail: string }[];
  canCommit: boolean;
  committed: boolean;
  sourceTenantId: string;
  targetTenantId: string;
};
export function AdminPage({ session, imports = false }: { session: Session; imports?: boolean }) {
  const { section } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const tab = section === 'permissions' || section === 'audit' ? section : 'users';
  const setTab = (value: string) => navigate('/administration/' + value);
  const [selected, setSelected] = useState<Account | null>(null),
    [offset, setOffset] = useState(0),
    [role, setRole] = useState<Role>(
      ['Admin', 'HR', 'Manager', 'Employee'].includes(search.get('role') ?? '')
        ? (search.get('role') as Role)
        : 'HR',
    ),
    [kind, setKind] = useState(can(session, 'Accounts') ? 'Accounts' : 'Employees'),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [credentials, setCredentials] = useState<{ email: string; temporaryPassword: string }[]>([]);
  const accounts = useApi<Page<Account>>(
      !imports && tab === 'users' ? '/admin/accounts?maxResultCount=25&skipCount=' + offset : null,
    ),
    links = useApi<{ id: string; number: string; name: string }[]>(
      !imports && tab === 'users' ? '/admin/employee-links' : null,
    ),
    permissions = useApi<{ permission: string; granted: boolean }[]>(
      !imports && tab === 'permissions' ? '/admin/role-permissions?role=' + role : null,
    ),
    audit = useApi<
      Page<{ id: string; actorId: string; action: string; targetId: string; at: string }>
    >(!imports && tab === 'audit' ? '/admin/audit?maxResultCount=25' : null);
  if (imports)
    return (
      <>
        <div className="page-head">
          <div>
            <div className="eyebrow">DATA / REVIEWED IMPORT</div>
            <h1>Legacy data import</h1>
            <p>
              Review the source records, resolve conflicts, then explicitly import the reviewed
              snapshot. Existing records and credentials are never overwritten.
            </p>
          </div>
        </div>
        <section className="card">
          <ActionForm
            title="Prepare an import review"
            submit="Review source data"
            onSave={async () => {
              setPreview(await api<ImportPreview>('/imports/preview', 'POST', { kind }));
              setCredentials([]);
            }}
          >
            <label>
              Data to review
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setPreview(null);
                }}
              >
                {can(session, 'Accounts') && <option>Accounts</option>}
                {can(session, 'People.Write') && <option>Employees</option>}
              </select>
            </label>
          </ActionForm>
        </section>
        {preview && (
          <section className="card">
            <h2>{preview.kind} · review</h2>
            {preview.sourceTenantId !== preview.targetTenantId && (
              <details>
                <summary>Explicit organisation mapping is configured</summary>
                <p>
                  Source: {preview.sourceTenantId}
                  <br />
                  Destination: {preview.targetTenantId}
                </p>
              </details>
            )}
            <p>
              Review expires {new Date(preview.expiresAt).toLocaleString()}. The source is checked
              again before import.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Result</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.sourceId}>
                      <td>{row.label}</td>
                      <td>{row.status}</td>
                      <td>{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows.length === 0 && <Empty>No legacy records exist for this tenant.</Empty>}
            {!preview.canCommit && (
              <p className="notice">
                Resolve the reported conflicts before preparing a new review. Nothing has been
                imported.
              </p>
            )}
            {preview.canCommit && !preview.committed && (
              <ActionForm
                submit="Import reviewed records"
                onSave={async (data) => {
                  if (!data.has('confirmed')) throw Error('Confirm that you reviewed the records.');
                  const result = await api<{
                    credentials: { email: string; temporaryPassword: string }[];
                  }>('/imports/' + preview.id + '/commit', 'POST', {
                    fingerprint: preview.fingerprint,
                    confirmed: true,
                  });
                  setCredentials(result.credentials);
                  setPreview({ ...preview, committed: true });
                }}
              >
                <label className="live-check">
                  <input name="confirmed" type="checkbox" required />I reviewed these records and
                  authorise this import.
                </label>
                <p>
                  Imported accounts receive one-time temporary credentials. Existing accounts keep
                  their current credentials and permissions.
                </p>
              </ActionForm>
            )}
            {preview.committed && (
              <p className="live-success" role="status">
                The reviewed import is complete.
              </p>
            )}
          </section>
        )}
        {credentials.length > 0 && (
          <section className="card">
            <h2>One-time account credentials</h2>
            <p>
              Share each temporary password securely with its account owner. These values are not
              available after leaving this page. Users must change them before opening their
              workspace.
            </p>
            {credentials.map((item) => (
              <div className="live-document" key={item.email}>
                <strong>{item.email}</strong>
                <code>{item.temporaryPassword}</code>
              </div>
            ))}
            <button className="secondary" onClick={() => setCredentials([])}>
              Clear credentials from this page
            </button>
          </section>
        )}
      </>
    );
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">SYSTEM ADMINISTRATION</div>
          <h1>Users & access</h1>
          <p>
            Assign accounts and permissions without granting automatic access to confidential HR
            records.
          </p>
        </div>
      </div>
      <div className="life-nav" aria-label="Administration sections">
        {(['users', 'permissions', 'audit'] as const).map((item) => (
          <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item === 'users'
              ? 'Users & access'
              : item === 'permissions'
                ? 'Role permissions'
                : 'Audit trail'}
          </button>
        ))}
      </div>
      {tab === 'users' && (
        <>
          <Loading error={accounts.error || links.error} loading={accounts.loading} />
          <section className="card">
            <h2>Assigned accounts</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Roles</th>
                    <th>State</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {accounts.data?.items.map((account) => (
                    <tr key={account.id}>
                      <td>{account.email}</td>
                      <td>{account.roles.join(', ')}</td>
                      <td>{account.active ? 'Active' : 'Inactive'}</td>
                      <td>
                        {account.id !== session.id ? (
                          <button className="secondary" onClick={() => setSelected(account)}>
                            Edit access
                          </button>
                        ) : (
                          <span>Your account</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button
                className="secondary"
                disabled={offset === 0}
                onClick={() => setOffset((n) => n - 25)}
              >
                Previous
              </button>
              <span>{accounts.data?.totalCount ?? 0} accounts</span>
              <button
                className="secondary"
                disabled={offset + 25 >= (accounts.data?.totalCount ?? 0)}
                onClick={() => setOffset((n) => n + 25)}
              >
                Next
              </button>
            </div>
          </section>
          <section className="card" id="account-form">
            <ActionForm
              key={selected?.id ?? 'new'}
              title={selected ? 'Edit ' + selected.email : 'Create account'}
              onSave={async (data) => {
                const body = {
                  roles: data.getAll('roles'),
                  employeeId: optional(data, 'employeeId'),
                  ...(selected
                    ? { active: data.has('active'), concurrencyStamp: selected.concurrencyStamp }
                    : { email: field(data, 'email'), password: field(data, 'password') }),
                };
                await api(
                  selected ? '/admin/accounts/' + selected.id : '/admin/accounts',
                  selected ? 'PUT' : 'POST',
                  body,
                );
                accounts.reload();
                setSelected(null);
              }}
            >
              {!selected && (
                <>
                  <TextField label="Work email" name="email" type="email" />
                  <label>
                    Initial password
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      minLength={14}
                      required
                    />
                    <small>
                      At least 14 characters, with upper/lowercase letters, a digit and a symbol.
                    </small>
                  </label>
                </>
              )}
              <label>
                Employee link
                <select name="employeeId" defaultValue={selected?.employeeId ?? ''}>
                  <option value="">Not linked</option>
                  {links.data?.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.number} · {person.name}
                    </option>
                  ))}
                </select>
                <small>Employee and Manager roles require an employee link.</small>
              </label>
              <fieldset>
                <legend>Assigned roles</legend>
                {(['Admin', 'HR', 'Manager', 'Employee'] as Role[]).map((r) => (
                  <label className="live-check" key={r}>
                    <input
                      name="roles"
                      type="checkbox"
                      value={r}
                      defaultChecked={selected?.roles.includes(r) ?? r === 'Employee'}
                    />
                    {r}
                  </label>
                ))}
              </fieldset>
              {selected && (
                <label className="live-check">
                  <input type="checkbox" name="active" defaultChecked={selected.active} />
                  Account active
                </label>
              )}
            </ActionForm>
            {selected && (
              <button className="secondary" onClick={() => setSelected(null)}>
                Cancel editing
              </button>
            )}
          </section>
        </>
      )}
      {tab === 'permissions' && (
        <section className="card">
          <h2>Role permissions</h2>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(['Admin', 'HR', 'Manager', 'Employee'] as Role[]).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <Loading error={permissions.error} loading={permissions.loading} />
          {permissions.data?.map((grant) => (
            <ActionForm
              key={role + grant.permission + String(grant.granted)}
              submit="Update grant"
              onSave={async (data) => {
                await api('/admin/role-permissions', 'PUT', {
                  role,
                  permission: grant.permission,
                  granted: data.has('granted'),
                });
                permissions.reload();
              }}
            >
              <label className="live-check">
                <input type="checkbox" name="granted" defaultChecked={grant.granted} />
                {grant.permission}
              </label>
            </ActionForm>
          ))}
        </section>
      )}
      {tab === 'audit' && (
        <section className="card">
          <h2>Recent audit events</h2>
          <Loading error={audit.error} loading={audit.loading} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.data?.items.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.at).toLocaleString()}</td>
                    <td>{row.action}</td>
                    <td>{row.actorId}</td>
                    <td>{row.targetId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
