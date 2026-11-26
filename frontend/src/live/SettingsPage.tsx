import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { Building2, ShieldCheck, Monitor, Plug, ArrowUpRight, KeyRound } from 'lucide-react';
import { api, can, type Session } from './api';
import { ActionForm, TextField } from './shared';

type Props = { session: Session; onPasswordChanged: () => void };
export function SettingsPage({ session, onPasswordChanged }: Props) {
  const { section = 'general' } = useParams();
  const [setup, setSetup] = useState<{ sharedKey: string; accountName: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('matahr:density:' + session.tenantId + ':' + session.id) ===
        'compact'
        ? 'compact'
        : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  const current = ['general', 'security', 'appearance', 'connections'].includes(section)
    ? section
    : 'general';
  return (
    <div className="workspace-settings">
      <div className="page-head">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Settings</h1>
          <p>Manage your account, security and workspace preferences.</p>
        </div>
      </div>
      <div className="workspace-settings-layout">
        <nav aria-label="Settings sections">
          {[
            {
              key: 'general',
              label: 'General',
              description: 'Organisation and account',
              icon: Building2,
            },
            {
              key: 'security',
              label: 'Security',
              description: 'Password and authentication',
              icon: ShieldCheck,
            },
            {
              key: 'appearance',
              label: 'Appearance',
              description: 'Your display preferences',
              icon: Monitor,
            },
            {
              key: 'connections',
              label: 'Connections',
              description: 'Services and integrations',
              icon: Plug,
            },
          ].map((item) => (
            <NavLink key={item.key} to={'/settings/' + item.key} aria-label={item.label}>
              <item.icon size={19} />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </NavLink>
          ))}
        </nav>
        <div className="workspace-settings-content">
          {current === 'general' && (
            <>
              <section className="settings-v2-panel">
                <div className="settings-v2-heading">
                  <h2>Organisation</h2>
                  <p>The workspace your account belongs to.</p>
                </div>
                <dl className="settings-v2-details">
                  <div>
                    <dt>Organisation</dt>
                    <dd>Matateni Technologies</dd>
                  </div>
                  <div>
                    <dt>Reporting timezone</dt>
                    <dd>Africa/Johannesburg</dd>
                  </div>
                  <div>
                    <dt>Payroll currency</dt>
                    <dd>ZAR · South African rand</dd>
                  </div>
                  <div>
                    <dt>Organisation ID</dt>
                    <dd>
                      <code>{session.tenantId}</code>
                    </dd>
                  </div>
                </dl>
              </section>
              <section className="settings-v2-panel">
                <div className="settings-v2-heading">
                  <h2>Your account</h2>
                  <p>Your current sign-in identity and assigned access.</p>
                </div>
                <dl className="settings-v2-details">
                  <div>
                    <dt>Work email</dt>
                    <dd>{session.email}</dd>
                  </div>
                  <div>
                    <dt>Assigned roles</dt>
                    <dd>{session.roles.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>Privacy notice</dt>
                    <dd>
                      {session.privacyAcknowledged ? 'Acknowledged' : 'Acknowledgement required'} ·{' '}
                      {session.privacyVersion}
                    </dd>
                  </div>
                </dl>
                {can(session, 'Accounts') && (
                  <Link className="settings-v2-footer" to="/administration/users">
                    Manage user access <ArrowUpRight size={15} />
                  </Link>
                )}
              </section>
            </>
          )}
          {current === 'security' && (
            <>
              <section className="settings-v2-panel">
                <div className="settings-v2-heading">
                  <h2>Change password</h2>
                  <p>
                    Changing your password signs out existing sessions. Use at least 14 characters,
                    including uppercase, lowercase, a number and a symbol.
                  </p>
                </div>
                <ActionForm
                  submit="Update password"
                  onSave={async (data) => {
                    const password = String(data.get('newPassword') ?? '');
                    if (password !== String(data.get('confirmPassword') ?? ''))
                      throw Error('The new passwords do not match.');
                    await api('/auth/password', 'POST', {
                      currentPassword: String(data.get('currentPassword') ?? ''),
                      newPassword: password,
                    });
                    onPasswordChanged();
                  }}
                >
                  <TextField name="currentPassword" type="password" label="Current password" />
                  <label>
                    New password
                    <input
                      name="newPassword"
                      type="password"
                      minLength={14}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                  <label>
                    Confirm new password
                    <input
                      name="confirmPassword"
                      type="password"
                      minLength={14}
                      autoComplete="new-password"
                      required
                    />
                  </label>
                </ActionForm>
              </section>
              <section className="settings-v2-panel">
                <div className="settings-v2-heading">
                  <h2>Two-factor authentication</h2>
                  <p>
                    Add verification from an authenticator app to your sign-in. Start setup with
                    your current password.
                  </p>
                </div>
                {!setup && codes.length === 0 && (
                  <ActionForm
                    submit="Start authenticator setup"
                    onSave={async (data) => {
                      setSetup(
                        await api('/auth/mfa/setup', 'POST', {
                          password: String(data.get('password') ?? ''),
                        }),
                      );
                    }}
                  >
                    <TextField name="password" type="password" label="Current password" />
                  </ActionForm>
                )}
                {setup && (
                  <>
                    <div className="settings-v2-secret">
                      <KeyRound size={18} />
                      <div>
                        <strong>Add this key to your authenticator app</strong>
                        <code>{setup.sharedKey}</code>
                        <small>Account: {setup.accountName}</small>
                      </div>
                    </div>
                    <ActionForm
                      submit="Enable two-factor authentication"
                      onSave={async (data) => {
                        const response = await api<{ codes: string[] }>(
                          '/auth/mfa/enable',
                          'POST',
                          { code: String(data.get('code') ?? '') },
                        );
                        setCodes(response.codes);
                        setSetup(null);
                      }}
                    >
                      <label>
                        Six-digit authenticator code
                        <input
                          name="code"
                          inputMode="numeric"
                          pattern="[0-9]{6}"
                          autoComplete="one-time-code"
                          required
                        />
                      </label>
                    </ActionForm>
                    <button className="secondary" onClick={() => setSetup(null)}>
                      Clear setup key
                    </button>
                  </>
                )}
                {codes.length > 0 && (
                  <div className="settings-v2-secret">
                    <div>
                      <strong>Save your recovery codes securely</strong>
                      <p>
                        These codes are shown once. Each can be used for one sign-in if you lose
                        access to your authenticator.
                      </p>
                      <div className="settings-v2-codes">
                        {codes.map((code) => (
                          <code key={code}>{code}</code>
                        ))}
                      </div>
                      <button className="secondary" onClick={() => setCodes([])}>
                        I saved these codes · clear
                      </button>
                    </div>
                  </div>
                )}
              </section>
              <details className="settings-v2-panel">
                <summary>Remove two-factor authentication</summary>
                <p>Your current password and an authenticator code are required.</p>
                <ActionForm
                  submit="Remove authenticator"
                  onSave={async (data) => {
                    await api('/auth/mfa/disable', 'POST', {
                      password: String(data.get('password') ?? ''),
                      code: String(data.get('code') ?? ''),
                    });
                    setSetup(null);
                    setCodes([]);
                  }}
                >
                  <TextField name="password" type="password" label="Current password" />
                  <TextField name="code" label="Authenticator code" />
                </ActionForm>
              </details>
            </>
          )}
          {current === 'appearance' && (
            <section className="settings-v2-panel">
              <div className="settings-v2-heading">
                <h2>Display preferences</h2>
                <p>
                  Saved for your account in this browser. These preferences do not change other
                  users’ workspaces.
                </p>
              </div>
              <ActionForm
                submit="Save preferences"
                onSave={async () => {
                  try {
                    localStorage.setItem(
                      'matahr:density:' + session.tenantId + ':' + session.id,
                      density,
                    );
                  } catch {
                    throw Error(
                      'This browser is blocking local preferences. Allow local storage and retry.',
                    );
                  }
                  window.dispatchEvent(new Event('matahr:preferences-changed'));
                }}
              >
                <fieldset className="settings-v2-density">
                  <legend>Workspace density</legend>
                  {['comfortable', 'compact'].map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="density"
                        value={value}
                        checked={density === value}
                        onChange={() => setDensity(value)}
                      />
                      <span>
                        <strong>{value === 'comfortable' ? 'Comfortable' : 'Compact'}</strong>
                        <small>
                          {value === 'comfortable'
                            ? 'More space between records and controls.'
                            : 'Closer rows for working with longer lists.'}
                        </small>
                      </span>
                    </label>
                  ))}
                </fieldset>
              </ActionForm>
            </section>
          )}
          {current === 'connections' && (
            <section className="settings-v2-panel">
              <div className="settings-v2-heading">
                <h2>Services & connections</h2>
                <p>Current capabilities of this workspace.</p>
              </div>
              {[
                {
                  name: 'MataHR API',
                  state: 'Connected',
                  detail:
                    'Your workspace uses authenticated ABP APIs and your organisation’s SQL Server database.',
                },
                {
                  name: 'Payroll provider',
                  state: 'Not connected',
                  detail:
                    'Payroll inputs and payslip workflows are managed in MataHR. External provider synchronisation is not configured.',
                },
                {
                  name: 'Sprinto policies',
                  state: 'Not connected',
                  detail: 'A Sprinto integration has not been activated for this workspace.',
                },
                {
                  name: 'Email delivery',
                  state: 'Managed on server',
                  detail:
                    'Recovery email delivery depends on the backend email configuration. Credentials are not exposed here.',
                },
              ].map((item) => (
                <div className="settings-v2-connection" key={item.name}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.detail}</p>
                  </div>
                  <span
                    className={'admin-v2-badge ' + (item.state === 'Connected' ? 'enabled' : '')}
                  >
                    {item.state}
                  </span>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
