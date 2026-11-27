import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { can, type Role } from '../shared/api';

import { AdminNotifications } from '../features/admin/AdminNotifications';

import type { WorkspaceShellContext } from './useWorkspaceShell';
export function WorkspaceHeader({
  context,
}: {
  context: Pick<
    WorkspaceShellContext,
    | 'navigate'
    | 'session'
    | 'role'
    | 'setRole'
    | 'location'
    | 'collapsed'
    | 'setCollapsed'
    | 'menu'
    | 'setMenu'
    | 'admin'
    | 'roleName'
  >;
}) {
  const {
    navigate,
    session,
    role,
    setRole,
    location,
    collapsed,
    setCollapsed,
    menu,
    setMenu,
    admin,
    roleName,
  } = context;
  return (
    <>
      {' '}
      <header className="app-header">
        <button
          className="menu-toggle"
          aria-label="Toggle navigation"
          aria-expanded={menu}
          aria-controls="workspace-navigation"
          onClick={() => setMenu(!menu)}
        >
          <Menu size={20} />
        </button>
        <button
          className="app-sidebar-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-controls="workspace-navigation"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
        <div className="app-header-actions">
          {admin && can(session, 'Accounts') && can(session, 'Audit') && (
            <AdminNotifications key={session.tenantId + session.id} session={session} />
          )}
          {session.roles.length > 1 && (
            <label className="app-role-switch">
              <span className="app-workspace-label">Workspace</span>
              <select
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as Role);
                  setMenu(false);
                  navigate('/dashboard');
                }}
              >
                {session.roles.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
          )}
          <details className="app-account-menu" key={location.pathname}>
            <summary aria-label="Account menu">
              <span className="app-account-avatar">{session.email.slice(0, 1).toUpperCase()}</span>
              <span className="app-account-identity">
                <strong>{roleName}</strong>
                <small>{session.email}</small>
              </span>
              <ChevronDown size={15} />
            </summary>
            <div className="app-account-popover">
              <strong>{session.email}</strong>
              <span>{roleName}</span>
              {admin && <Link to="/profile">My profile</Link>}
              <Link to="/settings/security">Account security</Link>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
