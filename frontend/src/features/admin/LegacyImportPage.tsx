import { useState } from 'react';
import { api, can, type Session } from '../../shared/api';

import { ActionForm, Empty } from '../../shared/ui';
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

export function LegacyImportPage({ session }: { session: Session }) {
  const [kind, setKind] = useState(can(session, 'Accounts') ? 'Accounts' : 'Employees'),
    [preview, setPreview] = useState<ImportPreview | null>(null),
    [credentials, setCredentials] = useState<{ email: string; temporaryPassword: string }[]>([]);

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
                  // Carry the fingerprint from the reviewed preview so the API can reject a changed source.
                  fingerprint: preview.fingerprint,
                  confirmed: true,
                });
                setCredentials(result.credentials);
                setPreview({ ...preview, committed: true });
              }}
            >
              <label className="app-check">
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
            <p className="app-success" role="status">
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
            <div className="app-document" key={item.email}>
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
}
