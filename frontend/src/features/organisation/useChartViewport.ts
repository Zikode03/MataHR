import { useEffect, useState, type RefObject, type Dispatch, type SetStateAction } from 'react';
import { CARD_WIDTH, type chartLayout } from './model';

type Options = {
  canvas: RefObject<HTMLDivElement | null>;
  layout: ReturnType<typeof chartLayout>;
  zoom: number;
  setZoom: Dispatch<SetStateAction<number>>;
  active: boolean;
  view: string;
  viewReset: number;
  query: string;
  department: string;
  branch: string;
  focus: string;
};

// Browser measurements belong here so chart rules can be tested without a DOM.
export function useChartViewport({
  canvas,
  layout,
  zoom,
  setZoom,
  active,
  view,
  viewReset,
  query,
  department,
  branch,
  focus,
}: Options) {
  const [viewport, setViewport] = useState({ width: 800, height: 580 });
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    if (typeof ResizeObserver === 'undefined') {
      setViewport({ width: element.clientWidth, height: element.clientHeight });
      return;
    }
    const observer = new ResizeObserver(() =>
      setViewport({ width: element.clientWidth, height: element.clientHeight }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [view]);
  useEffect(() => {
    if (!canvas.current || active) return;
    const node =
        query || department || branch || focus ? layout.nodes.find((n) => !n.context) : null,
      x = node ? node.x + CARD_WIDTH / 2 : layout.company.x + layout.company.width / 2;
    canvas.current.scrollLeft = Math.max(0, x * zoom - viewport.width / 2);
    canvas.current.scrollTop = node ? Math.max(0, node.y * zoom - 100) : 0;
  }, [viewReset, viewport.width, focus, department, branch, query, view]);

  // Keep the point under the viewport centre in place when zoom changes.
  function changeZoom(next: number) {
    if (active) return;
    const value = Math.max(0.25, Math.min(1.5, next)),
      element = canvas.current;
    if (element) {
      const x = (element.scrollLeft + viewport.width / 2) / zoom,
        y = (element.scrollTop + viewport.height / 2) / zoom;
      setZoom(value);
      requestAnimationFrame(() => {
        element.scrollLeft = x * value - viewport.width / 2;
        element.scrollTop = y * value - viewport.height / 2;
      });
    } else setZoom(value);
  }
  function fit() {
    if (active) return;
    setZoom(
      Math.max(
        0.25,
        Math.min(1, (viewport.width - 32) / layout.width, (viewport.height - 32) / layout.height),
      ),
    );
    canvas.current?.scrollTo({ left: 0, top: 0 });
  }

  return { viewport, changeZoom, fit };
}
