import { panelRect, type Edge, type Rect } from './dock';
import type { UsageReport } from './types';

export const DETAIL_WINDOW = 'detail';
export const DETAIL_EVENTS = {
  state: 'detail-state',
  ready: 'detail-ready',
  requestReady: 'detail-request-ready',
  interaction: 'detail-interaction',
  widgetHidden: 'widget-hidden',
  dismiss: 'detail-dismiss',
} as const;

export interface DetailPlacement {
  area: Rect;
  strip: Rect;
  edge: Edge;
  anchor: number;
  width: number;
  maxHeight: number;
}

/** Only display data crosses into the detail webview, never provider configuration or secrets. */
export interface DetailState extends DetailPlacement {
  revision: number;
  report: UsageReport;
  scaleFactor: number;
  orbSize: number;
  opacity: number;
  colors: [string, string, string];
  updatedAt: number | null;
  refreshMinutes: number;
  error: string | null;
}

export interface DetailInteraction {
  revision: number;
  provider: string;
  kind: 'enter' | 'leave' | 'hide';
}

export function isCurrentDetailInteraction(
  state: { revision: number; report: Pick<UsageReport, 'id'> } | null,
  event: DetailInteraction,
): boolean {
  return !!state && state.revision === event.revision && state.report.id === event.provider;
}

export function detailBounds(placement: DetailPlacement, measuredHeight: number): Rect {
  const h = Math.max(1, Math.min(Math.ceil(measuredHeight), placement.maxHeight));
  return panelRect(placement.area, placement.edge, placement.strip, placement.anchor, placement.width, h);
}

/** Serializes native mutations; pending stale jobs are skipped and active jobs can check after every await. */
export function createLatestQueue() {
  let revision = 0;
  let tail: Promise<void> = Promise.resolve();
  return (job: (isCurrent: () => boolean) => Promise<void>): Promise<void> => {
    const own = ++revision;
    const current = () => own === revision;
    const result = tail.then(async () => {
      if (current()) await job(current);
    });
    tail = result.catch(() => {});
    return result;
  };
}
