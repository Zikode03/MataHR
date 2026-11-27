import {
  ArrowRight,
  ArrowUpRight,
  FileClock,
  LockKeyhole,
  Settings2,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { can, useApi, type Page, type Session } from '../../shared/api';
import type { Account } from './types';

import { Loading } from '../../shared/ui';

type Overview = {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  lockedAccounts: number;
  roles: { role: string; count: number }[];
};
type AuditEvent = { id: string; actorId: string; action: string; at: string };
const roles = [
  { key: 'Admin', name: 'System administrators', description: 'System access and configuration' },
  { key: 'HR', name: 'Human resources', description: 'Employee records and HR operations' },
  { key: 'Manager', name: 'Managers', description: 'Team requests and approvals' },
  { key: 'Employee', name: 'Employees', description: 'Personal records and self-service' },
];
const activityLabels: Record<string, string> = {
  'Account.Created': 'User account created',
  'Account.Activated': 'User account activated',
  'Account.Deactivated': 'User account deactivated',
  'Account.AssignmentChanged': 'User access updated',
  'Role.PermissionChanged': 'Role permissions updated',
  'LegacyImport.ReviewPrepared': 'Import review prepared',
  'LegacyImport.Committed': 'Import completed',
};
export function AdminOverview({ session }: { session: Session }) {
  const overview = useApi<Overview>(can(session, 'Accounts') ? '/admin/overview' : null);
  const accounts = useApi<Page<Account>>(
    can(session, 'Accounts') ? '/admin/accounts?maxResultCount=5' : null,
  );
  const events = useApi<Page<AuditEvent>>(
    can(session, 'Audit') ? '/admin/audit?maxResultCount=4' : null,
  );
  const data = overview.data;
  const needsHr = data && !data.roles.some((r) => r.role === 'HR' && r.count > 0);
  const attention = data
    ? [
        ...(data.lockedAccounts > 0
          ? [
              {
                title: `${data.lockedAccounts} ${data.lockedAccounts === 1 ? 'account is' : 'accounts are'} temporarily locked`,
                description: 'These users may need help signing in.',
                action: 'View accounts',
                to: '/administration/users',
                icon: LockKeyhole,
              },
            ]
          : []),
        ...(needsHr
          ? [
              {
                title: 'No HR role assigned',
                description:
                  'Add an HR account to start managing employees and daily HR operations.',
                action: 'Create HR account',
                to: '/administration/users?createRole=HR#account-form',
                icon: ShieldCheck,
              },
            ]
          : []),
      ]
    : [];
  return (
    <div className="admin-dashboard-v2">
      <Loading loading={overview.loading} error={overview.error} />
      <div className="admin-v2-metrics" aria-label="Account overview">
        {[
          { label: 'Total accounts', value: data?.totalAccounts, icon: Users },
          { label: 'Active', value: data?.activeAccounts, icon: UserCheck },
          { label: 'Inactive', value: data?.inactiveAccounts, icon: UserRoundX },
          { label: 'Locked', value: data?.lockedAccounts, icon: LockKeyhole },
        ].map((item) => (
          <div key={item.label}>
            <span className="admin-v2-metric-icon">
              <item.icon size={19} />
            </span>
            <div>
              <span>{item.label}</span>
              <strong>{item.value ?? '—'}</strong>
            </div>
          </div>
        ))}
      </div>
      {attention.length > 0 && (
        <section className="admin-attention" aria-labelledby="admin-attention-heading">
          <div className="admin-attention-heading">
            <h2 id="admin-attention-heading">Needs attention</h2>
            <span>{attention.length}</span>
          </div>
          {attention.map((item) => (
            <div className="admin-attention-row" key={item.title}>
              <item.icon size={18} aria-hidden="true" />
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
              <Link to={item.to}>
                {item.action}
                <ArrowRight size={15} />
              </Link>
            </div>
          ))}
        </section>
      )}
      <div className="admin-v2-columns">
        <div className="admin-v2-main">
          <section className="admin-v2-panel">
            <div className="admin-v2-panel-head">
              <div>
                <h2>User accounts</h2>
                <p>Review access or open the full account directory.</p>
              </div>
              <Link to="/administration/users">
                View all <ArrowUpRight size={16} />
              </Link>
            </div>
            <Loading loading={accounts.loading} error={accounts.error} />
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Assigned roles</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Manage</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.data?.items.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="admin-v2-person">
                          <span>{account.email[0]?.toUpperCase()}</span>
                          <div>
                            <strong>{account.email}</strong>
                            {account.id === session.id && <small>Your account</small>}
                          </div>
                        </div>
                      </td>
                      <td>{account.roles.join(', ')}</td>
                      <td>
                        <span className={'admin-v2-badge ' + (account.active ? 'enabled' : '')}>
                          {account.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <Link to="/administration/users" aria-label={'Manage ' + account.email}>
                          <ArrowUpRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {accounts.data?.items.length === 0 && (
              <p className="admin-v2-empty">No accounts to display.</p>
            )}
          </section>
          <section className="admin-v2-panel">
            <div className="admin-v2-panel-head">
              <div>
                <h2>Workspace roles</h2>
                <p>Users can hold more than one role.</p>
              </div>
              <Link to="/administration/permissions">
                Manage permissions <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="admin-v2-roles">
              {roles.map((role) => (
                <Link key={role.key} to={'/administration/permissions?role=' + role.key}>
                  <span className="admin-v2-role-count">
                    {data?.roles.find((r) => r.role === role.key)?.count ?? '—'}
                  </span>
                  <div>
                    <strong>{role.name}</strong>
                    <small>{role.description}</small>
                  </div>
                  <ArrowUpRight size={16} />
                </Link>
              ))}
            </div>
            <p className="admin-v2-policy-note">
              <ShieldCheck size={15} />
              System administration does not automatically grant access to personnel or payroll
              records.
            </p>
          </section>
        </div>
        <aside className="admin-v2-aside">
          <section className="admin-v2-panel">
            <div className="admin-v2-panel-head">
              <h2>Quick actions</h2>
            </div>
            <div className="admin-v2-shortcuts">
              {[
                {
                  to: '/settings/security',
                  label: 'Account security',
                  detail: 'Password and two-factor authentication',
                  icon: ShieldCheck,
                },
                {
                  to: '/settings/general',
                  label: 'Workspace settings',
                  detail: 'Organisation and display preferences',
                  icon: Settings2,
                },
                {
                  to: '/imports',
                  label: 'Import existing accounts',
                  detail: 'Review records before importing',
                  icon: FileClock,
                },
              ].map((item) => (
                <Link key={item.to} to={item.to}>
                  <item.icon size={19} />
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </div>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
            </div>
          </section>
          <section className="admin-v2-panel">
            <div className="admin-v2-panel-head">
              <h2>Recent activity</h2>
              {can(session, 'Audit') && (
                <Link to="/administration/audit" aria-label="Open audit trail">
                  <ArrowUpRight size={17} />
                </Link>
              )}
            </div>
            {can(session, 'Audit') ? (
              <>
                <Loading loading={events.loading} error={events.error} />
                {events.data?.items.length === 0 && (
                  <div className="admin-v2-empty">
                    <FileClock size={24} />
                    <strong>No activity yet</strong>
                    <p>Account and access changes will appear here.</p>
                  </div>
                )}
                <div className="admin-v2-timeline">
                  {events.data?.items.map((event) => (
                    <div key={event.id}>
                      <span />
                      <div>
                        <strong>
                          {activityLabels[event.action] ??
                            event.action.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('.', ' · ')}
                        </strong>
                        <small>
                          {event.actorId === session.id ? 'By you' : 'By an authorised user'} ·{' '}
                          {new Intl.DateTimeFormat('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Africa/Johannesburg',
                          }).format(new Date(event.at))}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="admin-v2-empty">Audit access is not assigned to this account.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
