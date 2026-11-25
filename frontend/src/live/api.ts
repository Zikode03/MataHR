import { useCallback, useEffect, useState } from 'react';

export type Role = 'Admin' | 'HR' | 'Manager' | 'Employee';
export type Session = {
  id: string;
  tenantId: string;
  email: string;
  employeeId: string | null;
  roles: Role[];
  permissions: string[];
  privacyVersion: string;
  privacyAcknowledged: boolean;
  requiresPasswordChange?: boolean;
};
export type Page<T> = { totalCount: number; items: T[] };
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
export type Account = {
  id: string;
  email: string;
  roles: Role[];
  employeeId: string | null;
  active: boolean;
  concurrencyStamp: string;
};
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
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'include',
    signal,
    headers: {
      'X-MataHR-Request': '1',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiError(
      response.status,
      'The API returned an unexpected response. Check the backend connection.',
    );
  }
  if (!response.ok) {
    const error = data as
      | {
          error?: { message?: string } | string;
          detail?: string;
          title?: string;
          errors?: Record<string, string[]>;
        }
      | undefined;
    const message =
      typeof error?.error === 'string'
        ? error.error
        : (error?.error?.message ??
          error?.detail ??
          (error?.errors ? Object.values(error.errors).flat().join(' ') : undefined) ??
          (response.status === 401
            ? path === '/auth/login'
              ? 'Check your work email, password and organisation, then try again.'
              : path === '/auth/mfa/login'
                ? 'The verification code is invalid or the sign-in challenge expired.'
                : 'Your session has expired. Sign in again.'
            : response.status === 429
              ? 'Too many attempts. Wait a minute and try again.'
              : response.status === 403
                ? 'You do not have permission for this action.'
                : (error?.title ?? 'The request could not be completed.')));
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('matahr:session-expired'));
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<{
    path: string | null;
    data: T | null;
    loading: boolean;
    error: string;
  }>({ path, data: null, loading: !!path, error: '' });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!path) {
      setState({ path, data: null, loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    setState((previous) => ({
      path,
      data: previous.path === path ? previous.data : null,
      loading: true,
      error: '',
    }));
    api<T>(path, 'GET', undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ path, data, loading: false, error: '' });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ path, data: null, loading: false, error: message(error) });
      });
    return () => controller.abort();
  }, [path, revision]);
  return {
    ...state,
    data: state.path === path ? state.data : null,
    loading: state.path !== path ? !!path : state.loading,
    reload,
  };
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : 'Unable to complete this action. Try again.';
}
export function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function month() {
  return today().slice(0, 7);
}
export function periodQuery() {
  return 'from=' + month() + '-01&to=' + today();
}
export const can = (session: Session, permission: string) =>
  session.permissions.includes('Workforce.' + permission);
export function download(content: { name: string; contentType: string; contentBase64: string }) {
  const bytes = Uint8Array.from(atob(content.contentBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: content.contentType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = content.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
