import { AlertCircle, ChevronRight, GripVertical, UserPlus } from 'lucide-react';
import type { ChartRecord, Org } from './types';

import { ChartCanvas } from './ChartCanvas';
import { ChartToolbar } from './ChartToolbar';
import { ReportingLineEditor } from './ReportingLineEditor';
import { useOrganisationChart } from './useOrganisationChart';
export function OrganisationChart({
  org,
  setOrg,
  employees,
  companyName = 'Organisation',
  onManage,
}: {
  org: Org;
  setOrg: (value: Org) => void;
  employees: ChartRecord[];
  companyName?: string;
  onManage: (tab: 'departments' | 'positions' | 'branches') => void;
}) {
  const context = useOrganisationChart({ org, setOrg, employees, companyName, onManage });
  const {
    setCollapsed,
    editing,
    message,
    error,
    unplacedQuery,
    setUnplacedQuery,
    cardDrag,
    layout,
    addReport,
    colours,
  } = context;
  return (
    <div className="org-builder">
      <div className="org-builder-heading">
        <div>
          <h2>Organisation chart</h2>
          <p>
            Drag cards into place, draw reporting lines between connector dots, and drag line bends
            to adjust the route.
          </p>
        </div>
        <button className="primary org-action" onClick={() => addReport()}>
          <UserPlus size={16} />
          Add reporting line
        </button>
      </div>
      <div className="org-build-guide">
        <span>
          <b>1</b>Create departments & positions
        </span>
        <ChevronRight size={14} />
        <span>
          <b>2</b>Drag people onto the chart
        </span>
        <ChevronRight size={14} />
        <span>
          <b>3</b>Arrange cards or change managers
        </span>
        <button className="ops-text-button" onClick={() => onManage('positions')}>
          Manage positions →
        </button>
      </div>
      {message && (
        <p className="admin-message" role="status">
          {message}
        </p>
      )}
      {error && !editing && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {layout.issues.length > 0 && (
        <div className="org-chart-warning" role="status">
          <AlertCircle size={17} />
          <div>
            {layout.issues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
            <small>Edit the affected reporting lines to resolve these gaps.</small>
          </div>
        </div>
      )}
      <div className="org-builder-layout">
        <section className="card org-chart-panel">
          <ChartToolbar context={context} />
          <ChartCanvas context={context} />
          <div className="org-chart-footer">
            <span>
              <GripVertical size={13} />
              Drag cards to move them; drag the background to pan. Positions save when you drop. Use
              Fit to see the whole structure.
            </span>
            <button className="ops-text-button" onClick={() => setCollapsed(new Set())}>
              Expand all teams
            </button>
            <button
              className="ops-text-button"
              disabled={layout.filtered}
              onClick={() =>
                setCollapsed(new Set(layout.nodes.filter((n) => n.reports > 0).map((n) => n.id)))
              }
            >
              Collapse teams
            </button>
          </div>
          <div className="org-chart-legend">
            {org.departments
              .filter((d) => layout.nodes.some((n) => n.departmentId === d.id))
              .map((d) => (
                <span key={d.id}>
                  <i
                    style={{
                      background:
                        colours[
                          org.departments.findIndex((row) => row.id === d.id) % colours.length
                        ],
                    }}
                  />
                  {d.name}
                </span>
              ))}
          </div>
        </section>
        <div className="org-builder-bottom">
          <ReportingLineEditor context={context} />
          <section className="card org-chart-unassigned">
            <div className="section-head">
              <h3>Needs placement</h3>
              <span className="record-count">{layout.unassigned.length}</span>
            </div>
            <p className="admin-caption">
              Drag a person onto the canvas or onto a manager. Click for the form alternative.
            </p>
            {layout.unassigned.length > 6 && (
              <label>
                Find unassigned employee
                <input value={unplacedQuery} onChange={(e) => setUnplacedQuery(e.target.value)} />
              </label>
            )}
            <div>
              {layout.unassigned
                .filter((e) =>
                  [e.values[0], e.values[1]]
                    .join(' ')
                    .toLowerCase()
                    .includes(unplacedQuery.toLowerCase()),
                )
                .map((e) => (
                  <button
                    key={e.id}
                    className={cardDrag.visual?.employee === e.id ? 'org-palette-dragging' : ''}
                    aria-label={'Drag ' + e.values[1] + ' onto the chart, or click to place'}
                    onPointerDown={(event) => cardDrag.start(event, e.id, 'palette')}
                    onPointerMove={cardDrag.move}
                    onPointerUp={cardDrag.finish}
                    onPointerCancel={cardDrag.cancel}
                    onLostPointerCapture={cardDrag.cancel}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') cardDrag.cancel();
                    }}
                    onDragStart={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!cardDrag.consumeClick()) addReport('', e.id);
                    }}
                  >
                    <span className="person-initials">
                      {e.values[1]
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <span>
                      <strong>{e.values[1]}</strong>
                      <small>{e.values[3]}</small>
                    </span>
                    <GripVertical size={15} />
                  </button>
                ))}
            </div>
            {!layout.unassigned.length && (
              <p className="org-chart-all-placed">All current employees are placed.</p>
            )}
            <p className="admin-caption">
              Exited employees and future starters are excluded. Saved changes remain available
              during this demo session and reset on reload.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
