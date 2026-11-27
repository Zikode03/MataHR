# Module status

This records the implemented scope, not completion of the whole product.

| Area                                                               | Current application                                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Authentication and four workspaces                                 | Native sign-in, assigned roles, server permissions, privacy gate and own/team/HR scopes                              |
| Administration                                                     | Accounts, role grants, audit metadata, reviewed account imports; own profile is read-only                            |
| Core HR                                                            | Employee records, history, document and contract workflows through APIs                                              |
| Branded appointment letters and electronic signing                 | Not implemented as connected workflows; existing document/contract APIs remain                                       |
| Organisation                                                       | Structure records, reporting, drag/drop chart layout and connector persistence                                       |
| Attendance                                                         | Clocking, requests, reviews, schedules, rotating code and configured GPS boundary checks                             |
| Leave                                                              | Balances, policies, applications and review stages                                                                   |
| Payroll and benefits                                               | Dated inputs, review, export and provider payslip verification/release; no statutory calculation or payments         |
| Settings                                                           | Own password/authenticator APIs; informational organisation/connections pages; browser-scoped appearance preferences |
| Notifications                                                      | Recent administrative audit activity with polling; browser-scoped read status, not a server inbox                    |
| Recruitment and onboarding/offboarding                             | Not implemented as connected workflows                                                                               |
| Performance and learning                                           | Not implemented as connected workflows                                                                               |
| Digital skills passport                                            | Not implemented as a connected workflow                                                                              |
| Intelligent workforce and tender management                        | Not implemented as a connected workflow                                                                              |
| Compliance/policy authoring, delivery, acknowledgement and Sprinto | Not implemented as connected workflows                                                                               |
| Employee relations, assets and engagement                          | Not implemented as connected workflows                                                                               |
| HR analytics and AI assistant                                      | Not implemented as connected workflows                                                                               |

Unmounted prototypes and their browser-only stores were removed during consolidation. Historical designs remain in Git history; they are not product functionality. Reintroducing these modules requires APIs, permissions, persistence and workflow verification.

Production deployment, office boundary configuration, email delivery and external integrations remain operational or implementation work. Previously unpushed profile work is preserved in the new feature structure.
