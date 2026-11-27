import { Role } from '../../shared/api';

export type Account = {
  id: string;
  email: string;
  roles: Role[];
  employeeId: string | null;
  active: boolean;
  concurrencyStamp: string;
};
