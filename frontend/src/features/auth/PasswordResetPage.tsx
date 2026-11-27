import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../shared/api';
import { ActionForm } from '../../shared/ui';

export function PasswordResetPage() {
  const { search } = useLocation();
  const navigate = useNavigate();
  const [link] = useState(() => {
    const params = new URLSearchParams(search);
    return {
      tenantId: params.get('tenantId'),
      email: params.get('email'),
      token: params.get('token'),
    };
  });
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    // Retain the one-time credential in memory and remove it from the address bar.
    if (search) void navigate('/reset-password', { replace: true });
  }, [search, navigate]);

  const { tenantId, email, token } = link;
  const valid =
    !!email &&
    !!token &&
    !!tenantId &&
    /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(tenantId);

  return (
    <main className="app-start">
      <section className="card">
        <h1>Reset your password</h1>
        {completed ? (
          <p role="status">Your password has been updated. Sign in with your new password.</p>
        ) : valid ? (
          <ActionForm
            submit="Update password"
            onSave={async (data) => {
              const newPassword = String(data.get('newPassword') ?? '');
              if (newPassword !== String(data.get('confirmation') ?? ''))
                throw new Error('The passwords do not match.');
              try {
                await api('/auth/password/reset', 'POST', { tenantId, email, token, newPassword });
              } catch (error) {
                if (error instanceof ApiError && error.status === 401)
                  throw new Error(
                    'This reset link is invalid or expired. Request another from sign-in.',
                  );
                throw error;
              }
              setCompleted(true);
            }}
          >
            <label>
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                name="confirmation"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </label>
            <p>Use at least 6 characters, including uppercase, lowercase, a number and a symbol.</p>
          </ActionForm>
        ) : (
          <p role="alert">This reset link is incomplete. Request a new link from sign-in.</p>
        )}
        <a href="/login">Back to sign in</a>
      </section>
    </main>
  );
}
