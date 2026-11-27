import { useParams } from 'react-router-dom';
import type { Session } from '../../shared/api';

import { RolePermissions } from './RolePermissions';
import { UserManagement } from './UserManagement';
export function AdminPage({ session }: { session: Session }) {
  const { section } = useParams();
  const tab = section === 'permissions' ? 'permissions' : 'users';
  return (
    <div className={'admin-settings-page admin-settings-' + tab}>
      <div className="page-head">
        <div>
          <h1>{tab === 'users' ? 'User management' : 'Roles & permissions'}</h1>
          <p>
            {tab === 'users'
              ? 'Create accounts and manage access to your organisation.'
              : 'Define what each role can access and manage.'}
          </p>
        </div>
      </div>
      {tab === 'users' && <UserManagement session={session} />}
      {tab === 'permissions' && <RolePermissions />}
    </div>
  );
}
