import { Session, Role } from '../../shared/api';

import { AdminDashboard } from './AdminDashboard';
import { HRDashboard } from './HRDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { EmployeeDashboard } from './EmployeeDashboard';

// Select the view from the active workspace role. Each dashboard loads the data it needs.
export function HomePage({ session, role }: { session: Session; role: Role }) {
  switch (role) {
    case 'Admin':
      return <AdminDashboard session={session} />;
    case 'HR':
      return <HRDashboard session={session} />;
    case 'Manager':
      return <ManagerDashboard session={session} />;
    case 'Employee':
      return <EmployeeDashboard session={session} />;
  }
}
