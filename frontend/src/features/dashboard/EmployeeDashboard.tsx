import { Session } from '../../shared/api';

import { DashboardHeader, EmployeeProfile, PersonalWorkspaceLinks } from './shared';
import { EmployeeSummary } from './EmployeeSummary';
export function EmployeeDashboard({ session }: { session: Session }) {
  return (
    <>
      <DashboardHeader
        title="My workspace"
        description="Your working day, requests and employment information."
        role="Employee"
      />
      <EmployeeProfile session={session} hero />
      {session.employeeId && <EmployeeSummary session={session} />}
      <PersonalWorkspaceLinks />
    </>
  );
}
