import '../styles/application.css';
import { useLocation } from 'react-router-dom';
import { PasswordResetPage } from '../features/auth/PasswordResetPage';
import { AuthenticationGate } from './AuthenticationGate';
import { useSession } from './useSession';
import { WorkspaceShell } from './WorkspaceShell';
export function App() {
  const location = useLocation();
  if (location.pathname === '/reset-password') return <PasswordResetPage />;
  return <SessionWorkspace />;
}

function SessionWorkspace() {
  const controller = useSession();
  return (
    <AuthenticationGate controller={controller}>
      {controller.session && (
        <WorkspaceShell controller={{ ...controller, session: controller.session }} />
      )}
    </AuthenticationGate>
  );
}
