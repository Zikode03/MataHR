import { useApi, periodQuery, type Session } from '../../shared/api';

import { Loading } from '../../shared/ui';
import {
  DashboardHeader,
  WorkforceMetrics,
  EmployeeProfile,
  PersonalWorkspaceLinks,
  ReviewQueue,
  type DashboardSummary,
} from './shared';
export function ManagerDashboard({ session }: { session: Session }) {
  const summary = useApi<DashboardSummary>('/dashboard?' + periodQuery());
  return (
    <>
      <DashboardHeader
        title="My team"
        description="Keep your team�s working day moving."
        role="Manager"
      />
      <Loading loading={summary.loading} error={summary.error} />
      {summary.data && <WorkforceMetrics summary={summary.data} team />}
      <EmployeeProfile session={session} />
      <PersonalWorkspaceLinks />
      {summary.data && <ReviewQueue summary={summary.data} />}
    </>
  );
}
