import { ShieldCheck } from 'lucide-react';
import { LoginPage } from '../features/auth/LoginPage';
import { api, message } from '../shared/api';

import { ActionForm, field, TextField } from '../shared/ui';

import type { ReactNode } from 'react';
import type { SessionController } from './useSession';
export function AuthenticationGate({
  controller,
  children,
}: {
  controller: SessionController;
  children: ReactNode;
}) {
  const {
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
    loadSession,
    signIn,
    retryConnection,
    signOut,
  } = controller;
  // Wait for session recovery before showing sign-in or mounting the workspace.
  if (loading)
    return (
      <main className="app-start" role="status">
        Connecting to MataHR…
      </main>
    );
  if (!session) {
    if (mfa)
      return (
        <main className="app-start">
          <section className="card">
            <ActionForm
              title="Verify your sign-in"
              submit="Verify"
              onSave={async (data) => {
                await api('/auth/mfa/login', 'POST', {
                  code: field(data, 'code'),
                  recoveryCode: data.has('recoveryCode'),
                });
                await loadSession();
                setMfa(false);
                navigate('/dashboard', { replace: true });
              }}
            >
              <TextField label="Authenticator or recovery code" name="code" />
              <label className="app-check">
                <input type="checkbox" name="recoveryCode" />
                Use a recovery code
              </label>
            </ActionForm>
            <button className="secondary" onClick={() => setMfa(false)}>
              Back to sign in
            </button>
          </section>
        </main>
      );
    return (
      <>
        <LoginPage
          onAuthenticate={signIn}
          signInDisabled={!tenant || busy}
          connectionNotice={
            !tenant || error ? (
              <div className="login-connection-notice" role="status">
                <p>{error || 'Connecting to your organisation…'}</p>
                {!tenant && (
                  <button type="button" onClick={retryConnection} disabled={busy}>
                    {busy ? 'Connecting…' : 'Retry connection'}
                  </button>
                )}
              </div>
            ) : undefined
          }
          onRequestReset={async (email) => {
            await api('/auth/password/request-reset', 'POST', { tenantId: tenant, email });
          }}
        />
      </>
    );
  }
  if (session.requiresPasswordChange)
    return (
      <main className="app-start">
        <section className="card">
          <ActionForm
            title="Choose your own password"
            submit="Change password"
            onSave={async (data) => {
              await api('/auth/password', 'POST', {
                currentPassword: field(data, 'currentPassword'),
                newPassword: field(data, 'newPassword'),
              });
              setSession(null);
              setError('Your password was changed. Sign in with your new password.');
              navigate('/login');
            }}
          >
            <TextField type="password" name="currentPassword" label="Temporary password" />
            <label>
              New password
              <input
                type="password"
                name="newPassword"
                autoComplete="new-password"
                minLength={6}
                required
              />
              <small>
                Use at least 6 characters including uppercase, lowercase, a number and a symbol.
              </small>
            </label>
          </ActionForm>
        </section>
      </main>
    );
  if (!session.privacyAcknowledged)
    return (
      <main className="app-start">
        <section className="card app-privacy">
          <ShieldCheck size={30} />
          <h1>Your information at work</h1>
          <p>
            MataHR processes your employee record, employment documents, attendance, leave and
            payroll inputs for workforce administration. Access is limited by your assigned role.
          </p>
          <p>
            If you request on-site clock-in verification, your browser location is checked against
            the configured workplace boundary. The attendance record keeps the measured distance,
            accuracy and verification result, rather than your precise coordinates. A short-lived
            on-site code is also required. Remote work and exceptions are reviewed separately.
          </p>
          <p>
            You may ask HR for access to or correction of your information, the employer’s
            Information Officer details, and its retention and privacy policies. Acknowledging this
            notice records that you have read it; it is not blanket consent or a waiver of your
            POPIA rights.
          </p>
          <p>
            Notice version: {session.privacyVersion}.{' '}
            <a href="https://inforegulator.org.za/" target="_blank" rel="noreferrer">
              Information Regulator
            </a>
          </p>
          {error && (
            <p role="alert" className="app-error">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/auth/privacy', 'POST');
                  await loadSession();
                  setError('');
                } catch (error) {
                  setError(message(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              I acknowledge · open workspace
            </button>
            <button className="secondary" disabled={busy} onClick={signOut}>
              Sign out
            </button>
          </div>
        </section>
      </main>
    );

  return <>{children}</>;
}
