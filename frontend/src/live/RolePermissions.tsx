import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  BriefcaseBusiness,
  UserRound,
  Search,
  LockKeyhole,
  Check,
  RotateCcw,
} from 'lucide-react';
import { api, message, useApi, type Role } from './api';
const roles: { key: Role; name: string; description: string; icon: typeof Users }[] = [
  {
    key: 'Admin',
    name: 'System administrator',
    description: 'System access and configuration',
    icon: ShieldCheck,
  },
  {
    key: 'HR',
    name: 'Human resources',
    description: 'People and HR operations',
    icon: BriefcaseBusiness,
  },
  { key: 'Manager', name: 'Manager', description: 'Team requests and approvals', icon: Users },
  {
    key: 'Employee',
    name: 'Employee',
    description: 'Personal records and requests',
    icon: UserRound,
  },
];
type Grant = { permission: string; granted: boolean };
const labels: Record<string, [string, string]> = {
  Dashboard: ['View dashboard', 'Open the workforce overview available to this role.'],
  'People.Read': ['View employee records', 'View records within the user’s permitted scope.'],
  'People.Write': [
    'Manage employee records',
    'Create and update employee and employment information.',
  ],
  'Organisation.Read': ['View organisation', 'View the organisation and reporting structure.'],
  'Organisation.Write': [
    'Manage organisation',
    'Maintain departments, positions and reporting lines.',
  ],
  'Attendance.Own': [
    'Manage own attendance',
    'Clock in, clock out and submit personal time requests.',
  ],
  'Attendance.Review': [
    'Review attendance',
    'Review attendance, corrections and overtime in the permitted scope.',
  ],
  'Attendance.Configure': [
    'Configure attendance',
    'Manage work locations, boundaries and schedules.',
  ],
  'Leave.Own': ['Manage own leave', 'View balances and submit personal leave requests.'],
  'Leave.Review': ['Review leave requests', 'Review requests within the user’s permitted scope.'],
  'Leave.Configure': ['Configure leave', 'Manage policies, allocations and public holidays.'],
  'Payroll.Own': [
    'View own payslips and benefits',
    'Access released payslips and personal benefit information.',
  ],
  'Payroll.Manage': [
    'Manage payroll',
    'Manage compensation inputs, payroll runs and payslip release.',
  ],
  Accounts: ['Manage users and permissions', 'Create accounts, assign roles and configure access.'],
  Audit: ['View audit trail', 'View recorded actions within the organisation.'],
};
const groups: Record<string, string> = {
  Dashboard: 'Overview',
  People: 'Employee records',
  Organisation: 'Organisation structure',
  Attendance: 'Digital register',
  Leave: 'Leave management',
  Payroll: 'Payroll & benefits',
  Accounts: 'System administration',
  Audit: 'System administration',
};
export function RolePermissions() {
  const [search, setSearch] = useSearchParams();
  const role: Role = roles.find((role) => role.key === search.get('role'))?.key ?? 'HR';
  const [blocked, setBlocked] = useState(false);
  const counts = useApi<{ roles: { role: string; count: number }[] }>('/admin/overview');
  return (
    <div className="role-management">
      <nav className="role-selector" aria-label="Select a role">
        <div className="role-selector-caption">WORKSPACE ROLES</div>
        {roles.map((item) => (
          <button
            key={item.key}
            className={role === item.key ? 'active' : ''}
            aria-pressed={role === item.key}
            disabled={blocked && role !== item.key}
            onClick={() => setSearch({ role: item.key })}
          >
            <span className="role-selector-icon">
              <item.icon size={19} />
            </span>
            <span>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </span>
            <span className="role-user-count" aria-label={item.name + ' account count'}>
              {counts.data?.roles.find((count) => count.role === item.key)?.count ?? '—'}
            </span>
          </button>
        ))}
        <p>
          Permissions apply to everyone assigned to a role. Save or discard changes before switching
          roles.
        </p>
      </nav>
      <RoleEditor key={role} role={role} onBlocked={setBlocked} />
    </div>
  );
}
function RoleEditor({ role, onBlocked }: { role: Role; onBlocked: (value: boolean) => void }) {
  const [grants, setGrants] = useState<Grant[]>([]),
    [changes, setChanges] = useState<Record<string, boolean>>({}),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState(''),
    [query, setQuery] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    api<Grant[]>('/admin/role-permissions?role=' + role, 'GET', undefined, controller.signal)
      .then((data) => {
        setGrants(data);
        setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(message(error));
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [role]);
  const changed = Object.keys(changes).length;
  useEffect(() => {
    onBlocked(changed > 0 || saving);
    return () => onBlocked(false);
  }, [changed, saving, onBlocked]);
  const selected = roles.find((item) => item.key === role)!;
  const grouped = new Map<string, Grant[]>();
  for (const grant of grants) {
    const key = grant.permission.replace(/^Workforce\./, '');
    const text = labels[key] ?? [
      key.replaceAll('.', ' · '),
      'Access is limited by server-side permissions.',
    ];
    if (
      query &&
      !(text.join(' ') + ' ' + grant.permission).toLowerCase().includes(query.toLowerCase())
    )
      continue;
    const group = groups[key.split('.')[0]] ?? 'Other permissions';
    grouped.set(group, [...(grouped.get(group) ?? []), grant]);
  }
  const enabled = grants.filter((grant) => changes[grant.permission] ?? grant.granted).length;
  async function save() {
    setSaving(true);
    setError('');
    setFeedback('');
    let saved = 0;
    try {
      for (const [permission, granted] of Object.entries(changes)) {
        await api('/admin/role-permissions', 'PUT', { role, permission, granted });
        setGrants((current) =>
          current.map((item) => (item.permission === permission ? { ...item, granted } : item)),
        );
        setChanges((current) => {
          const next = { ...current };
          delete next[permission];
          return next;
        });
        saved++;
      }
      setFeedback(
        saved === 1
          ? 'Permission updated successfully.'
          : saved + ' permissions updated successfully.',
      );
    } catch (error) {
      setError(
        (saved ? 'Saved ' + saved + ' changes. Remaining changes were not saved. ' : '') +
          message(error),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="role-editor">
      <div className="role-editor-heading">
        <div>
          <span className="role-eyebrow">ROLE CONFIGURATION</span>
          <h2>Role permissions</h2>
          <p>
            <strong>{selected.name}</strong> · {selected.description}
          </p>
        </div>
        <span className="role-saved-state">
          {loading ? (
            'Loading…'
          ) : error && grants.length === 0 ? (
            'Unavailable'
          ) : changed ? (
            <>
              <span className="role-unsaved-dot" />
              {changed} unsaved
            </>
          ) : (
            <>
              <Check size={15} />
              Up to date
            </>
          )}
        </span>
      </div>
      <div className="role-editor-summary">
        <span>
          <strong>{loading ? '—' : enabled}</strong> permissions enabled
        </span>
        <span>{loading ? 'Loading permissions…' : grants.length + ' available'}</span>
      </div>
      <div className="role-permission-search">
        <Search size={18} />
        <input
          aria-label="Search permissions"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search permissions…"
        />
      </div>
      {loading && (
        <p role="status" className="role-feedback">
          Loading role permissions…
        </p>
      )}
      {error && (
        <p role="alert" className="role-feedback error">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="role-feedback success">
          {feedback}
        </p>
      )}
      <div className="role-permission-groups">
        {Array.from(grouped, ([group, items]) => (
          <section key={group}>
            <h3>
              {group}
              <span>{items.length}</span>
            </h3>
            {items.map((grant) => {
              const key = grant.permission.replace(/^Workforce\./, '');
              const [title, description] = labels[key] ?? [
                key.replaceAll('.', ' · '),
                'Access follows server-side restrictions.',
              ];
              const protectedGrant = role === 'Admin' && key === 'Accounts';
              const checked = changes[grant.permission] ?? grant.granted;
              return (
                <label
                  className={'role-permission-row ' + (protectedGrant ? 'protected' : '')}
                  key={grant.permission}
                >
                  <span>
                    <strong>
                      {title}
                      {protectedGrant && (
                        <span className="role-protected-badge">
                          <LockKeyhole size={12} />
                          Required
                        </span>
                      )}
                    </strong>
                    <small>{description}</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label={title}
                    checked={checked}
                    disabled={saving || protectedGrant}
                    onChange={(event) => {
                      const value = event.target.checked;
                      setChanges((current) => {
                        const next = { ...current };
                        if (value === grant.granted) delete next[grant.permission];
                        else next[grant.permission] = value;
                        return next;
                      });
                      setFeedback('');
                    }}
                  />
                </label>
              );
            })}
          </section>
        ))}
      </div>
      {!loading && grants.length > 0 && grouped.size === 0 && (
        <div className="role-no-results">
          <Search size={23} />
          <strong>No matching permissions</strong>
          <p>Try another search term.</p>
          <button onClick={() => setQuery('')}>Clear search</button>
        </div>
      )}
      <div className="role-editor-footer">
        <p>
          <ShieldCheck size={16} />
          Record visibility still follows ownership and team rules.
        </p>
        <div>
          <button
            className="secondary"
            disabled={!changed || saving}
            onClick={() => {
              setChanges({});
              setFeedback('');
              setError('');
            }}
          >
            <RotateCcw size={15} />
            Discard changes
          </button>
          <button className="primary" disabled={!changed || saving || loading} onClick={save}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </section>
  );
}
