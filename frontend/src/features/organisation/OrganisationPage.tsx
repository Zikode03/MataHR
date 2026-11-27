import { useMemo, useState } from 'react';
import { OrganisationChart } from './OrganisationChart';
import type { ChartRecord, Org } from './types';

import { api, can, message, useApi, type Session } from '../../shared/api';
import type { Employee } from '../employees/types';
import type { Structure } from './apiTypes';

import { ActionForm, Empty, field, Loading, TextField } from '../../shared/ui';
// The API stores normalised records. The canvas uses a drawing model, so adapt at this boundary.
function adapt(source: Structure): Org {
  const positions: Org['chartLayout'] = {
    positions: {},
    company: source.company ?? { x: 400, y: 0 },
    routes: {},
  };
  for (const item of source.layout) {
    positions.positions[item.employeeId] = { x: item.x, y: item.y };
    try {
      const points = JSON.parse(item.connector);
      if (points[0])
        positions.routes![item.employeeId] = {
          manager: source.employees.find((e) => e.id === item.employeeId)?.managerId ?? '',
          point: points[0],
        };
    } catch {
      /* Old routes without points use automatic connectors. */
    }
  }
  return {
    branches: source.branches.map((b) => ({ ...b, address: '' })),
    departments: source.departments.map((d) => ({ id: d.id, name: d.name, branch: d.branchId })),
    positions: source.positions.map((p) => ({
      id: p.id,
      name: p.name,
      department: p.departmentId,
    })),
    assignments: source.employees.map((e) => ({
      employee: e.id,
      position: e.positionId ?? '',
      manager: e.managerId ?? '',
    })),
    chartLayout: source.layout.length || source.company ? positions : undefined,
  };
}
export function OrganisationPage({ session }: { session: Session }) {
  const query = useApi<Structure>('/organisation/structure'),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(''),
    [tab, setTab] = useState<'chart' | 'branches' | 'departments' | 'positions'>('chart');
  const org = useMemo(() => (query.data ? adapt(query.data) : null), [query.data]);
  const write = can(session, 'Organisation.Write');
  const rows: ChartRecord[] =
    query.data?.employees.map((e) => ({
      id: e.id,
      status: e.active ? 'Active' : 'Exited',
      values: [
        e.number,
        e.name,
        query.data?.departments.find(
          (d) => d.id === query.data?.positions.find((p) => p.id === e.positionId)?.departmentId,
        )?.name ?? '',
        query.data?.positions.find((p) => p.id === e.positionId)?.name ?? '',
        '',
      ],
    })) ?? [];
  async function save(next: Org) {
    if (!query.data || busy || !write) return;
    setBusy(true);
    setFeedback('Saving organisation…');
    try {
      const source = query.data,
        ids = new Map<string, string>();
      // Positions created in the chart have local IDs. Resolve their database IDs before assigning people.
      for (const position of next.positions.filter(
        (p) => !source.positions.some((old) => old.id === p.id),
      )) {
        const saved = await api<{ id: string }>('/organisation/positions', 'POST', {
          name: position.name,
          departmentId: position.department,
        });
        ids.set(position.id, saved.id);
      }
      for (const assignment of next.assignments) {
        const employee = source.employees.find((e) => e.id === assignment.employee);
        if (!employee) continue;
        const positionId = ids.get(assignment.position) || assignment.position || null;
        const managerId = assignment.manager || null;
        if (positionId !== employee.positionId || managerId !== employee.managerId)
          await api<Employee>('/organisation/assignments', 'PUT', {
            employeeId: employee.id,
            positionId,
            managerId,
            concurrencyStamp: employee.concurrencyStamp,
          });
      }
      if (next.chartLayout) {
        await api(
          '/organisation/layout',
          'PUT',
          source.employees
            .filter((e) => next.chartLayout?.positions[e.id])
            .map((e) => ({
              employeeId: e.id,
              ...next.chartLayout!.positions[e.id],
              connector: JSON.stringify(
                next.chartLayout?.routes?.[e.id] ? [next.chartLayout.routes[e.id].point] : [],
              ),
            })),
        );
        await api('/organisation/canvas', 'PUT', next.chartLayout.company);
      }
      setFeedback('Organisation saved.');
    } catch (error) {
      setFeedback(message(error));
    } finally {
      setBusy(false);
      // A chart save spans several endpoints. Reload even after a failure to show what actually persisted.
      query.reload();
    }
  }
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">PEOPLE / ORGANISATION</div>
          <h1>Organisation</h1>
          <p>
            {write
              ? 'Arrange your organisation and maintain reporting lines.'
              : 'Your organisation and reporting relationships.'}
          </p>
        </div>
      </div>
      <Loading error={query.error} loading={query.loading} />
      {feedback && (
        <p role="status" className="notice">
          {feedback}
        </p>
      )}
      {write && (
        <div className="life-nav">
          {(['chart', 'branches', 'departments', 'positions'] as const).map((item) => (
            <button
              className={tab === item ? 'active' : ''}
              key={item}
              onClick={() => setTab(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      )}
      {query.data && org && (
        <>
          {write && tab === 'chart' ? (
            <div className={busy ? 'app-disabled' : ''} aria-busy={busy}>
              <OrganisationChart
                org={org}
                setOrg={(next) => void save(next)}
                employees={rows}
                companyName="Matateni Technologies"
                onManage={setTab}
              />
            </div>
          ) : !write ? (
            <section className="card">
              <h2>Reporting structure</h2>
              {!query.data.employees.length ? (
                <Empty>No employees are linked to your workspace.</Empty>
              ) : (
                <ReadOnlyTree structure={query.data} />
              )}
            </section>
          ) : (
            <section className="card">
              <h2>{tab[0].toUpperCase() + tab.slice(1)}</h2>
              <div className="app-list">
                {query.data[tab as 'branches' | 'departments' | 'positions'].map((item) => (
                  <div key={item.id}>{item.name}</div>
                ))}
              </div>
              <ActionForm
                key={tab}
                title={
                  'Add ' +
                  {
                    chart: 'chart',
                    branches: 'branch',
                    departments: 'department',
                    positions: 'position',
                  }[tab]
                }
                onSave={async (data) => {
                  await api('/organisation/' + tab, 'POST', {
                    name: field(data, 'name'),
                    ...(tab === 'departments'
                      ? { branchId: field(data, 'parent') }
                      : tab === 'positions'
                        ? { departmentId: field(data, 'parent') }
                        : {}),
                  });
                  query.reload();
                }}
              >
                <TextField name="name" label="Name" />
                {tab !== 'branches' && (
                  <label>
                    {tab === 'departments' ? 'Branch' : 'Department'}
                    <select required name="parent">
                      <option value="">Choose…</option>
                      {(tab === 'departments' ? query.data.branches : query.data.departments).map(
                        (item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                )}
              </ActionForm>
            </section>
          )}
        </>
      )}
    </>
  );
}

function ReadOnlyTree({ structure }: { structure: Structure }) {
  const people = structure.employees.filter((e) => e.active),
    ids = new Set(people.map((e) => e.id));
  function node(person: (typeof people)[number], seen: Set<string>): React.ReactNode {
    if (seen.has(person.id)) return null;
    const next = new Set([...seen, person.id]),
      children = people.filter((e) => e.managerId === person.id);
    return (
      <li key={person.id}>
        <article>
          <strong>{person.name}</strong>
          <span>
            {structure.positions.find((p) => p.id === person.positionId)?.name ??
              'Position not assigned'}
          </span>
          <small>{person.number}</small>
        </article>
        {children.length > 0 && <ul>{children.map((child) => node(child, next))}</ul>}
      </li>
    );
  }
  return (
    <div className="app-tree" role="region" aria-label="Organisation reporting chart" tabIndex={0}>
      <article className="app-tree-company">
        <strong>Matateni Technologies</strong>
      </article>
      <ul>
        {people
          .filter((e) => !e.managerId || !ids.has(e.managerId))
          .map((root) => node(root, new Set()))}
      </ul>
    </div>
  );
}
