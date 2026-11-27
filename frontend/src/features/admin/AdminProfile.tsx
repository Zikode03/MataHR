import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  KeyRound,
  Mail,
  Monitor,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { can, useApi, type Session } from '../../shared/api';
import type { Employee } from '../employees/types';

import { Loading } from '../../shared/ui';
const roleNames: Record<string, string> = {
  Admin: 'System administrator',
  HR: 'Human resources',
  Manager: 'Manager',
  Employee: 'Employee',
};
export function AdminProfile({ session }: { session: Session }) {
  const employee = useApi<Employee>(
    session.employeeId && can(session, 'People.Read') ? '/employees/' + session.employeeId : null,
  );
  const name = employee.data?.name;
  const initials = name
    ? name
        .split(' ')
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
    : session.email.slice(0, 1).toUpperCase();
  return (
    <div className="admin-profile-page">
      <div className="page-head">
        <div>
          <h1>My profile</h1>
          <p>Your account details, assigned access and security preferences.</p>
        </div>
      </div>
      <section className="profile-identity-card">
        <div className="profile-avatar">{initials}</div>
        <div>
          <h2>{name ?? 'System administrator'}</h2>
          <p>
            <Mail size={15} />
            {session.email}
          </p>
        </div>
        <span className="profile-own-badge">
          <BadgeCheck size={15} />
          Your account
        </span>
      </section>
      <div className="profile-page-grid">
        <div className="profile-main-column">
          <section className="profile-detail-card">
            <div className="profile-section-heading">
              <UserRound size={19} />
              <h2>Account details</h2>
            </div>
            <Loading loading={employee.loading} error={employee.error} />
            <dl>
              <div>
                <dt>Full name</dt>
                <dd>{name ?? 'No employee name linked'}</dd>
              </div>
              <div>
                <dt>Work email</dt>
                <dd>{session.email}</dd>
              </div>
              <div>
                <dt>Organisation</dt>
                <dd>Matateni Technologies</dd>
              </div>
              <div>
                <dt>Assigned roles</dt>
                <dd>
                  <span className="profile-role-list">
                    {session.roles.map((role) => (
                      <span key={role}>{roleNames[role] ?? role}</span>
                    ))}
                  </span>
                </dd>
              </div>
            </dl>
            <p className="profile-detail-caption">
              Role and account assignments are managed by an authorised administrator. You can
              manage your own password and authenticator in Security settings.
            </p>
          </section>
          <section className="profile-detail-card">
            <div className="profile-section-heading">
              <Building2 size={19} />
              <h2>Employee record</h2>
            </div>
            {employee.data ? (
              <>
                <dl>
                  <div>
                    <dt>Employee number</dt>
                    <dd>{employee.data.number}</dd>
                  </div>
                  <div>
                    <dt>Employment started</dt>
                    <dd>
                      {new Intl.DateTimeFormat('en-ZA', { dateStyle: 'long' }).format(
                        new Date(employee.data.started + 'T12:00:00'),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Contract type</dt>
                    <dd>{employee.data.contractType}</dd>
                  </div>
                </dl>
                <Link className="profile-card-link" to="/employees">
                  View my employee record <ArrowUpRight size={15} />
                </Link>
              </>
            ) : (
              <div className="profile-unlinked">
                <UserRound size={24} />
                <div>
                  <strong>
                    {employee.loading
                      ? 'Loading your record…'
                      : session.employeeId
                        ? 'Employee details unavailable'
                        : 'No employee record linked'}
                  </strong>
                  <p>
                    {session.employeeId
                      ? 'Your account link remains unchanged.'
                      : 'Your administrator account works independently of an employee record. Ask another administrator to link your account if you also need employee self-service.'}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
        <aside className="profile-side-column">
          <section className="profile-detail-card">
            <div className="profile-section-heading">
              <ShieldCheck size={19} />
              <h2>Security & preferences</h2>
            </div>
            <div className="profile-settings-links">
              <Link to="/settings/security">
                <KeyRound size={18} />
                <span>
                  <strong>Password & authentication</strong>
                  <small>Update your password or manage two-factor authentication.</small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
              <Link to="/settings/appearance">
                <Monitor size={18} />
                <span>
                  <strong>Display preferences</strong>
                  <small>Choose the workspace density for this browser.</small>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>
          <section className="profile-detail-card">
            <div className="profile-section-heading">
              <FileCheck2 size={19} />
              <h2>Privacy acknowledgement</h2>
            </div>
            <div className="profile-privacy-state">
              <span className={session.privacyAcknowledged ? 'acknowledged' : ''}>
                <ShieldCheck size={16} />
                {session.privacyAcknowledged ? 'Acknowledged' : 'Acknowledgement required'}
              </span>
              <p>
                Your account’s acknowledgement of the current POPIA privacy notice is recorded by
                MataHR.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
