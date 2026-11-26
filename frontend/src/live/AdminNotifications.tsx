import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, ArrowUpRight, Users, ShieldCheck, FileClock } from 'lucide-react';
import { useApi, type Page, type Session } from './api';
type AdminEvent = { id: string; actorId: string; action: string; targetId: string; at: string };
const titles: Record<string, string> = {
  'Account.Created': 'New user account created',
  'Account.Activated': 'User account activated',
  'Account.Deactivated': 'User account deactivated',
  'Account.AssignmentChanged': 'User access updated',
  'Role.PermissionChanged': 'Role permissions updated',
  'LegacyImport.ReviewPrepared': 'Import review prepared',
  'LegacyImport.Committed': 'Import completed',
};
function readSaved(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string').slice(-500)
      : [];
  } catch {
    return [];
  }
}
export function AdminNotifications({ session }: { session: Session }) {
  const key = 'matahr:notification-reads:' + session.tenantId + ':' + session.id;
  const [read, setRead] = useState<string[]>(() => readSaved(key));
  const [storageWarning, setStorageWarning] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const feed = useApi<Page<AdminEvent>>('/admin/audit?maxResultCount=25');
  const notifications = (feed.data?.items ?? []).filter(
    (item) =>
      item.action.startsWith('Account.') ||
      item.action.startsWith('Role.') ||
      item.action.startsWith('LegacyImport.'),
  );
  const unread = notifications.filter((item) => !read.includes(item.id)).length;
  const { reload } = feed;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current)
        menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    const storage = (event: StorageEvent) => {
      if (event.key === key) setRead(readSaved(key));
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    window.addEventListener('storage', storage);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('storage', storage);
    };
  }, [key]);
  function mark(ids: string[]) {
    const next = Array.from(new Set([...read, ...ids])).slice(-500);
    setRead(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setStorageWarning(true);
    }
  }
  return (
    <details
      className="header-notifications"
      ref={menu}
      onToggle={(event) => {
        if (event.currentTarget.open) reload();
      }}
    >
      <summary
        aria-label={unread ? 'Notifications, ' + unread + ' unread' : 'Notifications'}
        title="Notifications"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="notification-count" aria-hidden="true">
            {unread}
          </span>
        )}
      </summary>
      <section className="notifications-panel" aria-label="Admin notifications">
        <div className="notifications-heading">
          <div>
            <h2>Notifications</h2>
            <p>Recent administration activity</p>
          </div>
          <button
            type="button"
            aria-label="Mark all notifications as read"
            title="Mark all as read"
            disabled={!unread}
            onClick={() => mark(notifications.map((item) => item.id))}
          >
            <CheckCheck size={19} />
          </button>
        </div>
        {feed.loading && !feed.data && (
          <p role="status" className="notifications-feedback">
            Loading notifications…
          </p>
        )}
        {feed.error && (
          <div className="notifications-feedback" role="alert">
            <p>{feed.error}</p>
            <button onClick={reload}>Retry</button>
          </div>
        )}
        {!feed.loading && !feed.error && notifications.length === 0 && (
          <div className="notifications-empty">
            <Bell size={28} />
            <strong>You’re all caught up</strong>
            <p>New account, role and import activity will appear here.</p>
          </div>
        )}
        <div className="notifications-list">
          {notifications.map((item) => {
            const isRead = read.includes(item.id);
            const account = item.action.startsWith('Account.');
            const role = item.action.startsWith('Role.');
            const Icon = account ? Users : role ? ShieldCheck : FileClock;
            return (
              <Link
                key={item.id}
                className={isRead ? 'is-read' : 'is-unread'}
                to={
                  account
                    ? '/administration/users'
                    : role
                      ? '/administration/permissions'
                      : '/imports'
                }
                onClick={() => {
                  mark([item.id]);
                  if (menu.current) menu.current.open = false;
                }}
              >
                <span className="notification-event-icon">
                  <Icon size={17} />
                </span>
                <span>
                  <strong>{titles[item.action] ?? 'Administration activity recorded'}</strong>
                  <small>
                    {item.actorId === session.id ? 'By you' : 'By an authorised user'} ·{' '}
                    <time dateTime={item.at}>
                      {new Intl.DateTimeFormat('en-ZA', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Africa/Johannesburg',
                      }).format(new Date(item.at))}
                    </time>
                  </small>
                </span>
                {!isRead && <i aria-label="Unread" />}
              </Link>
            );
          })}
        </div>
        <div className="notifications-footer">
          <Link
            to="/administration/audit"
            onClick={() => {
              if (menu.current) menu.current.open = false;
            }}
          >
            Open audit trail <ArrowUpRight size={15} />
          </Link>
          <small>
            {storageWarning
              ? 'Read status is available for this session only.'
              : 'Read status is saved in this browser.'}
          </small>
        </div>
      </section>
    </details>
  );
}
