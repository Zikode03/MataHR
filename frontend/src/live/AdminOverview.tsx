import { Link } from 'react-router-dom';
import { ArrowUpRight, Users, ShieldCheck, UserCheck, LockKeyhole, ArrowRight } from 'lucide-react';
import { can, useApi, type Session, type Page, type Account } from './api';
import { Loading } from './shared';

type Overview = {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  lockedAccounts: number;
  roles: { role: string; count: number }[];
};
type Event = { id: string; actorId: string; action: string; targetId: string; at: string };
const roleNames: Record<string, string> = {
  Admin: 'System administrators',
  HR: 'Human resources',
  Manager: 'Managers',
  Employee: 'Employees',
};
const roleDetails: Record<string, string> = {
  Admin: 'Accounts, permissions and system audit',
  HR: 'People, contracts and HR operations',
  Manager: 'Team requests and approvals',
  Employee: 'Personal information and requests',
};

export function AdminOverview({ session }: { session: Session }) {
  const overview = useApi<Overview>(can(session, 'Accounts') ? '/admin/overview' : null);
  const accounts = useApi<Page<Account>>(
    can(session, 'Accounts') ? '/admin/accounts?maxResultCount=5' : null,
  );
  const events = useApi<Page<Event>>(
    can(session, 'Audit') ? '/admin/audit?maxResultCount=5' : null,
  );
  const data = overview.data;
  const hrReady = !!data?.roles.some((r) => r.role === 'HR' && r.count > 0);
  return (
    <>
      <Loading loading={overview.loading} error={overview.error} />
      <div className="admin-overview">
        <div className="admin-metrics" aria-label="Account overview">
          {[
            {
              label: 'Total accounts',
              value: data?.totalAccounts,
              icon: Users,
              detail: 'All registered users',
            },
            {
              label: 'Active accounts',
              value: data?.activeAccounts,
              icon: UserCheck,
              detail: 'Enabled for sign-in',
            },
            {
              label: 'Inactive accounts',
              value: data?.inactiveAccounts,
              icon: ShieldCheck,
              detail: 'Access disabled',
            },
            {
              label: 'Locked accounts',
              value: data?.lockedAccounts,
              icon: LockKeyhole,
              detail: 'Temporary sign-in lockouts',
            },
          ].map((item) => (
            <div className="admin-metric" key={item.label}>
              <div>
                <span>{item.label}</span>
                <item.icon size={18} aria-hidden="true" />
              </div>
              <strong>{item.value ?? '—'}</strong>
              <small>{item.detail}</small>
            </div>
          ))}
        </div>
        <section className="card admin-setup">
          <span className="admin-setup-icon">
            <ShieldCheck size={22} aria-hidden="true" />
          </span>
          <div>
            <h2>Set up your people workspace</h2>
            <p>
              {data
                ? hrReady
                  ? 'HR roles are assigned. Manage accounts and review access as your team grows.'
                  : 'Create an HR account so your team can add employees and manage daily HR operations.'
                : 'Checking your organisation’s account setup…'}
            </p>
          </div>
          <Link className="secondary" to="/administration/users#account-form">
            {hrReady ? 'Manage accounts' : 'Create HR account'} <ArrowRight size={15} />
          </Link>
        </section>
        <div className="admin-workspace-grid">
          <section className="card">
            <div className="admin-section-head">
              <div>
                <h2>Accounts & access</h2>
                <p>Manage who can use MataHR.</p>
              </div>
              <Link to="/administration/users">
                View all <ArrowUpRight size={16} />
              </Link>
            </div>
            <Loading loading={accounts.loading} error={accounts.error} />
            <div className="admin-account-list">
              {accounts.data?.items.map((account) => (
                <Link to="/administration/users" key={account.id}>
                  <span className="admin-account-avatar">
                    {account.email.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{account.email}</strong>
                    <small>
                      {account.roles.join(' · ')}
                      {account.id === session.id ? ' · You' : ''}
                    </small>
                  </div>
                  <span className={'admin-status ' + (account.active ? 'is-active' : '')}>
                    {account.active ? 'Active' : 'Inactive'}
                  </span>
                </Link>
              ))}
            </div>
            <Link className="primary" to="/administration/users#account-form">
              Add a user
            </Link>
          </section>
          <section className="card">
            <div className="admin-section-head">
              <div>
                <h2>Roles & permissions</h2>
                <p>Four workspaces with separate responsibilities.</p>
              </div>
              <ShieldCheck size={20} aria-hidden="true" />
            </div>
            <div className="admin-role-list">
              {(
                data?.roles ??
                ['Admin', 'HR', 'Manager', 'Employee'].map((role) => ({ role, count: null }))
              ).map((item) => (
                <Link key={item.role} to={'/administration/permissions?role=' + item.role}>
                  <div>
                    <strong>{roleNames[item.role]}</strong>
                    <small>{roleDetails[item.role]}</small>
                  </div>
                  <span>{item.count ?? '—'}</span>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
            <p className="admin-footnote">
              A user can hold more than one role. System access does not automatically grant
              personnel or payroll access.
            </p>
          </section>
        </div>
        <section className="card">
          <div className="admin-section-head">
            <div>
              <h2>Recent activity</h2>
              <p>Recorded changes across your organisation.</p>
            </div>
            {can(session, 'Audit') && (
              <Link to="/administration/audit">
                Open audit trail <ArrowUpRight size={16} />
              </Link>
            )}
          </div>
          {can(session, 'Audit') ? (
            <>
              <Loading loading={events.loading} error={events.error} />
              {events.data && events.data.items.length === 0 && (
                <div className="admin-empty">
                  <ShieldCheck size={24} />
                  <div>
                    <strong>No changes recorded yet</strong>
                    <p>Account creation, access changes and workforce actions will appear here.</p>
                  </div>
                </div>
              )}
              <div className="admin-event-list">
                {events.data?.items.map((event) => (
                  <div key={event.id}>
                    <span className="admin-event-dot" />
                    <div>
                      <strong>
                        {event.action.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('.', ' · ')}
                      </strong>
                      <small>
                        {event.actorId === session.id ? 'By you' : 'By an authorised user'}
                      </small>
                    </div>
                    <time dateTime={event.at}>
                      {new Intl.DateTimeFormat('en-ZA', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'Africa/Johannesburg',
                      }).format(new Date(event.at))}
                    </time>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p>Audit access has not been assigned to this account.</p>
          )}
        </section>
        <div className="admin-import-strip">
          <div>
            <strong>Bringing existing accounts into MataHR?</strong>
            <p>
              Review the source records before importing. Existing passwords and permissions are
              preserved.
            </p>
          </div>
          <Link to="/imports">
            Review existing accounts <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
