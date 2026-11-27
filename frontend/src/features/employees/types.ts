export type Employee = {
  id: string;
  number: string;
  name: string;
  email: string;
  started: string;
  exited: string | null;
  contractType: string;
  managerId: string | null;
  positionId: string | null;
  concurrencyStamp: string;
};
