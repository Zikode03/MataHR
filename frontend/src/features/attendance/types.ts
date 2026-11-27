export type Location = {
  id: string;
  name: string;
  kind: string;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
};
export type WorkSession = {
  id: string;
  employeeId: string;
  locationId: string;
  date: string;
  start: string;
  end: string | null;
  status: string;
  evidence: string;
  exceptionReason: string;
  distanceMeters: number | null;
  accuracyMeters: number | null;
  concurrencyStamp: string;
};
