# MataHR React frontend

React 19 + TypeScript + Vite. Node.js 22 LTS recommended. Run npm install, npm start, then open http://localhost:5173. Run npm run build for type checking and production bundling. Angular history is preserved in archive/angular-frontend. Existing module prototypes migrated; no production authentication, real attendance verification, payroll, AI or persistent employee data. Login mockup remains a design reference, not implemented. Do not enter real employee data.


## Interface direction

Keep dashboard summaries on the overview and analytics screens. Task pages should lead with their work: the employee directory and profiles, leave requests and approvals, attendance records, payroll inputs, or organisation structure. Do not add KPI card grids or decorative hero banners to every module. Use compact headings, contextual actions, readable tables, and text-labelled status colours. Keep daily navigation visible and secondary modules in expandable groups.

The preview includes fictional employees, attendance and leave requests. They are session-only sample records and reset on reload.


## HR Operations workflows

The four HR Operations routes have dedicated components in `src/operations/`; do not route them through the generic records module.

- Compliance & Governance: obligation ownership, due dates, review tasks, evidence references and a policy reference library. Completion requires evidence and all review tasks to be done. These are internal demo tasks, not a predefined legal compliance checklist.
- Employee Relations: case intake, responsible HR officer, follow-up dates, dated case notes, recorded resolutions and closure. No real confidential case data should be entered; access controls are not implemented.
- Asset Management: equipment inventory, employee allocation, return condition, repair status and custody history. Asset tags and serial numbers must be unique.
- Employee Engagement: announcement drafts and publication, audience filters, session acknowledgements, single-choice polls and a feedback inbox with HR follow-up. No email notifications or live employee responses are sent or collected.

State lives at app level so navigating between pages retains session changes. Reloading resets the fictional sample data. Evidence and policies store reference text only, not uploaded files.

Run `npm run test:operations` for workflow rules and initial rendering checks. Run `npm run build -- --configLoader runner` when the sandbox prevents Vite's default config bundler from reading parent directories.


## Intelligence

`src/intelligence/` provides HR Analytics and the HR Assistant using the same report calculations and the current app state.

- Workforce: current headcount, department and contract mix, recorded start dates and employee source records. Exited and future-start employees are excluded from current headcount. Historical headcount and turnover are unavailable because exit dates and historical snapshots are not stored.
- Attendance: daily distinct employee counts, working arrangements, approved closed-session hours and review queues. Multiple sessions do not inflate employee-day counts. Missing records are not treated as absence. Hours are assigned to the register date.
- Leave: overlapping requests, approved weekdays clipped to the selected period and pending reviews. Employee-days are deduplicated. Holidays, shift patterns and entitlements are not inferred.
- Operations: a current snapshot of compliance stages, case workload and equipment custody. Date filters are disabled. Department scope follows obligation owners, case employees and current asset custodians. Unassigned equipment remains company-wide.

Reports support department and date filters (up to 92 days), CSV exports with formula protection, source-module links and calculation notes. Filters are preserved in URL parameters when moving between reports and the assistant.

The assistant is a deterministic record-summary demonstration, not a connected language model. Responses identify their source and reporting basis, use data at the time of the question, and do not change records. Policy interpretation and entitlement questions require verified sources. No employee case narratives are included in assistant summaries.

Run `npm run test:intelligence` for calculations, scope, exports and assistant checks, or `npm test` for all frontend workflow checks.


## Administration

The administration routes use dedicated components in `src/administration/` and are not generic record screens.

- Employee Self-Service provides employee-scoped employment details, contact updates, attendance and leave, equipment custody, policy references and HR requests. The employee selector is a demonstration, not authentication. Switching employees remounts the workspace to clear drafts and detail selections. Employment corrections create review requests instead of editing employee records. Only an employee's own submitted requests can be withdrawn; employee previews cannot complete their requests. Personal document downloads and payslips are not connected.
- Audit Logs records successful state changes across employees, organisation, workforce, HR operations, self-service and settings. `useWorkspace` applies changes and records their audit events together. Filters cover query, module, action and Johannesburg calendar dates; exports include UTC timestamps. The trail records field names and status transitions, not personal field values or narrative contents. It is client-side session history, not persistent or tamper-proof server audit evidence. Initial demo records do not generate fabricated audit events.
- Settings controls the organisation name shown in the header, the HR contact and office shown in self-service, available employee request types, response targets, receipt text and actual table density. Request response targets count weekdays and do not exclude public holidays. Access and external integrations are presented as their current capabilities without simulated security controls.

