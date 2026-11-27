export type Benefit = {
  id: string;
  employeeId: string;
  name: string;
  employer: number;
  employeeCost: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
};
export type Run = {
  id: string;
  period: string;
  status: string;
  hash: string;
  preparedBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  concurrencyStamp: string;
};
export type Payslip = {
  id: string;
  employeeId: string;
  runId: string;
  documentId: string;
  released: boolean;
};
export type Readiness = {
  period: string;
  ready: boolean;
  issues: string[];
  rows: {
    employeeId: string;
    number: string;
    basic: number;
    allowance: number;
    deduction: number;
    employerBenefits: number;
    employeeBenefits: number;
    approvedHours: number;
    overtimeHours: number;
    overtimePay: number;
    unpaidDays: number;
    pending: number;
  }[];
};
export type Salary = {
  employeeId: string;
  basic: number;
  allowance: number;
  deduction: number;
  hourlyRate: number;
  overtimeMultiplier: number;
  effectiveFrom: string;
};
