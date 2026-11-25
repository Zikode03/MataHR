# MataHR connected frontend

React 19, TypeScript and Vite. The default entry point mounts `src/live/LiveApp.tsx`, which uses the ABP backend rather than the old browser-only workspace stores.

## Run locally

Start `MataHR.Workforce.Host` from the backend repository on `https://localhost:7043`. In this directory:

```powershell
npm ci
npm start
```

Open `http://localhost:5173`. Vite forwards `/api` to the local HTTPS backend, using the same browser origin for session cookies. `MATAHR_API_TARGET` overrides the proxy target for isolated tests. The relaxed upstream certificate check is limited to the local Vite development proxy; it is not a production TLS policy.

Sign in with an assigned native account. The organisation ID comes from `/api/auth/config`; a manual field appears if configuration is unavailable. Passwords and role assignments are never stored in browser storage. MFA challenges, server-recorded privacy acknowledgement, expired sessions and mandatory first-login password changes are handled before opening workforce routes.

## Connected workflows

| Workspace | Live capabilities |
|---|---|
| System Administrator | Native accounts, employee links using a minimal directory, assigned roles, persisted role grants, audit metadata and reviewed account imports |
| HR | Employee records/history/documents/contracts, organisation chart/reporting/layout, attendance setup and review, leave configuration/decisions, compensation/benefits/payroll input workflows and reviewed employee imports |
| Manager | Direct-report records, attendance/correction/overtime decisions, manager-stage leave decisions and personal services |
| Employee | Own record/documents/contracts, attendance, leave/balances, released payslips/benefits and a safe read-only organisation directory |

Navigation follows permissions returned by the server. Every API operation also checks server permissions, tenant boundaries and employee/team scope. No role picker can assign access. Multi-role users can switch between their assigned workspaces.

The existing HR organisation canvas is retained: card positions, reporting changes, connector control points and company-card coordinates are saved through the API. Read-only views use a reporting tree and do not expose confidential employee fields.

Payroll prepares dated inputs, independent review/approval, export and verified provider-payslip release. It does not calculate statutory net pay, submit tax returns or make payments.

## Attendance verification

HR creates work locations and configures actual GPS coordinates with a 50–1000 metre boundary. The on-site display rotates an eight-digit code every two minutes while open. Clock-in requires the current code plus a fresh location inside the boundary, with accuracy of 50 metres or better. A code cannot be reused by the same employee. Codes are hashed in the database; precise employee coordinates are not retained in attendance records.

Evidence is a clock-in check, not proof of continuous presence or a guarantee against device/location spoofing. Remote work and exception reasons remain unverified and require independent attendance review. Completed attendance also follows its normal review workflow.

Actual office boundaries are deliberately unset until HR supplies the correct sites, including the Mpumalanga office. Fictional browser-test coordinates must never be treated as real office configuration.

## Reviewed legacy import

HR reviews employee records; Admin reviews accounts. The server creates an expiring review, verifies the source fingerprint again at commit, checks role/tenant scope, and applies the accepted batch transactionally. Existing native records are not overwritten. Missing employee links, conflicting numbers, invalid roles and reporting cycles block import. Imported accounts get one-time temporary credentials and must change their password before opening workforce routes.

An explicitly configured legacy source tenant can map to one named destination tenant. It is not a client-supplied tenant switch. Credentials and legacy password hashes are never included in review rows. The importer covers employees/accounts, not legacy contracts, payroll or other module data.

## Verification

```powershell
npm test
npm run build
```

The browser suite uses a real ABP API and a GUID-named disposable SQL database, not mocked API responses. From the backend repository:

```powershell
pwsh -File scripts/Test-ConnectedFrontend.ps1 -FrontendPath <absolute-path-to-this-frontend>
```

It uses loopback API port 7143 and frontend port 5174, tests all four roles, persistence, payroll access boundaries, GPS/code clock-in and staged leave approval, then shuts down and deletes only its guarded test database. On Windows it uses installed Microsoft Edge; Linux requires Playwright Chromium installed. Browser artifacts stay in `.local/`.

The remaining prototype directories (`operations`, `intelligence`, and older workspace models) are retained as design references and regression-tested source. They are not mounted as live workflows by the new entry point. SMTP/recovery delivery and production deployment/security configuration remain operational setup tasks.
