# MataHR frontend

React, TypeScript and Vite. `src/main.tsx` mounts the single application in `src/app/App.tsx`. Authentication and workforce records use the ABP backend. There are no alternate demo entry points, seeded browser employee stores or fallback demo sign-ins.

## Run

Start the backend at `https://localhost:7043`, then run `npm ci` and `npm run dev` from this directory. Alternatively, use `npm install` and `npm run dev` from the repository root. Open `http://localhost:5173`.

Vite proxies `/api` to the backend. `MATAHR_API_TARGET` overrides the development proxy target for isolated tests. Its relaxed upstream certificate check applies only to local development.

If recovery email delivery is enabled, set the backend's `Auth:PasswordResetUrl` to the HTTPS frontend URL ending in `/reset-password`. The backend adds the one-time link parameters.

## Source layout

- `app/`: separate session controller, authentication/privacy gates, workspace shell, header, sidebar and routes.
- `features/`: admin, auth, dashboard, employees, organisation, attendance, leave, payroll and settings.
- `shared/`: API transport, request protection, session types and shared form/status components. Domain response types belong to their features.
- `styles/`: base styles, theme and a stylesheet manifest. The workspace frame and feature styles live with their owning modules.

Each feature owns its UI and feature-specific types. The organisation canvas uses a small adapter type; it does not import employee seeds, prototype workspace reducers or unrelated HR modules. Test fixtures stay in tests.

`features/dashboard/` contains separate `AdminDashboard`, `HRDashboard`, `ManagerDashboard` and `EmployeeDashboard` components. `HomePage` selects the assigned role's dashboard; shared dashboard components provide the header, workforce metrics, employee profile and workspace links. Backend permissions continue to enforce data access.

User management separates its controller, account table, editor, action menu and status confirmation. Audit trail and reviewed legacy imports have dedicated pages. Organisation chart state and commands live in `useOrganisationChart`; the toolbar, canvas, employee cards, reporting editor and connector editing have separate components. These components share typed controller contracts rather than duplicating state.

## Scope and limits

See [module status](../docs/module-status.md) for implemented workflows and unfinished requirements. A working page, a successful build or a passing test is not a claim that the entire HR product is complete.

Accounts and permissions are server-backed. The profile displays the signed-in account and linked employee information. Password and authenticator changes use security APIs. Appearance preferences and notification read status are scoped to the account in this browser. Notifications derive recent administrative activity from the audit API; they are not a server notification inbox or push service. Organisation settings are informational, rather than editable company configuration.

Payroll prepares dated inputs, review/approval, export and verified provider-payslip release. It does not calculate statutory net pay, submit tax returns or make payments. SMTP/recovery delivery and production deployment/security configuration require operational setup.

## Attendance and imports

On-site attendance checks a rotating code plus fresh browser GPS against an HR-configured boundary. Remote work and exceptions need review. This does not prove continuous presence or prevent all device/location spoofing. Real office coordinates, including Mpumalanga, still need confirmation.

Reviewed employee/account imports are tenant-scoped, expiring and checked again against the source before commit. Existing native credentials are preserved. The importer does not cover legacy contracts, payroll or other module records.

## Verification

```powershell
npm test
npm run build
npm run test:startup
```

Tests cover API/session request handling, real login behaviour, organisation canvas behaviour and architecture boundaries. Architecture checks fail if production source becomes unreachable from the application entry or imports an abandoned demo store.

The browser suite runs the real ABP API against a disposable SQL database and verifies all four roles. From the backend repository:

```powershell
pwsh -File scripts/Test-ConnectedFrontend.ps1 -FrontendPath <absolute-frontend-path>
```

It uses ports 7143 and 5174, cleans up its guarded test database, and does not modify the real MataHR database. Screenshots and traces are off by default. Browser artifacts stay in `.local/`.
