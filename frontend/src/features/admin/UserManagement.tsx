import { ChevronLeft, ChevronRight, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { type Session } from '../../shared/api';

import { Loading } from '../../shared/ui';

import { AccountActionsMenu } from './AccountActionsMenu';
import { AccountEditor } from './AccountEditor';
import { AccountTable } from './AccountTable';
import { useUserManagement } from './useUserManagement';
export function UserManagement({ session }: { session: Session }) {
  const context = useUserManagement({ session });
  const {
    offset,
    setOffset,
    query,
    setQuery,
    role,
    setRole,
    status,
    setStatus,
    notice,
    accounts,
    visible,
    filtered,
    total,
    create,
    roles,
  } = context;
  return (
    <div className="user-management">
      <section className="user-directory">
        <div className="user-directory-head">
          <div>
            <h2>
              Assigned accounts <span>{accounts.data?.totalCount ?? '—'}</span>
            </h2>
            <p>Create accounts, assign roles and manage access.</p>
          </div>
          <button className="primary" onClick={create}>
            <Plus size={17} />
            Add user
          </button>
        </div>
        {notice && (
          <p role="status" className="user-save-feedback">
            {notice}
          </p>
        )}
        <div className="user-directory-tools">
          <label className="user-search">
            <Search size={18} />
            <input
              aria-label="Search accounts on this page"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
            />
          </label>
          <label className="user-select">
            <span className="sr-only">Filter by role</span>
            <select
              aria-label="Filter by role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="all">All roles</option>
              {roles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          <label className="user-select">
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          {filtered && (
            <button
              className="user-clear"
              onClick={() => {
                setQuery('');
                setRole('all');
                setStatus('all');
              }}
            >
              Clear filters
            </button>
          )}
          <button
            className="user-refresh"
            type="button"
            aria-label="Refresh accounts"
            title="Refresh accounts"
            disabled={accounts.loading}
            onClick={accounts.reload}
          >
            <RefreshCw size={17} />
          </button>
        </div>
        {total > 25 && (
          <p className="user-filter-scope">
            Search and filters apply to the accounts on this page.
          </p>
        )}
        <Loading loading={accounts.loading} error={accounts.error} />
        <AccountTable context={context} />
        {!accounts.loading && !accounts.error && visible.length === 0 && (
          <div className="user-directory-empty">
            <Search size={25} />
            <h3>{filtered ? 'No matching accounts' : 'No accounts to display'}</h3>
            <p>
              {filtered
                ? 'Try a different search or clear your filters.'
                : 'Create an account to give someone access to this workspace.'}
            </p>
            {filtered && (
              <button
                className="secondary"
                onClick={() => {
                  setQuery('');
                  setRole('all');
                  setStatus('all');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
        <div className="user-directory-footer">
          <span>
            {filtered
              ? visible.length + ' matching on this page'
              : total
                ? `${offset + 1}–${Math.min(offset + 25, total)} of ${total} accounts`
                : '0 accounts'}
          </span>
          <div>
            <button
              className="secondary"
              aria-label="Previous page"
              disabled={offset === 0 || accounts.loading}
              onClick={() => setOffset((n) => Math.max(0, n - 25))}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            <button
              className="secondary"
              aria-label="Next page"
              disabled={offset + 25 >= total || accounts.loading}
              onClick={() => setOffset((n) => n + 25)}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
      <p className="user-access-note">
        <ShieldCheck size={17} />
        System access and confidential HR access are managed separately. Employee and Manager roles
        require a linked employee record.
      </p>
      <AccountEditor context={context} />
      <AccountActionsMenu context={context} />
    </div>
  );
}
