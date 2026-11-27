import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { can, type Session } from '../../shared/api';

import { AdminOverview } from '../admin/AdminOverview';
import { DashboardHeader } from './shared';
export function AdminDashboard({ session }: { session: Session }) {
  return (
    <>
      <DashboardHeader
        title="System overview"
        description="Manage accounts, assign access and keep your organisation secure."
        actions={
          can(session, 'Accounts') ? (
            <Link className="primary" to="/administration/users#account-form">
              <Plus size={16} />
              Add user
            </Link>
          ) : undefined
        }
      />
      <AdminOverview session={session} />
    </>
  );
}
