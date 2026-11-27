import { LogOut, X } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import type { WorkspaceShellContext } from './useWorkspaceShell';
export function WorkspaceSidebar({
  context,
}: {
  context: Pick<
    WorkspaceShellContext,
    'busy' | 'signOut' | 'collapsed' | 'menu' | 'setMenu' | 'admin' | 'nav'
  >;
}) {
  const { busy, signOut, collapsed, menu, setMenu, admin, nav } = context;
  return (
    <>
      {' '}
      <aside id="workspace-navigation" className={'sidebar app-sidebar ' + (menu ? 'open' : '')}>
        <Link to="/dashboard" className="app-logo" aria-label="MataHR home">
          <img src="/brand/matateni-emblem.png" alt="" />
          <div className="app-wordmark">
            <strong>
              Mata<span>HR</span>
            </strong>
            <small>BY MATATENI</small>
          </div>
        </Link>
        <button className="app-mobile-close" aria-label="Close menu" onClick={() => setMenu(false)}>
          <X size={19} />
        </button>
        <nav aria-label="Main navigation">
          {['Workspace', 'Administration'].map((group) => {
            const items = nav.filter(
              (item) =>
                (item.to.startsWith('/administration') ||
                  item.to === '/imports' ||
                  (admin && item.to.startsWith('/settings'))) ===
                (group === 'Administration'),
            );
            return (
              items.length > 0 && (
                <div className="app-nav-section" key={group}>
                  <p>{group}</p>
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-label={item.label}
                      title={collapsed ? item.label : undefined}
                      onClick={() => setMenu(false)}
                    >
                      <item.icon size={19} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )
            );
          })}
        </nav>
        <div className="app-sidebar-logout">
          <button
            type="button"
            disabled={busy}
            aria-label="Log out"
            title="Log out"
            onClick={() => {
              setMenu(false);
              void signOut();
            }}
          >
            <LogOut size={18} aria-hidden="true" />
            <span>{busy ? 'Logging out…' : 'Log out'}</span>
          </button>
        </div>
      </aside>
    </>
  );
}
