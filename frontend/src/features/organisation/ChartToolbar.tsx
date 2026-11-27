import {
  Download,
  GitBranch,
  LayoutGrid,
  List,
  Maximize2,
  Minus,
  Move,
  Network,
  Plus,
  Search,
  Undo2,
} from 'lucide-react';

import type { OrganisationChartContext } from './useOrganisationChart';
export function ChartToolbar({
  context,
}: {
  context: Pick<
    OrganisationChartContext,
    | 'org'
    | 'query'
    | 'setQuery'
    | 'department'
    | 'setDepartment'
    | 'branch'
    | 'setBranch'
    | 'focus'
    | 'zoom'
    | 'view'
    | 'setView'
    | 'setError'
    | 'dragMode'
    | 'setDragMode'
    | 'moveTeam'
    | 'setMoveTeam'
    | 'snap'
    | 'setSnap'
    | 'undoStack'
    | 'setPendingDrop'
    | 'people'
    | 'cardDrag'
    | 'layout'
    | 'undo'
    | 'autoArrange'
    | 'changeZoom'
    | 'fit'
    | 'exportChart'
    | 'clearFilters'
  >;
}) {
  const {
    org,
    query,
    setQuery,
    department,
    setDepartment,
    branch,
    setBranch,
    focus,
    zoom,
    view,
    setView,
    setError,
    dragMode,
    setDragMode,
    moveTeam,
    setMoveTeam,
    snap,
    setSnap,
    undoStack,
    setPendingDrop,
    people,
    cardDrag,
    layout,
    undo,
    autoArrange,
    changeZoom,
    fit,
    exportChart,
    clearFilters,
  } = context;
  return (
    <>
      {' '}
      <div className="org-chart-filters">
        <label>
          <span>
            <Search size={13} />
            Find employee or role
          </span>
          <input
            value={query}
            disabled={cardDrag.active}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, employee number or role"
          />
        </label>
        <label>
          Department
          <select
            value={department}
            disabled={cardDrag.active}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {org.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Branch
          <select
            value={branch}
            disabled={cardDrag.active}
            onChange={(e) => setBranch(e.target.value)}
          >
            <option value="">All branches</option>
            {org.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="org-chart-toolbar">
        <div className="org-chart-view-switch">
          {[
            { name: 'Chart', icon: Network },
            { name: 'List', icon: List },
          ].map((v) => (
            <button
              key={v.name}
              className={view === v.name ? 'active' : ''}
              aria-pressed={view === v.name}
              disabled={cardDrag.active}
              onClick={() => setView(v.name)}
            >
              <v.icon size={15} />
              {v.name}
            </button>
          ))}
        </div>
        {view === 'Chart' && (
          <div className="org-chart-zoom">
            <button
              aria-label="Zoom out"
              disabled={zoom <= 0.25}
              onClick={() => changeZoom(zoom - 0.1)}
            >
              <Minus size={14} />
            </button>
            <button aria-label="Reset zoom to 100 percent" onClick={() => changeZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button
              aria-label="Zoom in"
              disabled={zoom >= 1.5}
              onClick={() => changeZoom(zoom + 0.1)}
            >
              <Plus size={14} />
            </button>
            <button className="org-fit" onClick={fit}>
              <Maximize2 size={14} />
              Fit
            </button>
          </div>
        )}
        <button
          className="secondary org-action"
          disabled={!layout.nodes.length || cardDrag.active}
          onClick={exportChart}
        >
          <Download size={14} />
          Export SVG
        </button>
      </div>
      {view === 'Chart' && (
        <div className="org-drag-tools">
          <div className="org-drag-modes" aria-label="Drag action">
            {(
              [
                { name: 'Arrange cards', icon: Move },
                { name: 'Change manager', icon: GitBranch },
              ] as const
            ).map((mode) => (
              <button
                key={mode.name}
                disabled={cardDrag.active}
                className={dragMode === mode.name ? 'active' : ''}
                aria-pressed={dragMode === mode.name}
                onClick={() => {
                  setDragMode(mode.name);
                  setPendingDrop(null);
                  setError('');
                }}
              >
                <mode.icon size={14} />
                {mode.name}
              </button>
            ))}
          </div>
          <button
            className="secondary org-action"
            disabled={!undoStack.length || cardDrag.active}
            onClick={undo}
          >
            <Undo2 size={13} />
            Undo
          </button>
          <button
            className="secondary org-action"
            disabled={!org.chartLayout || cardDrag.active}
            onClick={autoArrange}
          >
            <LayoutGrid size={13} />
            Auto-arrange
          </button>
          <div className="org-drag-options">
            {dragMode === 'Arrange cards' && (
              <label>
                <input
                  type="checkbox"
                  checked={moveTeam}
                  disabled={cardDrag.active}
                  onChange={(e) => setMoveTeam(e.target.checked)}
                />
                Move whole team
              </label>
            )}
            <label>
              <input
                type="checkbox"
                checked={snap}
                disabled={cardDrag.active}
                onChange={(e) => setSnap(e.target.checked)}
              />
              Snap to grid
            </label>
          </div>
          <p id="org-drag-help">
            {dragMode === 'Arrange cards'
              ? 'Drag a card by its name or grip and drop it anywhere. Click to edit; arrow keys move a focused card.'
              : 'Drag a card onto its new manager. Drop on the company header to make it top level.'}{' '}
            Escape cancels a drag.
          </p>
        </div>
      )}
      <div className="org-chart-scope">
        <span>
          {layout.nodes.length} shown · {layout.total} placed employees ·{' '}
          {org.chartLayout ? 'Manual arrangement' : 'Automatic arrangement'}
          {layout.filtered ? ' · Managers retained for context' : ''}
        </span>
        {(layout.filtered || focus) && (
          <button className="ops-text-button" onClick={clearFilters}>
            Show full organisation
          </button>
        )}
        {focus && (
          <small>
            Focused team: {people.find((e) => e.id === focus)?.values[1]} and its management chain
          </small>
        )}
      </div>
    </>
  );
}
