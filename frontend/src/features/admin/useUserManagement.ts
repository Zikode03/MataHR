import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, useApi, type Page, type Role, type Session } from '../../shared/api';
import type { Account } from './types';

const roles: Role[] = ['Admin', 'HR', 'Manager', 'Employee'];
const descriptions: Record<Role, string> = {
  Admin: 'Users, permissions and system administration',
  HR: 'Employee records and HR operations',
  Manager: 'Team requests and approvals',
  Employee: 'Personal records and self-service',
};
export function useUserManagement({ session }: { session: Session }) {
  const location = useLocation();
  const [offset, setOffset] = useState(0),
    [query, setQuery] = useState(''),
    [role, setRole] = useState('all'),
    [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<Account | null>(null),
    [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [editorMode, setEditorMode] = useState<'edit' | 'view' | 'status'>('edit');
  const [menuAccount, setMenuAccount] = useState<Account | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTrigger = useRef<HTMLButtonElement | null>(null);
  const dialog = useRef<HTMLElement>(null);
  const accounts = useApi<Page<Account>>('/admin/accounts?maxResultCount=25&skipCount=' + offset);
  const links = useApi<{ id: string; number: string; name: string }[]>('/admin/employee-links');
  useEffect(() => {
    if (location.hash === '#account-form') {
      setSelected(null);
      setEditorMode('edit');
      setOpen(true);
    }
  }, [location.key, location.hash]);
  useEffect(() => {
    if (!open) return;
    const previous = menuTrigger.current?.isConnected
        ? menuTrigger.current
        : document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLElement>('input,button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key === 'Tab') {
        const fields = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]',
          ) ?? [],
        ).filter((el) => el.offsetParent !== null);
        const first = fields[0],
          last = fields[fields.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  useEffect(() => {
    if (!menuAccount) return;
    menuRef.current?.querySelector<HTMLElement>('button,a')?.focus();
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target) &&
        !menuTrigger.current?.contains(event.target)
      )
        setMenuAccount(null);
    };
    const closeOnScroll = (event: Event) => {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target))
        setMenuAccount(null);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setMenuAccount(null);
        menuTrigger.current?.focus();
      }
      if (event.key === 'Escape') {
        setMenuAccount(null);
        menuTrigger.current?.focus();
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
        );
        const index = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        event.preventDefault();
        items[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', keyboard);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnScroll);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', keyboard);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnScroll);
    };
  }, [menuAccount]);
  useEffect(() => {
    if (open) dialog.current?.querySelector<HTMLElement>('button,input,a')?.focus();
  }, [open, editorMode]);
  function manage(account: Account, mode: 'edit' | 'view' | 'status') {
    setMenuAccount(null);
    setSelected(account);
    setEditorMode(mode);
    setOpen(true);
  }
  // Reuse the stamped update so deactivation cannot overwrite a newer role or employee-link change.
  async function changeStatus() {
    if (!selected || selected.id === session.id)
      throw Error('Another administrator must change your account access.');
    await api('/admin/accounts/' + selected.id, 'PUT', {
      roles: selected.roles,
      employeeId: selected.employeeId,
      active: !selected.active,
      concurrencyStamp: selected.concurrencyStamp,
    });
    setNotice(
      selected.email + (selected.active ? ' has been deactivated.' : ' has been activated.'),
    );
    accounts.reload();
    setOpen(false);
    setSelected(null);
  }
  const items = accounts.data?.items ?? [];
  const visible = items.filter((account) => {
    const person = links.data?.find((person) => person.id === account.employeeId);
    return (
      (!query ||
        [account.email, person?.name, person?.number].some((value) =>
          value?.toLowerCase().includes(query.toLowerCase()),
        )) &&
      (role === 'all' || account.roles.includes(role as Role)) &&
      (status === 'all' || account.active === (status === 'active'))
    );
  });
  const filtered = !!query || role !== 'all' || status !== 'all';
  const total = accounts.data?.totalCount ?? 0;
  function create() {
    menuTrigger.current = null;
    setSelected(null);
    setEditorMode('edit');
    setOpen(true);
  }
  return {
    session,
    location,
    offset,
    setOffset,
    query,
    setQuery,
    role,
    setRole,
    status,
    setStatus,
    selected,
    setSelected,
    open,
    setOpen,
    notice,
    setNotice,
    editorMode,
    setEditorMode,
    menuAccount,
    setMenuAccount,
    menuPosition,
    setMenuPosition,
    menuRef,
    menuTrigger,
    dialog,
    accounts,
    links,
    manage,
    changeStatus,
    items,
    visible,
    filtered,
    total,
    create,
    roles,
    descriptions,
  };
}
export type UserManagementContext = ReturnType<typeof useUserManagement>;
