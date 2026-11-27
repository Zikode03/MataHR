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
export function HRDashboard({ session }: { session: Session }) {
  const summary = useApi<DashboardSummary>('/dashboard?' + periodQuery());
  return (
    <>
      <DashboardHeader
        title="HR dashboard"
        description="Your workforce and the decisions that need attention."
        role="HR"
      />
      <Loading loading={summary.loading} error={summary.error} />
      {summary.data && <WorkforceMetrics summary={summary.data} />}
      <EmployeeProfile session={session} />
      <PersonalWorkspaceLinks />
      {summary.data && <ReviewQueue summary={summary.data} />}
    </>
  );
}
