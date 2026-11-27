import { Building2, Network } from 'lucide-react';
import { ChartConnections } from './ChartConnections';
import { ChartEmployeeCards } from './ChartEmployeeCards';

import { Empty } from '../../shared/ui';
import { CARD_HEIGHT, CARD_WIDTH, chartUndoSnapshot } from './model';

import type { OrganisationChartContext } from './useOrganisationChart';
export function ChartCanvas({
  context,
}: {
  context: Pick<
    OrganisationChartContext,
    | 'org'
    | 'setOrg'
    | 'employees'
    | 'companyName'
    | 'zoom'
    | 'view'
    | 'setMessage'
    | 'setError'
    | 'viewport'
    | 'dragMode'
    | 'setUndoStack'
    | 'pendingDrop'
    | 'canvas'
    | 'drag'
    | 'people'
    | 'cardDrag'
    | 'layout'
    | 'ghost'
    | 'ghostPerson'
    | 'sceneWidth'
    | 'sceneHeight'
    | 'offset'
    | 'selectEmployee'
    | 'addReport'
    | 'undo'
    | 'clearFilters'
    | 'toggle'
    | 'collapsed'
    | 'selected'
    | 'keyboardMove'
    | 'colours'
  >;
}) {
  const {
    org,
    setOrg,
    employees,
    companyName,
    zoom,
    view,
    setMessage,
    setError,
    viewport,
    dragMode,
    setUndoStack,
    pendingDrop,
    canvas,
    drag,
    people,
    cardDrag,
    layout,
    ghost,
    ghostPerson,
    sceneWidth,
    sceneHeight,
    offset,
    selectEmployee,
    addReport,
    undo,
    clearFilters,
  } = context;
  return (
    <>
      {' '}
      {view === 'Chart' ? (
        <div
          className={
            'org-chart-canvas ' +
            (drag.current ? 'is-panning ' : '') +
            (cardDrag.active ? 'has-card-drag ' : '') +
            (dragMode === 'Change manager' ? 'connect-mode' : '')
          }
          ref={canvas}
          tabIndex={0}
          role="region"
          aria-label="Organisation chart canvas. Drag employee cards to arrange them; use Change manager mode to reconnect reporting lines."
          onKeyDown={(e) => {
            if (e.key === 'Escape') cardDrag.cancel();
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
              e.preventDefault();
              undo();
            }
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || (e.target as HTMLElement).closest('button,a,input,select'))
              return;
            const element = canvas.current!;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: element.scrollLeft,
              top: element.scrollTop,
            };
            element.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current || !canvas.current) return;
            canvas.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
            canvas.current.scrollTop = drag.current.top - (e.clientY - drag.current.y);
          }}
          onPointerUp={(e) => {
            drag.current = null;
            if (canvas.current?.hasPointerCapture(e.pointerId))
              canvas.current.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          {cardDrag.visual && (
            <div
              className={'org-drag-status ' + (cardDrag.visual.invalid ? 'invalid' : '')}
              style={{
                left: (canvas.current?.scrollLeft ?? 0) + 12,
                top: (canvas.current?.scrollTop ?? 0) + 12,
              }}
              role="status"
            >
              {cardDrag.visual.invalid ||
                (!cardDrag.visual.inside
                  ? 'Drop inside the chart'
                  : cardDrag.visual.target === 'company'
                    ? 'Release to place at top level'
                    : cardDrag.visual.target
                      ? 'Release to report to ' +
                        people.find((e) => e.id === cardDrag.visual!.target)?.values[1]
                      : cardDrag.visual.mode === 'Change manager' &&
                          cardDrag.visual.source === 'card'
                        ? 'Drop onto a manager card or the company header'
                        : cardDrag.visual.source === 'palette'
                          ? 'Release to place this employee here'
                          : 'Release to save this position')}
            </div>
          )}
          {layout.nodes.length || ghost ? (
            <div
              className="org-chart-sizer"
              style={{
                width: Math.max(viewport.width, sceneWidth * zoom),
                height: Math.max(viewport.height, sceneHeight * zoom),
              }}
            >
              <div
                className="org-chart-surface"
                style={{
                  width: sceneWidth,
                  height: sceneHeight,
                  left: offset,
                  transform: `scale(${zoom})`,
                }}
              >
                <ChartConnections
                  org={org}
                  employees={employees}
                  layout={layout}
                  canvas={canvas}
                  zoom={zoom}
                  width={sceneWidth}
                  height={sceneHeight}
                  onSave={(next) => {
                    setUndoStack((previous) => [...previous.slice(-19), chartUndoSnapshot(org)]);
                    setOrg(next);
                    setError('');
                  }}
                  onMessage={setMessage}
                  onError={setError}
                />
                <div
                  className={
                    'org-chart-company ' +
                    (cardDrag.visual?.target === 'company' ? 'drop-ready' : '')
                  }
                  style={{
                    left: layout.company.x,
                    top: layout.company.y,
                    width: layout.company.width,
                    height: layout.company.height,
                  }}
                >
                  <Building2 size={24} />
                  <div>
                    <strong title={companyName}>{companyName}</strong>
                    <small>Organisational structure</small>
                  </div>
                </div>
                <ChartEmployeeCards context={context} />
                {ghost && ghostPerson && (
                  <div
                    className={
                      'org-chart-person org-drag-ghost ' + (pendingDrop ? 'needs-position' : '')
                    }
                    style={{
                      left: ghost.point.x,
                      top: ghost.point.y,
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                    }}
                  >
                    <span className="org-chart-initials">
                      {ghostPerson.values[1]
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <strong>{ghostPerson.values[1]}</strong>
                    <span>{ghostPerson.values[3]}</span>
                    <small>
                      {pendingDrop
                        ? 'Choose a job position to finish placement'
                        : cardDrag.visual?.target === 'company'
                          ? 'Drop to place at top level'
                          : cardDrag.visual?.target
                            ? 'Drop to connect to this manager'
                            : 'Drop here to place at top level'}
                    </small>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="org-chart-empty">
              <Network size={38} />
              <h3>
                {layout.total
                  ? 'No employees match these filters'
                  : 'Start your organisation chart'}
              </h3>
              <p>
                {layout.total
                  ? 'Clear the filters to see the full reporting structure.'
                  : 'Drag an employee from Needs placement onto this canvas to begin.'}
              </p>
              <button
                className="secondary"
                onClick={layout.total ? clearFilters : () => addReport()}
              >
                {layout.total ? 'Clear filters' : 'Place first employee'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="table-wrap org-chart-list">
          <table>
            <thead>
              <tr>
                <th>Employee / role</th>
                <th>Department</th>
                <th>Reports to</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {layout.nodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <strong>{node.name}</strong>
                    <small>
                      {node.title} · {node.number}
                    </small>
                  </td>
                  <td>{node.department}</td>
                  <td>
                    {node.needsManager
                      ? 'Manager needs review'
                      : (people.find((e) => e.id === node.manager)?.values[1] ?? 'Top level')}
                  </td>
                  <td>
                    <button className="secondary" onClick={() => selectEmployee(node.id)}>
                      Edit reporting line
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!layout.nodes.length && <Empty>No employees in this view.</Empty>}
        </div>
      )}
    </>
  );
}
