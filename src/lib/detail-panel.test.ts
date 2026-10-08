import { describe, expect, it } from 'vitest';
import { createLatestQueue, detailBounds, isCurrentDetailInteraction } from './detail-panel';
import { contains, stripRect, type Edge } from './dock';

const area = { x: -1920, y: -100, w: 1920, h: 900 };

describe('independent detail window', () => {
  it.each(['top', 'bottom', 'left', 'right'] as Edge[])('fits the panel inside the monitor on %s without changing the strip', (edge) => {
    const vertical = edge === 'left' || edge === 'right';
    for (const offset of [0, 0.5, 1]) {
      const strip = stripRect(area, edge, offset, vertical ? 80 : 400, vertical ? 400 : 80);
      const original = { ...strip };
      const anchor = vertical ? strip.y + 40 : strip.x + 40;
      for (const height of [100, 300, 1800]) {
        const rect = detailBounds({ area, strip, edge, anchor, width: 300, maxHeight: 480 }, height);
        expect(contains(area, rect.x, rect.y)).toBe(true);
        expect(rect.x + rect.w).toBeLessThanOrEqual(area.x + area.w);
        expect(rect.y + rect.h).toBeLessThanOrEqual(area.y + area.h);
        expect(strip).toEqual(original);
      }
    }
  });

  it('ignores late enter/leave/actions from a closed or replaced provider session', () => {
    const state = { revision: 42, report: { id: 'claude' as const } };
    for (const kind of ['enter', 'leave', 'hide'] as const) {
      expect(isCurrentDetailInteraction(null, { revision: 42, provider: 'claude', kind })).toBe(false);
      expect(isCurrentDetailInteraction(state, { revision: 41, provider: 'claude', kind })).toBe(false);
      expect(isCurrentDetailInteraction(state, { revision: 42, provider: 'codex', kind })).toBe(false);
      expect(isCurrentDetailInteraction(state, { revision: 42, provider: 'claude', kind })).toBe(true);
    }
  });

  it('serializes work and skips superseded pending layouts', async () => {
    const queue = createLatestQueue();
    const calls: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const first = queue(async (current: () => boolean) => {
      calls.push('first:start');
      await blocked;
      if (current()) calls.push('first:show');
    });
    // Allow the first job to start before replacing it.
    await Promise.resolve();
    const stale = queue(async () => { calls.push('stale'); });
    const latest = queue(async () => { calls.push('latest'); });
    release();
    await Promise.all([first, stale, latest]);
    expect(calls).toEqual(['first:start', 'latest']);
  });

  it('invalidates an opening layout before hiding and recovers after errors', async () => {
    const queue = createLatestQueue();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    let shown = false;
    const opening = queue(async (current: () => boolean) => {
      await blocked;
      if (current()) shown = true;
    });
    await Promise.resolve();
    const hide = queue(async () => { shown = false; });
    release();
    await Promise.all([opening, hide]);
    expect(shown).toBe(false);
    await expect(queue(async () => { throw new Error('native failure'); })).rejects.toThrow('native failure');
    await queue(async () => { shown = true; });
    expect(shown).toBe(true);
  });
});
