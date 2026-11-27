import { Link2, MoreHorizontal } from 'lucide-react';

import type { UserManagementContext } from './useUserManagement';
export function AccountTable({
  context,
}: {
  context: Pick<
    UserManagementContext,
    | 'session'
    | 'selected'
    | 'open'
    | 'menuAccount'
    | 'setMenuAccount'
    | 'setMenuPosition'
    | 'menuTrigger'
    | 'links'
    | 'visible'
  >;
}) {
  const {
    session,
    selected,
    open,
    menuAccount,
    setMenuAccount,
    setMenuPosition,
    menuTrigger,
    links,
    visible,
  } = context;
  return (
    <>
      {' '}
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
                    <button
                      className="user-actions-trigger"
                      aria-label={'Actions for ' + account.email}
                      aria-haspopup="menu"
                      aria-expanded={menuAccount?.id === account.id}
                      onClick={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        menuTrigger.current = event.currentTarget;
                        setMenuPosition({
                          left: Math.max(12, Math.min(rect.right - 245, window.innerWidth - 257)),
                          top: Math.max(
                            12,
                            rect.bottom + 285 > window.innerHeight
                              ? rect.top - 280
                              : rect.bottom + 6,
                          ),
                        });
                        setMenuAccount(menuAccount?.id === account.id ? null : account);
                      }}
                    >
                      <MoreHorizontal size={20} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
