import { SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../shared/api';
import { AccountStatusConfirmation } from './AccountStatusConfirmation';

import { ActionForm, field, Loading, optional, TextField } from '../../shared/ui';

import type { UserManagementContext } from './useUserManagement';
export function AccountEditor({
  context,
}: {
  context: Pick<
    UserManagementContext,
    | 'session'
    | 'location'
    | 'selected'
    | 'setSelected'
    | 'open'
    | 'setOpen'
    | 'setNotice'
    | 'editorMode'
    | 'setEditorMode'
    | 'dialog'
    | 'accounts'
    | 'links'
    | 'roles'
    | 'descriptions'
    | 'changeStatus'
  >;
}) {
  const {
    session,
    location,
    selected,
    setSelected,
    open,
    setOpen,
    setNotice,
    editorMode,
    setEditorMode,
    dialog,
    accounts,
    links,
    roles,
    descriptions,
  } = context;
  return (
    <>
      {' '}
      {open && (
        <div className="user-editor-layer">
          <div className="user-editor-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside
            className="user-editor"
            role="dialog"
            aria-modal="true"
            aria-label={
              editorMode === 'view'
                ? 'Account details'
                : editorMode === 'status'
                  ? selected?.active
                    ? 'Deactivate account'
                    : 'Activate account'
                  : selected
                    ? 'Edit user access'
                    : 'Add user'
            }
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
                {editorMode === 'view'
                  ? 'Review this account’s roles, employee link and sign-in status.'
                  : editorMode === 'status'
                    ? 'Review the account and effect before changing sign-in access.'
                    : selected
                      ? 'Update this user’s roles, employee link and sign-in access.'
                      : 'Give someone secure access to the right workspace.'}
              </p>
              {editorMode === 'edit' ? (
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
                              email: field(data, 'email'),
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
                    <label>
                      Work email
                      <input
                        name="email"
                        aria-label="Work email"
                        type="email"
                        required
                        maxLength={254}
                        defaultValue={selected.email}
                        autoComplete="off"
                      />
                      <small>
                        Changing this address changes the user's sign-in email and revokes their
                        existing sessions.
                      </small>
                    </label>
                  ) : (
                    <>
                      <TextField name="email" label="Work email" type="email" />
                      <label>
                        Initial password
                        <input
                          name="password"
                          type="password"
                          minLength={6}
                          autoComplete="new-password"
                          required
                        />
                        <small>
                          6+ characters, including uppercase, lowercase, a number and a symbol.
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
              ) : editorMode === 'view' && selected ? (
                <div className="user-account-details">
                  <h2>Account details</h2>
                  <dl>
                    <div>
                      <dt>Work email</dt>
                      <dd>{selected.email}</dd>
                    </div>
                    <div>
                      <dt>Assigned roles</dt>
                      <dd>{selected.roles.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{selected.active ? 'Active' : 'Inactive'}</dd>
                    </div>
                    <div>
                      <dt>Employee link</dt>
                      <dd>
                        {links.data?.find((person) => person.id === selected.employeeId)?.name ??
                          (selected.employeeId ? 'Linked employee' : 'Not linked')}
                      </dd>
                    </div>
                  </dl>
                  {selected.id === session.id ? (
                    <div className="user-self-actions">
                      <p>
                        Another administrator must change your roles, employee link or account
                        status.
                      </p>
                      <Link to="/profile">Open my profile</Link>
                      <Link to="/settings/security">Manage my password & authentication</Link>
                    </div>
                  ) : (
                    <button className="primary" onClick={() => setEditorMode('edit')}>
                      Edit roles & access
                    </button>
                  )}
                </div>
              ) : selected ? (
                <AccountStatusConfirmation context={context} />
              ) : null}
              <button className="user-editor-cancel" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
