import { RolePermissions } from './RolePermissions';
import { UserManagement } from './UserManagement';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, useApi, can, type Session, type Page } from './api';
import { ActionForm, field, Loading, Empty } from './shared';
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

  const tab = section === 'permissions' || section === 'audit' ? section : 'users';
  const [kind, setKind] = useState(can(session, 'Accounts') ? 'Accounts' : 'Employees'),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [credentials, setCredentials] = useState<{ email: string; temporaryPassword: string }[]>([]);
  const audit = useApi<
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
    <div className={'admin-settings-page admin-settings-' + tab}>
      <div className="page-head">
        <div>
          <h1>
            {tab === 'users'
              ? 'User management'
              : tab === 'permissions'
                ? 'Roles & permissions'
                : 'Audit trail'}
          </h1>
          <p>
            {tab === 'users'
              ? 'Create accounts and manage access to your organisation.'
              : tab === 'permissions'
                ? 'Define what each role can access and manage.'
                : 'Review recorded changes and actions across your organisation.'}
          </p>
        </div>
      </div>
      {tab === 'users' && <UserManagement session={session} />}
      {tab === 'permissions' && <RolePermissions />}
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
                {audit.data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4}>No audit events yet. Recorded changes will appear here.</td>
                  </tr>
                )}
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
    </div>
  );
}
