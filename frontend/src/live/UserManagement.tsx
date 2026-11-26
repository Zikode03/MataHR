import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Plus,
  X,
  UserRoundCog,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Link2,
  SlidersHorizontal,
} from 'lucide-react';
import { api, useApi, type Session, type Page, type Account, type Role } from './api';
import { ActionForm, field, optional, TextField, Loading } from './shared';
const roles: Role[] = ['Admin', 'HR', 'Manager', 'Employee'];
const descriptions: Record<Role, string> = {
  Admin: 'Users, permissions and system administration',
  HR: 'Employee records and HR operations',
  Manager: 'Team requests and approvals',
  Employee: 'Personal records and self-service',
};
export function UserManagement({ session }: { session: Session }) {
  const location = useLocation();
  const [offset, setOffset] = useState(0),
    [query, setQuery] = useState(''),
    [role, setRole] = useState('all'),
    [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Account | null>(null),
    [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const dialog = useRef<HTMLElement>(null);
  const accounts = useApi<Page<Account>>('/admin/accounts?maxResultCount=25&skipCount=' + offset);
  const links = useApi<{ id: string; number: string; name: string }[]>('/admin/employee-links');
  useEffect(() => {
    if (location.hash === '#account-form') {
      setSelected(null);
      setOpen(true);
    }
  }, [location.key, location.hash]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input,button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const fields = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.offsetParent !== null);
        const first = fields[0],
          last = fields[fields.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  const items = accounts.data?.items ?? [];
  const visible = items.filter((account) => {
    const person = links.data?.find((person) => person.id === account.employeeId);
    return (
      (!query ||
        [account.email, person?.name, person?.number].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        )) &&
      (role === 'all' || account.roles.includes(role as Role)) &&
      (status === 'all' || account.active === (status === 'active'))
    );
  });
  const filtered = !!query || role !== 'all' || status !== 'all';
  const total = accounts.data?.totalCount ?? 0;
  function create() {
    setSelected(null);
    setOpen(true);
  }
  return (
    <div className="user-management">
      <section className="user-directory">
        <div className="user-directory-head">
          <div>
            <h2>
              Assigned accounts <span>{accounts.data?.totalCount ?? '—'}</span>
            </h2>
            <p>Create accounts, assign roles and manage access.</p>
          </div>
          <button className="primary" onClick={create}>
            <Plus size={17} />
            Add user
          </button>
        </div>
        {notice && (
          <p role="status" className="user-save-feedback">
            {notice}
          </p>
        )}
        <div className="user-directory-tools">
          <label className="user-search">
            <Search size={18} />
            <input
              aria-label="Search accounts on this page"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
            />
          </label>
          <label className="user-select">
            <span className="sr-only">Filter by role</span>
            <select
              aria-label="Filter by role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="user-select">
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {filtered && (
            <button
              className="user-clear"
              onClick={() => {
                setQuery('');
                setRole('all');
                setStatus('all');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {total > 25 && (
          <p className="user-filter-scope">
            Search and filters apply to the accounts on this page.
          </p>
        )}
        <Loading loading={accounts.loading} error={accounts.error} />
        <div className="table-wrap">
          <table className="user-accounts-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Assigned roles</th>
                <th>Employee record</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((account) => {
                const person = links.data?.find((person) => person.id === account.employeeId);
                return (
                  <tr
                    key={account.id}
                    className={open && selected?.id === account.id ? 'is-selected' : ''}
                  >
                    <td>
                      <div className="user-identity">
                        <span>{(person?.name ?? account.email).slice(0, 1).toUpperCase()}</span>
                        <div>
                          <strong>{person?.name ?? account.email}</strong>
                          <small>
                            {person
                              ? account.email
                              : account.id === session.id
                                ? 'Your account'
                                : 'Workspace account'}
                          </small>
                        </div>
                        {account.id === session.id && <span className="user-you">You</span>}
                      </div>
                    </td>
                    <td>
                      <div className="user-role-tags">
                        {account.roles.map((role) => (
                          <span key={role}>{role}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {person ? (
                        <div className="user-employee-link">
                          <Link2 size={14} />
                          {person.number}
                        </div>
                      ) : (
                        <span className="user-unlinked">Not linked</span>
                      )}
                    </td>
                    <td>
                      <span className={'user-state ' + (account.active ? 'active' : 'inactive')}>
                        <i />
                        {account.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {account.id === session.id ? (
                        <span className="user-self-label">Current user</span>
                      ) : (
                        <button
                          className="user-edit"
                          onClick={() => {
                            setSelected(account);
                            setOpen(true);
                          }}
                          aria-label={'Edit access for ' + account.email}
                        >
                          <UserRoundCog size={16} />
                          Edit access
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!accounts.loading && !accounts.error && visible.length === 0 && (
          <div className="user-directory-empty">
            <Search size={25} />
            <h3>{filtered ? 'No matching accounts' : 'No accounts to display'}</h3>
            <p>
              {filtered
                ? 'Try a different search or clear your filters.'
                : 'Create an account to give someone access to this workspace.'}
            </p>
            {filtered && (
              <button
                className="secondary"
                onClick={() => {
                  setQuery('');
                  setRole('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        <div className="user-directory-footer">
          <span>
            {filtered
              ? visible.length + ' matching on this page'
              : total
                ? `${offset + 1}–${Math.min(offset + 25, total)} of ${total} accounts`
                : '0 accounts'}
          </span>
          <div>
            <button
              className="secondary"
              aria-label="Previous page"
              disabled={offset === 0 || accounts.loading}
              onClick={() => setOffset((n) => Math.max(0, n - 25))}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              className="secondary"
              aria-label="Next page"
              disabled={offset + 25 >= total || accounts.loading}
              onClick={() => setOffset((n) => n + 25)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <p className="user-access-note">
        <ShieldCheck size={17} />
        System access and confidential HR access are managed separately. Employee and Manager roles
        require a linked employee record.
      </p>
      {open && (
        <div className="user-editor-layer">
          <div className="user-editor-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside
            className="user-editor"
            role="dialog"
            aria-modal="true"
            aria-label={selected ? 'Edit user access' : 'Add user'}
            ref={dialog}
          >
            <div className="user-editor-top">
              <span>
                <SlidersHorizontal size={18} />
                Account details
              </span>
              <button
                type="button"
                aria-label="Close account editor"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="user-editor-body">
              <p className="user-editor-intro">
                {selected
                  ? 'Update this user’s roles, employee link and sign-in access.'
                  : 'Give someone secure access to the right workspace.'}
              </p>
              <ActionForm
                key={selected?.id ?? 'new'}
                title={selected ? 'Edit ' + selected.email : 'Create account'}
                submit={selected ? 'Save changes' : 'Create user'}
                onSave={async (data) => {
                  const assigned = data.getAll('roles');
                  if (assigned.length === 0) throw Error('Assign at least one role.');
                  const employeeId = optional(data, 'employeeId');
                  if (
                    assigned.some((role) => role === 'Manager' || role === 'Employee') &&
                    !employeeId
                  )
                    throw Error('Select an employee record for Employee or Manager access.');
                  await api(
                    selected ? '/admin/accounts/' + selected.id : '/admin/accounts',
                    selected ? 'PUT' : 'POST',
                    {
                      roles: assigned,
                      employeeId,
                      ...(selected
                        ? {
                            active: data.has('active'),
                            concurrencyStamp: selected.concurrencyStamp,
                          }
                        : {
                            email: field(data, 'email'),
                            password: String(data.get('password') ?? ''),
                          }),
                    },
                  );
                  accounts.reload();
                  setNotice(
                    selected
                      ? 'User access updated successfully.'
                      : 'User account created successfully.',
                  );
                  setSelected(null);
                  setOpen(false);
                }}
              >
                {selected ? (
                  <div className="user-editing-account">
                    <strong>{selected.email}</strong>
                    <small>Account email cannot be changed here.</small>
                  </div>
                ) : (
                  <>
                    <TextField name="email" label="Work email" type="email" />
                    <label>
                      Initial password
                      <input
                        name="password"
                        type="password"
                        minLength={14}
                        autoComplete="new-password"
                        required
                      />
                      <small>
                        14+ characters, including uppercase, lowercase, a number and a symbol.
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
                  <small>Required for Employee and Manager roles.</small>
                </label>
                <Loading loading={links.loading} error={links.error} />
                <fieldset className="user-role-picker">
                  <legend>Assigned roles</legend>
                  {roles.map((role) => (
                    <label key={role}>
                      <input
                        type="checkbox"
                        name="roles"
                        value={role}
                        aria-label={role}
                        defaultChecked={
                          selected?.roles.includes(role) ??
                          role ===
                            (new URLSearchParams(location.search).get('createRole') === 'HR'
                              ? 'HR'
                              : 'Employee')
                        }
                      />
                      <span>
                        <strong>
                          {role === 'Admin'
                            ? 'System administrator'
                            : role === 'HR'
                              ? 'Human resources'
                              : role}
                        </strong>
                        <small>{descriptions[role]}</small>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {selected && (
                  <label className="user-access-toggle">
                    <input type="checkbox" name="active" defaultChecked={selected.active} />
                    <span>
                      <strong>Account active</strong>
                      <small>
                        Allow this user to sign in. Disabling access revokes existing sessions.
                      </small>
                    </span>
                  </label>
                )}
              </ActionForm>
              <button className="user-editor-cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
