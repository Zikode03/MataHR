import { useApi, type Page } from '../../shared/api';

import { Loading } from '../../shared/ui';
export function AuditTrailPage() {
  const audit = useApi<
    Page<{ id: string; actorId: string; action: string; targetId: string; at: string }>
  >('/admin/audit?maxResultCount=25');
  return (
    <div className="admin-settings-page admin-settings-audit">
      <div className="page-head">
        <div>
          <h1>Audit trail</h1>
          <p>Review recorded changes and actions across your organisation.</p>
        </div>
      </div>{' '}
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
    </div>
  );
}
