export type OrganisationPerson = {
  id: string;
  number: string;
  name: string;
  managerId: string | null;
  positionId: string | null;
  active: boolean;
  concurrencyStamp: string;
};
export type Structure = {
  branches: { id: string; name: string }[];
  departments: { id: string; branchId: string; name: string }[];
  positions: { id: string; departmentId: string; name: string }[];
  employees: OrganisationPerson[];
  layout: { employeeId: string; x: number; y: number; connector: string }[];
  company?: { x: number; y: number };
};