Workspace state and the audit trail live together in an app-level reducer and reset on reload. Response-target configuration changes affect new requests; existing target dates stay unchanged. Run `npm run test:administration` for request lifecycle, settings validation, audit integration and rendering checks.


## Core HR employee files

Employee profiles now have Overview, Personal information, Employment, Contracts, Documents, Probation and History sections. The directory also provides a task-focused HR follow-up list. Profile links support `?employee=<id>&tab=Contracts` (or another section name).

- Contracts follow Draft → In review → Approved → Awaiting signature → Signed. Submitting a contract for review requires an attached document. Approval records require reviewer notes. Signature tracking requires an attached, manually verified signed copy, two recorded dates, an employer signatory and evidence reference. This does not execute signatures or send signing requests. Non-draft terms are immutable; renewals create independent reviewed versions. Overlapping signed terms are rejected. Termination dates and reasons are recorded separately from employee exits and payroll.
- Employment changes record effective dates, before/after assignments and reasons. Due changes apply atomically to the employee profile and organisation assignment. Future changes stay scheduled until explicitly applied; cancelled changes remain in history. Organisation position/department/manager edits also reconcile employee profiles and create employment history. Reporting cycles are rejected by the editing workflows.
- Documents accept non-empty PDF, DOCX, PNG and JPG files up to 10 MB. Files remain in browser memory, are downloadable within the session and are lost on reload. Replacement uploads retain older versions. Manual reviews track a reviewer and outcome; collection requirements use the latest verified, unexpired matching evidence. Visibility is a frontend preview label, not an implemented permission boundary. Only the latest Employee-visible documents appear in that employee's self-service view.
- Personal information includes contact details, address and an emergency contact, with shared contact fields also used by self-service. Audit entries identify changed fields without copying personal values.
- Probation tracks the period, review date, reviewer and outcome history. Extensions require a later end date and future review. Confirmation does not automatically change employment or payroll.
- Follow-ups show expiring or expired contracts without signed successors, scheduled terminations, probation reviews, due scheduled changes and missing personnel documents. No external reminder messages are sent.

All Core HR state survives navigation within the session and is included in the session audit trail. There is no persistent storage, real electronic signing, secure file service or production access enforcement. Use fictional files and records. Run `npm run test:corehr` for workflow and profile-rendering checks.


## Sprinto references and policy acknowledgements

Compliance → Policies provides a policy authoring workspace, separate from the obligation register. The company uses Sprinto; policies can carry their Sprinto reference and a credential-free HTTPS source link. No Sprinto API, import, sync, email or external notification service is connected. Authoring a local copy does not update Sprinto.

HR drafts the full text, submits it for review, records approval and distributes the exact version to all current employees, a department or selected current employees. Publishing creates per-employee inbox assignments with deadlines; it does not imply email delivery. Published content is immutable. New text needs a new version, approval and distribution. Reassigning an existing version adds only new recipients and preserves earlier acknowledgements. A new version supersedes older outstanding requests only for its selected recipients; prior acknowledgements remain historical and never satisfy a new version.

Employee Self-Service → Policies shows only the selected employee's assigned published/archived versions. A new assignment appears as available; explicitly opening it records first access. A separate checkbox and button record acknowledgement of that exact version, employee and timestamp. Opening is not proof of reading. HR has no acknowledge-on-behalf control. Demo identity switching is not production authentication.

The HR acknowledgement register separates availability, first opening and acknowledgement, with filters, deadlines, in-app reminders and CSV export. In-app reminders do not imply receipt or acknowledgement. Archiving withdraws outstanding requests while retaining text and acknowledgement history. Policy lifecycle, distribution, opening, reminders and acknowledgements enter the session audit trail without copying policy body text into it.

