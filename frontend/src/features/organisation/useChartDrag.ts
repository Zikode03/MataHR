import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { ChartRecord, Org, ChartPlacement } from './types';

import {
  arrangementSnapshot,
  assignPerson,
  CARD_WIDTH,
  chartDropTarget,
  chartLayout,
  chartUndoSnapshot,
  inferChartPosition,
  moveChartPerson,
  placeUnderManager,
  pointerToChart,
  type ChartUndo,
} from './model';
import type { ChartArrangement, ChartPoint } from './types';
export type DragMode = 'Arrange cards' | 'Change manager';
export type PendingPlacement = ChartPlacement;

export type DragVisual = {
  employee: string;
  source: 'card' | 'palette';
  point: ChartPoint;
  target: string | null;
  invalid: string;
  inside: boolean;
  mode: DragMode;
};
// Capture the starting layout once: pointer previews must not mutate the saved organisation.
type Session = {
  employee: string;
  source: 'card' | 'palette';
  mode: DragMode;
  pointer: number;
  element: HTMLElement;
  start: ChartPoint;
  grab: ChartPoint;
  client: ChartPoint;
  base: ChartArrangement;
  org: Org;
  layout: ReturnType<typeof chartLayout>;
  active: boolean;
};
type Options = {
  org: Org;
  employees: ChartRecord[];
  layout: ReturnType<typeof chartLayout>;
  canvas: RefObject<HTMLDivElement | null>;
  zoom: number;
  mode: DragMode;
  moveTeam: boolean;
  snap: boolean;
  onSave: (org: Org, before: ChartUndo) => void;
  onNeedPosition: (value: PendingPlacement) => void;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
};
export function useChartDrag(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const session = useRef<Session | null>(null),
    frame = useRef<number | null>(null),
    suppressUntil = useRef(0);
  const [preview, setPreview] = useState<ChartArrangement | null>(null),
    [visual, setVisual] = useState<DragVisual | null>(null);
  function release() {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    const current = session.current;
    session.current = null;
    if (current?.element.hasPointerCapture(current.pointer))
      current.element.releasePointerCapture(current.pointer);
    setPreview(null);
    setVisual(null);
  }
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      const current = session.current;
      if (current?.element.hasPointerCapture(current.pointer))
        current.element.releasePointerCapture(current.pointer);
    },
    [],
  );
  function location(client: ChartPoint) {
    const { canvas, zoom } = latest.current,
      element = canvas.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      point: pointerToChart(
        client,
        {
          left: rect.left,
          top: rect.top,
          scrollLeft: element.scrollLeft,
          scrollTop: element.scrollTop,
        },
        zoom,
      ),
      inside:
        client.x >= rect.left &&
        client.x <= rect.right &&
        client.y >= rect.top &&
        client.y <= rect.bottom,
    };
  }
  function update() {
    const current = session.current;
    if (!current?.active) return;
    const located = location(current.client);
    if (!located) return;
    const point = {
      x: Math.max(16, located.point.x - current.grab.x),
      y: Math.max(16, located.point.y - current.grab.y),
    };
    const connects = current.mode === 'Change manager' || current.source === 'palette';
    const target =
      located.inside && connects
        ? chartDropTarget(current.layout, located.point, current.employee)
        : null;
    let invalid = '';
    if (target && target !== 'company') {
      try {
        const position =
          current.org.assignments.find((a) => a.employee === current.employee)?.position ??
          inferChartPosition(current.org, latest.current.employees, current.employee);
        if (position)
          assignPerson(current.org, latest.current.employees, current.employee, position, target);
      } catch (problem) {
        invalid = problem instanceof Error ? problem.message : 'Invalid reporting line.';
      }
    }
    if (current.source === 'card' && located.inside) {
      const next = moveChartPerson(
        current.org,
        latest.current.employees,
        current.employee,
        point,
        current.mode === 'Arrange cards' && latest.current.moveTeam,
        latest.current.snap ? 20 : 0,
      );
      setPreview(next.chartLayout!);
    }
    setVisual({
      employee: current.employee,
      source: current.source,
      point,
      target,
      invalid,
      inside: located.inside,
      mode: current.mode,
    });
  }
  function pan() {
    const current = session.current,
      element = latest.current.canvas.current;
    if (!current?.active || !element) return;
    const rect = element.getBoundingClientRect(),
      { x, y } = current.client,
      inside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (inside) {
      const margin = 36,
        speed = 18,
        dx = x < rect.left + margin ? -speed : x > rect.right - margin ? speed : 0,
        dy = y < rect.top + margin ? -speed : y > rect.bottom - margin ? speed : 0;
      if (dx || dy) {
        element.scrollLeft += dx;
        element.scrollTop += dy;
        update();
      }
    }
    frame.current = requestAnimationFrame(pan);
  }
  function start(event: PointerEvent<HTMLElement>, employee: string, source: 'card' | 'palette') {
    if (event.button !== 0 || session.current) return;
    event.stopPropagation();
    const options = latest.current,
      located = location({ x: event.clientX, y: event.clientY }),
      node = options.layout.nodes.find((n) => n.id === employee);
    if (!located || (source === 'card' && !node)) return;
    const base = arrangementSnapshot(options.org, options.employees, options.layout),
      org = { ...options.org, chartLayout: base };
    session.current = {
      employee,
      source,
      mode: options.mode,
      pointer: event.pointerId,
      element: event.currentTarget,
      start: { x: event.clientX, y: event.clientY },
      client: { x: event.clientX, y: event.clientY },
      grab:
        source === 'card'
          ? { x: located.point.x - node!.x, y: located.point.y - node!.y }
          : { x: CARD_WIDTH / 2, y: 35 },
      base,
      org,
      layout: options.layout,
      active: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLElement>) {
    const current = session.current;
    if (!current || current.pointer !== event.pointerId) return;
    event.stopPropagation();
    current.client = { x: event.clientX, y: event.clientY };
    if (
      !current.active &&
      Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) < 5
    )
      return;
    if (!current.active) {
      current.active = true;
      latest.current.onError('');
      frame.current = requestAnimationFrame(pan);
    }
    event.preventDefault();
    suppressUntil.current = Date.now() + 400;
    update();
  }
  function finish(event: PointerEvent<HTMLElement>) {
    const current = session.current;
    if (!current || current.pointer !== event.pointerId) return;
    event.stopPropagation();
    current.client = { x: event.clientX, y: event.clientY };
    if (!current.active) {
      release();
      return;
    }
    event.preventDefault();
    suppressUntil.current = Date.now() + 400;
    const options = latest.current,
      located = location(current.client);
    if (!located?.inside) {
      release();
      options.onMessage('Drop inside the chart to save a placement.');
      return;
    }
    const point = {
        x: Math.max(16, located.point.x - current.grab.x),
        y: Math.max(16, located.point.y - current.grab.y),
      },
      target =
        current.mode === 'Change manager' || current.source === 'palette'
          ? chartDropTarget(current.layout, located.point, current.employee)
          : null;
    try {
      if (current.source === 'card' && current.mode === 'Arrange cards') {
        const next = moveChartPerson(
          current.org,
          options.employees,
          current.employee,
          point,
          options.moveTeam,
          options.snap ? 20 : 0,
        );
        release();
        options.onSave(next, chartUndoSnapshot(options.org));
        options.onMessage('Card position saved. Reporting lines have not changed.');
        return;
      }
      if (current.source === 'card' && !target) {
        release();
        options.onMessage(
          'Drop on a manager card, or on the company header for a top-level reporting line.',
        );
        return;
      }
      const manager = target && target !== 'company' ? target : '';
      const position =
        options.org.assignments.find((a) => a.employee === current.employee)?.position ??
        inferChartPosition(options.org, options.employees, current.employee);
      if (!position) {
        release();
        options.onNeedPosition({
          employee: current.employee,
          manager,
          point,
          base: current.base,
          connect: Boolean(target),
        });
        options.onMessage('Choose this employee’s job position once to finish placing their card.');
        return;
      }
      const assigned = assignPerson(
        current.org,
        options.employees,
        current.employee,
        position,
        manager,
      );
      const next = target
        ? placeUnderManager(assigned, options.employees, current.employee, position, manager)
        : moveChartPerson(
            assigned,
            options.employees,
            current.employee,
            point,
            false,
            options.snap ? 20 : 0,
          );
      release();
      options.onSave(next, chartUndoSnapshot(options.org));
      options.onMessage(
        current.source === 'palette'
          ? 'Employee placed on the chart.'
          : manager
            ? 'Reporting manager changed. The team moved with the employee.'
            : 'Employee moved to the top level.',
      );
    } catch (problem) {
      release();
      options.onError(problem instanceof Error ? problem.message : 'Unable to save this drop.');
    }
  }
  function cancel() {
    if (session.current?.active) {
      suppressUntil.current = Date.now() + 400;
      latest.current.onMessage('Drag cancelled. The chart is unchanged.');
    }
    release();
  }
  return {
    preview,
    visual,
    active: Boolean(visual),
    start,
    move,
    finish,
    cancel,
    consumeClick: () => Date.now() < suppressUntil.current,
  };
}
