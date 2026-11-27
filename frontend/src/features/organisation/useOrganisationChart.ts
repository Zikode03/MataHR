import { useEffect, useRef, useState } from 'react';
import type { ChartRecord, Org } from './types';

import type { ChartUndo } from './model';
import {
  arrangementSnapshot,
  CARD_HEIGHT,
  CARD_WIDTH,
  chartLayout,
  chartSvg,
  chartUndoSnapshot,
  currentPeople,
  descendants,
  eligibleReportingManagers,
  prepareReportingChange,
  moveChartPerson,
  restoreChartEdit,
} from './model';
import { useChartDrag, type DragMode, type PendingPlacement } from './useChartDrag';
import { useChartViewport } from './useChartViewport';

const colours = ['#a34b59', '#587e9d', '#9a8059', '#648879', '#82709a', '#a36e4e'];
type Form = { employee: string; position: string; manager: string };
// This hook coordinates user intent. The model owns chart rules; OrganisationPage owns API writes.
export function useOrganisationChart({
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
  const [query, setQuery] = useState(''),
    [department, setDepartment] = useState(''),
    [branch, setBranch] = useState(''),
    [focus, setFocus] = useState(''),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [view, setView] = useState('Chart'),
    [selected, setSelected] = useState(''),
    [editing, setEditing] = useState(false),
    [addingUnder, setAddingUnder] = useState<string | null>(null),
    [form, setForm] = useState<Form>({ employee: '', position: '', manager: '' }),
    [creatingPosition, setCreatingPosition] = useState(false),
    [removing, setRemoving] = useState(false),
    [replacement, setReplacement] = useState(''),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [unplacedQuery, setUnplacedQuery] = useState('');
  const [dragMode, setDragMode] = useState<DragMode>('Arrange cards'),
    [moveTeam, setMoveTeam] = useState(false),
    [snap, setSnap] = useState(false),
    [undoStack, setUndoStack] = useState<ChartUndo[]>([]),
    [pendingDrop, setPendingDrop] = useState<PendingPlacement | null>(null),
    [viewReset, setViewReset] = useState(0);
  const editor = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const people = currentPeople(employees),
    options = {
      query,
      department,
      branch,
      focus,
      collapsed: view === 'Chart' ? collapsed : new Set<string>(),
    },
    baseLayout = chartLayout(org, employees, options);
  const cardDrag = useChartDrag({
    org,
    employees,
    layout: baseLayout,
    canvas,
    zoom,
    mode: dragMode,
    moveTeam,
    snap,
    onSave: (next, before) => {
      // A whole drag is one undo step, even when it produces many pointer-move events.
      setUndoStack((previous) => [...previous.slice(-19), before]);
      setOrg(next);
      setPendingDrop(null);
      setEditing(false);
      setRemoving(false);
    },
    onNeedPosition: (pending) => {
      addReport(pending.manager, pending.employee);
      setPendingDrop(pending);
    },
    onMessage: setMessage,
    onError: setError,
  });
  const layout = cardDrag.preview
    ? chartLayout({ ...org, chartLayout: cardDrag.preview }, employees, options)
    : baseLayout;
  const ghost =
    cardDrag.visual?.source === 'palette' && cardDrag.visual.inside
      ? { employee: cardDrag.visual.employee, point: cardDrag.visual.point }
      : pendingDrop
        ? { employee: pendingDrop.employee, point: pendingDrop.point }
        : null;
  const ghostPerson = people.find((e) => e.id === ghost?.employee),
    sceneWidth = Math.max(layout.width, ghost ? ghost.point.x + CARD_WIDTH + 36 : 0),
    sceneHeight = Math.max(layout.height, ghost ? ghost.point.y + CARD_HEIGHT + 36 : 0);
  const activeAssignment = org.assignments.find((a) => a.employee === form.employee),
    team = form.employee ? descendants(org.assignments, form.employee) : new Set<string>();
  const managers = eligibleReportingManagers(org, employees, form.employee);
  const offset = 0;
  const { viewport, changeZoom, fit } = useChartViewport({
    canvas,
    layout,
    zoom,
    setZoom,
    active: cardDrag.active,
    view,
    viewReset,
    query,
    department,
    branch,
    focus,
  });
  useEffect(() => {
    if (editing && typeof window !== 'undefined' && window.innerWidth < 1200)
      editor.current?.scrollIntoView({ block: 'start' });
  }, [editing]);
  function selectEmployee(employee: string) {
    if (cardDrag.consumeClick()) return;
    setPendingDrop(null);
    setAddingUnder(null);
    const assignment = org.assignments.find((a) => a.employee === employee);
    setForm({ employee, position: assignment?.position ?? '', manager: assignment?.manager ?? '' });
    setSelected(employee);
    setEditing(true);
    setCreatingPosition(false);
    setRemoving(false);
    setError('');
  }
  function addReport(manager = '', employee = '') {
    setPendingDrop(null);
    setAddingUnder(manager);
    setForm({
      employee,
      position: org.assignments.find((a) => a.employee === employee)?.position ?? '',
      manager,
    });
    setSelected(manager || employee);
    setEditing(true);
    setCreatingPosition(false);
    setRemoving(false);
    setError('');
  }
  function save() {
    // A palette drop may need a position first. Keep its intended placement while the form is open.
    try {
      const next = prepareReportingChange(org, employees, form, pendingDrop, snap);
      setUndoStack((previous) => [...previous.slice(-19), chartUndoSnapshot(org)]);
      setOrg(next);
      setSelected(form.employee);
      setPendingDrop(null);
      setMessage(
        'Reporting line saved. The chart, employee profile and employment history are updated together.',
      );
      setError('');
      setEditing(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to save reporting line.');
    }
  }
  function undo() {
    // Escape an unfinished drag before touching saved reporting relationships.
    if (cardDrag.active) {
      cardDrag.cancel();
      return;
    }
    const previous = undoStack.at(-1);
    if (!previous) return;
    setOrg(restoreChartEdit(org, previous));
    setUndoStack((items) => items.slice(0, -1));
    setPendingDrop(null);
    setEditing(false);
    setMessage('Last chart change undone. The correction is recorded in the session history.');
    setError('');
  }
  function autoArrange() {
    if (cardDrag.active) return;
    setUndoStack((previous) => [...previous.slice(-19), chartUndoSnapshot(org)]);
    setOrg({ ...org, chartLayout: undefined });
    setPendingDrop(null);
    setViewReset((v) => v + 1);
    setMessage('Automatic layout restored. Reporting lines are unchanged.');
  }
  function keyboardMove(event: React.KeyboardEvent<HTMLElement>, employee: string) {
    if (event.key === 'Escape') {
      cardDrag.cancel();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      event.stopPropagation();
      undo();
      return;
    }
    if (
      dragMode !== 'Arrange cards' ||
      !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    )
      return;
    const node = layout.nodes.find((n) => n.id === employee);
    if (!node) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 50 : 10,
      dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
      dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    try {
      if (!event.repeat)
        setUndoStack((previous) => [...previous.slice(-19), chartUndoSnapshot(org)]);
      setOrg(
        moveChartPerson(
          { ...org, chartLayout: arrangementSnapshot(org, employees, layout) },
          employees,
          employee,
          { x: node.x + dx, y: node.y + dy },
          moveTeam,
          snap ? 20 : 0,
        ),
      );
      setMessage('Card position saved. Reporting lines are unchanged.');
      setError('');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to move card.');
    }
  }

  function toggle(id: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function exportChart() {
    const url = URL.createObjectURL(
      new Blob([chartSvg(layout, companyName)], { type: 'image/svg+xml;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'organisation-chart.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clearFilters() {
    setQuery('');
    setDepartment('');
    setBranch('');
    setFocus('');
  }
  return {
    org,
    setOrg,
    employees,
    companyName,
    onManage,
    query,
    setQuery,
    department,
    setDepartment,
    branch,
    setBranch,
    focus,
    setFocus,
    collapsed,
    setCollapsed,
    zoom,
    setZoom,
    view,
    setView,
    selected,
    setSelected,
    editing,
    setEditing,
    addingUnder,
    setAddingUnder,
    form,
    setForm,
    creatingPosition,
    setCreatingPosition,
    removing,
    setRemoving,
    replacement,
    setReplacement,
    message,
    setMessage,
    error,
    setError,
    unplacedQuery,
    setUnplacedQuery,
    viewport,
    dragMode,
    setDragMode,
    moveTeam,
    setMoveTeam,
    snap,
    setSnap,
    undoStack,
    setUndoStack,
    pendingDrop,
    setPendingDrop,
    viewReset,
    setViewReset,
    editor,
    canvas,
    drag,
    people,
    options,
    baseLayout,
    cardDrag,
    layout,
    ghost,
    ghostPerson,
    sceneWidth,
    sceneHeight,
    activeAssignment,
    team,
    managers,
    offset,
    selectEmployee,
    addReport,
    save,
    undo,
    autoArrange,
    changeZoom,
    keyboardMove,
    fit,
    toggle,
    exportChart,
    clearFilters,
    colours,
  };
}
export type OrganisationChartContext = ReturnType<typeof useOrganisationChart>;
