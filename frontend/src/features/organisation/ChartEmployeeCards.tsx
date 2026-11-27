import { AlertCircle, ChevronDown, ChevronRight, GripVertical, Plus } from 'lucide-react';

import { CARD_HEIGHT, CARD_WIDTH } from './model';

import type { OrganisationChartContext } from './useOrganisationChart';
export function ChartEmployeeCards({
  context,
}: {
  context: Pick<
    OrganisationChartContext,
    | 'org'
    | 'layout'
    | 'selected'
    | 'cardDrag'
    | 'collapsed'
    | 'keyboardMove'
    | 'selectEmployee'
    | 'toggle'
    | 'addReport'
    | 'colours'
  >;
}) {
  const {
    org,
    layout,
    selected,
    cardDrag,
    collapsed,
    keyboardMove,
    selectEmployee,
    toggle,
    addReport,
    colours,
  } = context;
  return (
    <>
      {layout.nodes.map((node) => {
        const colour =
          colours[
            Math.max(
              0,
              org.departments.findIndex((d) => d.id === node.departmentId),
            ) % colours.length
          ];
        return (
          <article
            key={node.id}
            className={
              'org-chart-person ' +
              (selected === node.id ? 'selected ' : '') +
              (node.context ? 'management-context ' : '') +
              (node.needsManager ? 'needs-manager ' : '') +
              (cardDrag.visual?.employee === node.id ? 'being-dragged ' : '') +
              (cardDrag.visual?.target === node.id
                ? cardDrag.visual.invalid
                  ? 'drop-invalid'
                  : 'drop-ready'
                : '')
            }
            style={{
              left: node.x,
              top: node.y,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderTopColor: colour,
            }}
          >
            <button
              className="org-chart-person-main"
              aria-label={`${node.name}, ${node.title}, ${node.department}. Drag to move; click to edit reporting line.`}
              aria-describedby="org-drag-help"
              onPointerDown={(e) => cardDrag.start(e, node.id, 'card')}
              onPointerMove={cardDrag.move}
              onPointerUp={cardDrag.finish}
              onPointerCancel={cardDrag.cancel}
              onLostPointerCapture={cardDrag.cancel}
              onKeyDown={(e) => keyboardMove(e, node.id)}
              onDragStart={(e) => e.preventDefault()}
              onClick={() => selectEmployee(node.id)}
            >
              <span
                className="org-chart-initials"
                style={{ color: colour, background: colour + '15' }}
              >
                {node.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span>
                <strong title={node.name}>{node.name}</strong>
                <span title={node.title}>{node.title}</span>
                <small style={{ color: colour }}>{node.department}</small>
              </span>
              <GripVertical className="org-card-grip" size={15} aria-hidden="true" />
            </button>
            <div className="org-chart-person-meta">
              <span>{node.context ? 'Management context' : node.branch}</span>
              {node.needsManager && (
                <span className="org-chart-gap" title="Reporting manager needs review">
                  <AlertCircle size={12} />
                  Check manager
                </span>
              )}
            </div>
            <div className="org-chart-person-footer">
              <button
                disabled={!node.reports || layout.filtered || cardDrag.active}
                aria-expanded={!collapsed.has(node.id)}
                aria-label={`${collapsed.has(node.id) ? 'Expand' : 'Collapse'} ${node.name}'s ${node.reports} direct reports`}
                onClick={() => toggle(node.id)}
              >
                {node.reports > 0 &&
                  (collapsed.has(node.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />)}
                {node.reports} direct {node.reports === 1 ? 'report' : 'reports'}
              </button>
              <button
                aria-label={'Add a direct report to ' + node.name}
                onClick={() => addReport(node.id)}
              >
                <Plus size={13} />
                Add report
              </button>
            </div>
          </article>
        );
      })}
    </>
  );
}
