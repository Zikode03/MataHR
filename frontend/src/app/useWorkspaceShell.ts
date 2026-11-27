import {
  CalendarDays,
  Clock3,
  FileClock,
  Import,
  LayoutDashboard,
  Network,
  Settings2,
  ShieldCheck,
  UserRoundCog,
  Users,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { can, type Session } from '../shared/api';

import type { SessionController } from './useSession';
export function useWorkspaceShell(controller: SessionController & { session: Session }) {
  const { session, role } = controller;
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false),
    [compact, setCompact] = useState(false),
    [menu, setMenu] = useState(false);
  useEffect(() => {
    const read = () => {
      try {
        setCompact(
          !!session &&
            localStorage.getItem('matahr:density:' + session.tenantId + ':' + session.id) ===
              'compact',
        );
      } catch {
        setCompact(false);
      }
    };
    read();
    window.addEventListener('matahr:preferences-changed', read);
    return () => window.removeEventListener('matahr:preferences-changed', read);
  }, [session?.id, session?.tenantId]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 760px)');
    const resized = () => {
      if (!mobile.matches) setMenu(false);
    };
    mobile.addEventListener('change', resized);
    return () => mobile.removeEventListener('change', resized);
  }, []);
  useEffect(() => {
    if (!menu) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    document.querySelector<HTMLAnchorElement>('.app-sidebar nav a')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [menu]);

  const hr = role === 'HR',
    admin = role === 'Admin',
    manager = role === 'Manager';
  const nav = [
    {
      to: '/dashboard',
      label: admin ? 'System overview' : manager ? 'My team' : hr ? 'HR dashboard' : 'My workspace',
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: '/employees',
      label: hr ? 'Employees' : manager ? 'Team directory' : 'My profile',
      icon: Users,
      show: (!admin || !!session.employeeId) && can(session, 'People.Read'),
    },
    {
      to: '/organisation',
      label: 'Organisation',
      icon: Network,
      show: !admin && can(session, 'Organisation.Read'),
    },
    {
      to: '/register',
      label: 'Digital register',
      icon: Clock3,
      show: can(session, 'Attendance.Own') && (!admin || !!session.employeeId),
    },
    {
      to: '/leave',
      label: manager ? 'Leave & approvals' : 'Leave management',
      icon: CalendarDays,
      show: can(session, 'Leave.Own') && (!admin || !!session.employeeId),
    },
    {
      to: '/payroll',
      label: hr ? 'Payroll & benefits' : 'My payslips & benefits',
      icon: Wallet,
      show: can(session, 'Payroll.Own') && (!admin || !!session.employeeId),
    },
    {
      to: '/administration/users',
      label: 'User management',
      icon: UserRoundCog,
      show: admin && can(session, 'Accounts'),
    },
    {
      to: '/administration/permissions',
      label: 'Roles & permissions',
      icon: ShieldCheck,
      show: admin && can(session, 'Accounts'),
    },
    {
      to: '/administration/audit',
      label: 'Audit trail',
      icon: FileClock,
      show: admin && can(session, 'Accounts') && can(session, 'Audit'),
    },
    {
      to: '/imports',
      label: 'Legacy import',
      icon: Import,
      show:
        (admin && can(session, 'Accounts')) ||
        (hr && can(session, 'People.Write') && can(session, 'Organisation.Write')),
    },
    { to: '/settings/general', label: 'Settings', icon: Settings2, show: true },
  ].filter((x) => x.show);
  const roleName = admin
    ? 'System administrator'
    : hr
      ? 'Human resources'
      : manager
        ? 'Manager'
        : 'Employee';

  return {
    ...controller,
    location,
    collapsed,
    setCollapsed,
    compact,
    menu,
    setMenu,
    admin,
    hr,
    manager,
    nav,
    roleName,
  };
}
export type WorkspaceShellContext = ReturnType<typeof useWorkspaceShell>;