A fictional published handbook is assigned to the Alex Morgan demo employee so the inbox can be reviewed immediately. No sample acknowledgement is fabricated. All policy content and receipts are session-only and reset on reload. Run `npm run test:policies` for lifecycle, recipient scope, versioning, receipt integrity, audit and page-rendering checks.


## Development startup regression check

Keep all import declarations above module-level `lazy(...)` calls. Vite's development CommonJS interop can initialise React bindings at the import's original position, so placing a lazy component before the React import causes `Cannot access 'lazy' before initialization`. A production build can pass despite this development-only crash.

With the dev server running, use `npm run test:startup` (or append a different base URL). It fetches the actual modules served by Vite, proves the old ordering reproduces the exception, and executes the corrected entry to render the dashboard, employee contracts, policy workspace and employee policy inbox. The check substitutes browser mounting/HMR with server rendering; it verifies module execution and rendering, not browser appearance.


## HR-managed organisation chart

Organisation opens the visual chart by default (`/organisation?tab=chart`). Departments, Positions and Branches remain available as editing tabs. The chart is generated from the same position and reporting-manager assignments used by employee profiles; HR does not draw connectors manually.

HR can create positions directly from the reporting-line editor, place an existing employee at top level, and use a manager card's Add report action to build each team. Selecting a card opens its assignment editor. Changing a manager moves the whole existing reporting subtree. Save reporting line applies immediately to the session, updates the employee profile and records employment/audit history. Self-reporting and reporting to descendants are rejected. A manager must have a valid chart placement before reports can be assigned.

The canvas provides connected employee cards, department colours, background panning, zoom, fit-to-view, expand/collapse, team focus, employee/role search, department and branch filters, an accessible list view and an SVG download of the visible chart. Filtered views retain managers as visibly marked context instead of inventing new top-level relationships. Multiple top-level employees connect to the company header without implying that one of them is a CEO.

Arrange cards is the default: drag a card anywhere on the canvas and its connectors follow the saved position. Moving cards does not change reporting assignments or employment history. Optional Move whole team preserves relative positions; Snap grid aligns placements. Change manager is a separate mode: drop onto a manager or the company header to update reporting lines. Drag employees from Needs placement onto the canvas or a manager; a matching position is reused, otherwise HR selects a position before committing. Escape and drops outside the canvas cancel the move. Edge dragging pans the canvas. Arrow keys move a focused card (Shift for larger steps), Undo reverses up to 20 chart edits, and Auto-arrange restores the automatic tree without changing reporting lines. Coordinates and reporting edits remain session-only; layout edits are audited separately.

The Needs placement queue lists current employees without a valid assignment. Exited employees and future starters are excluded. Imported missing managers and circular reporting lines are flagged; the layout remains inspectable so HR can repair the assignments. Removing someone from the chart retains their employee record and requires selecting where their direct reports move. This is a session-only prototype; saved structures reset on reload until persistent storage is connected.

Run `npm run test:organisation` for layout geometry, hierarchy filtering, assignment editing, cycle prevention, export escaping and employee/audit synchronisation checks. `npm run test:organisation-drag` checks saved coordinates, pointer gestures at multiple zoom levels, manager drops, cancellation, edge panning and undo. `npm run test:startup` also renders the actual development entry for the chart and positions views.

Direct line editing: drag a manager's bottom connector to an employee card, or select the bottom dot then the employee's top dot (Enter/Space also work). Company connections mean top level. Connecting updates the reporting assignment and employee history while preserving card coordinates. Self and descendant connections are rejected. Drag a line's small bend dot to change its route; arrow keys provide keyboard adjustment. Select a line to reset its route or disconnect its manager (return to top level). Undo includes routing and connections, and SVG exports include saved routing. Custom routing is associated with its manager so reconnecting does not reuse a previous manager's route.

Appointment letters: in an employee's Contracts tab, create a draft and choose Create appointment letter. HR edits company and employee names, role, total monthly cost to company, included allowance, responsibilities, benefits, location, equipment, additional terms, signatory and letterhead footer. Optional PNG/JPEG/WebP logos are embedded locally (1 MB limit). A sandboxed live preview uses the contract reference, dates and type. Saving validates terms, attaches an unsigned HTML copy to Documents and retains prior generated copies. Download HTML or use Print / Save PDF in the preview. Generated letters follow the existing draft/review/approval workflow; reviewed versions remain immutable. This does not send letters or generate signatures; signed evidence must still be attached and verified separately. Templates and attachments reset on reload with the session.

