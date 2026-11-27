import { ActionForm } from '../../shared/ui';
import type { UserManagementContext } from './useUserManagement';
export function AccountStatusConfirmation({
  context,
}: {
  context: Pick<UserManagementContext, 'selected' | 'changeStatus'>;
}) {
  const { selected, changeStatus } = context;
  if (!selected) return null;
  return (
    <ActionForm
      title={selected.active ? 'Deactivate account' : 'Activate account'}
      submit={selected.active ? 'Deactivate account' : 'Activate account'}
      onSave={changeStatus}
    >
      <div className="user-status-review">
        <strong>{selected.email}</strong>
        <p>
          {selected.active
            ? 'This user will no longer be able to sign in. Existing sessions will be revoked. Employee records and documents will be retained.'
            : 'This user will be able to sign in with their existing account and assigned roles.'}
        </p>
        <small>Existing roles: {selected.roles.join(', ')}</small>
      </div>
    </ActionForm>
  );
}
