import { type Session } from '../shared/api';

import type { SessionController } from './useSession';
import { useWorkspaceShell } from './useWorkspaceShell';
import { WorkspaceHeader } from './WorkspaceHeader';
import { WorkspaceRoutes } from './WorkspaceRoutes';
import { WorkspaceSidebar } from './WorkspaceSidebar';
export function WorkspaceShell({
  controller,
}: {
  controller: SessionController & { session: Session };
}) {
  const context = useWorkspaceShell(controller);
  const { error, setError, collapsed, compact, menu, setMenu } = context;
  return (
    <div
      className={
        'shell app-shell ' +
        (collapsed ? 'app-shell-collapsed ' : '') +
        (compact ? 'app-compact' : '')
      }
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menu && (
        <button
          className="app-nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <WorkspaceSidebar context={context} />

      <div className="content" inert={menu || undefined}>
        <WorkspaceHeader context={context} />

        <main id="main-content">
          {error && (
            <p role="alert" className="notice app-error">
              {error}
              <button onClick={() => setError('')}>Dismiss</button>
            </p>
          )}
          <WorkspaceRoutes context={context} />
        </main>
      </div>
    </div>
  );
}