## Digital Register workspace

Dedicated frontend attendance workspace with daily employee roster, history, range timesheets and CSV, work locations, same-day recurring schedules, exception detection, correction and overtime requests, demo review notes and shared employee clock-in via Self-Service. Approved overtime is a subset of approved attendance hours and appears in Payroll inputs. Configuration and requests participate in the session audit trail. Verification preferences and outcomes are simulations, not actual GPS, QR, network or biometric evidence. No authentication, persistent storage, offline queue, historic schedule versions, overnight shift rules or real manager authorization. Use fictional records only. Run npm test for attendance rule checks.

## Leave and payroll workspaces

Shared session leave policies, annual entitlement records, monthly accrual preview, manual carry-over/adjustment, configured non-working dates, scheduled working days, balance reservations and staged manager/HR reviews. Employee self-service uses the same model. Payroll salary profiles, benefits, period preparation, reviewed input snapshots, approval and generic CSV export, provider identifier mapping and session-only provider PDF references. No legal entitlement defaults, automatic statutory calculations, real access control, provider transmission or persistent data. Annual calendar-year cycles only; monthly accrual is a simplified preview, no automatic carry-forward. Run npm test for rule checks.

Employee dashboard: Self-Service now opens Dashboard by default; existing direct links to details, time, equipment, documents, policies and requests remain supported. The dashboard follows the shared white-card style with a dark identity banner, actual leave approval notice, distinct recorded-day donut, policy-specific leave balances, recorded-time ring, approved hours cards and attendance intervals. The date selector and CSV summary are employee-scoped. Scheduled targets count scheduled days through the selected date and exclude configured holidays and pre-employment dates. Unconfigured entitlements and schedules remain explicit; missing attendance is not labelled absence. Open and pending sessions appear only in recorded time, while approved hour cards use closed approved sessions. Overtime uses approved overtime requests. Clock and leave actions open the existing employee-only My time workflows. Productive time, break durations, comparison percentages and employee rankings are not inferred.

Clock station: Digital Register now opens Clock in & out first. The page shows a live SAST clock, selected employee, open-session duration, today's recorded hours, work-location radio cards and a single clock action. Closed sessions go to Pending review through the unchanged attendance model. Simulation choices are grouped in a Verification preview disclosure. Approved leave blocks a new clock-in; an existing open session can still be closed. Today's sessions, history and correction requests sit below the main action. Employee Self-Service uses the same component with its employee selection locked. Recorded time includes open and pending sessions and does not imply physical-presence verification.

Login design preview: `/` and `/login` render a standalone responsive sign-in page outside the shell. Sign in validates sample form fields and opens the POPIA notice before any workspace appears. Acknowledge & continue starts an explicitly labelled demo session and opens the HR workspace. Closing or cancelling the notice leaves access closed. HR and employee preview buttons use the same notice, with the selected destination retained until acknowledgement. Password visibility and account-help text remain available. No password or email is sent, verified or persisted; real authentication and role enforcement require a backend.

The login screen uses a charcoal office-photo overlay, a crimson headline accent, three compact feature rows and a white sign-in area. The company/help top row and decorative waves are omitted. The office photograph is a decorative stock image, not a Matateni office photograph; attribution is in `public/brand/CREDITS.md`.

POPIA login acknowledgement: the notice appears after pressing Sign in or selecting a demo workspace. A native modal manages focus and permits closing without acknowledgement. Protected frontend views stay hidden until acknowledgement creates the browser-only demo session. Session storage holds only destination, privacy-notice version and acknowledgement timestamp, so refresh in the same tab retains entry. Invalid or outdated markers require acknowledgement again; Sign out of demo clears the marker. This is not server authentication or a compliance-grade audit trail. Notice Preview 1.0 links to the official Act and Information Regulator, distinguishes acknowledgement from blanket consent, and flags employer-specific details to finalise before live processing.
