export type Policy = {
  id: string;
  name: string;
  version: number;
  active: boolean;
  paid: boolean;
  limited: boolean;
  annualDays: number;
  monthlyAccrual: boolean;
  carryLimit: number;
  noticeDays: number;
  evidenceAfter: number;
  requiresHr: boolean;
};
export type Leave = {
  id: string;
  employeeId: string;
  policyId: string;
  start: string;
  end: string;
  days: number;
  status: string;
  stage: string;
  reason: string;
  concurrencyStamp: string;
};
