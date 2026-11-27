import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError, message, type Role, type Session } from '../shared/api';

export function useSession() {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [tenant, setTenant] = useState(''),
    [mfa, setMfa] = useState(false),
    [busy, setBusy] = useState(false),
    [role, setRole] = useState<Role>('Employee');
  // The server is the authority for roles and permissions; never restore access from browser storage.
  const loadSession = useCallback(async () => {
    const account = await api<Session>('/auth/me');
    setSession(account);
    setRole(
      account.roles.includes('Admin')
        ? 'Admin'
        : account.roles.includes('HR')
          ? 'HR'
          : account.roles.includes('Manager')
            ? 'Manager'
            : 'Employee',
    );
  }, []);
  useEffect(() => {
    let active = true;
    Promise.allSettled([api<{ tenantId: string }>('/auth/config'), api<Session>('/auth/me')]).then(
      ([config, account]) => {
        if (!active) return;
        if (config.status === 'fulfilled') {
          setTenant(config.value.tenantId ?? '');
          if (!config.value.tenantId)
            setError('Organisation setup is missing on the server. Contact your administrator.');
        } else setError('Cannot connect to MataHR. Check that the backend is running, then retry.');
        if (account.status === 'fulfilled') {
          setSession(account.value);
          setRole(
            account.value.roles.includes('Admin')
              ? 'Admin'
              : account.value.roles.includes('HR')
                ? 'HR'
                : account.value.roles.includes('Manager')
                  ? 'Manager'
                  : 'Employee',
          );
        } else if (!(account.reason instanceof ApiError && account.reason.status === 401))
          setError('Cannot reach the MataHR API. Make sure the backend is running, then retry.');
        setLoading(false);
      },
    );
    const expired = () => {
      setSession(null);
      setError('Your session expired. Please sign in again.');
    };
    window.addEventListener('matahr:session-expired', expired);
    return () => {
      active = false;
      window.removeEventListener('matahr:session-expired', expired);
    };
  }, []);
  async function signIn(email: string, password: string) {
    if (!tenant) throw Error('Enter the organisation ID supplied by your administrator.');
    const result = await api<{ requiresTwoFactor: boolean }>('/auth/login', 'POST', {
      tenantId: tenant,
      email,
      password,
    });
    if (result.requiresTwoFactor) {
      setMfa(true);
      return;
    }
    await loadSession();
    navigate('/dashboard', { replace: true });
  }
  async function retryConnection() {
    setBusy(true);
    try {
      const config = await api<{ tenantId: string }>('/auth/config');
      if (!config.tenantId)
        throw Error('Organisation setup is missing on the server. Contact your administrator.');
      setTenant(config.tenantId);
      setError('');
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      await api('/auth/logout', 'POST');
      setSession(null);
      setMfa(false);
      navigate('/login', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSession(null);
        setMfa(false);
        navigate('/login', { replace: true });
      } else setError(message(error));
    } finally {
      setBusy(false);
    }
  }

  return {
    navigate,
    session,
    setSession,
    loading,
    error,
    setError,
    tenant,
    mfa,
    setMfa,
    busy,
    setBusy,
    role,
    setRole,
    loadSession,
    signIn,
    retryConnection,
    signOut,
  };
}
export type SessionController = ReturnType<typeof useSession>;
