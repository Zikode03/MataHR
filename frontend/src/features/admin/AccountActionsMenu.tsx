import { Eye, ShieldCheck, UserCheck, UserRoundCog, UserX } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import type { UserManagementContext } from './useUserManagement';
export function AccountActionsMenu({
  context,
}: {
  context: Pick<
    UserManagementContext,
    'session' | 'menuAccount' | 'setMenuAccount' | 'menuPosition' | 'menuRef' | 'manage'
  >;
}) {
  const { session, menuAccount, setMenuAccount, menuPosition, menuRef, manage } = context;
  return (
    <>
      {' '}
      {menuAccount &&
        createPortal(
          <div
            className="user-actions-popover"
            role="menu"
            aria-label={'Actions for ' + menuAccount.email}
            ref={menuRef}
            style={menuPosition}
          >
            <div className="user-actions-caption">{menuAccount.email}</div>
            <button role="menuitem" onClick={() => manage(menuAccount, 'view')}>
              <Eye size={16} />
              View account
            </button>
            {menuAccount.id === session.id ? (
              <>
                <Link role="menuitem" to="/profile" onClick={() => setMenuAccount(null)}>
                  <UserRoundCog size={16} />
                  My profile
                </Link>
                <Link role="menuitem" to="/settings/security" onClick={() => setMenuAccount(null)}>
                  <ShieldCheck size={16} />
                  Password & authentication
                </Link>
                <p>Your own access is protected.</p>
              </>
            ) : (
              <>
                <button role="menuitem" onClick={() => manage(menuAccount, 'edit')}>
                  <UserRoundCog size={16} />
                  Edit roles & employee link
                </button>
                <button
                  role="menuitem"
                  className={menuAccount.active ? 'is-destructive' : ''}
                  onClick={() => manage(menuAccount, 'status')}
                >
                  {menuAccount.active ? <UserX size={16} /> : <UserCheck size={16} />}{' '}
                  {menuAccount.active ? 'Deactivate account' : 'Activate account'}
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
