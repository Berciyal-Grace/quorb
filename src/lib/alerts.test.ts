import { describe, expect, it } from 'vitest';
import { detectAlerts, effectFor, notificationText } from './alerts';
import { meterPace, paceOf, spendPace } from './pace';
import type { UsageReport } from './types';

const cfg = { threshold: 90, onReset: true };
const rep = (pct: number, resetsAt = '2026-10-06T15:00:00Z', extra: Partial<UsageReport> = {}): UsageReport => ({
  id: 'claude',
  name: 'Claude',
  kind: 'subscription',
  status: 'ok',
  plan: 'Max',
  meters: [{ label: 'Sesión · 5 h', percent: pct, used: null, limit: null, unit: null, resetsAt, windowSeconds: 18000 }],
  spend: null,
  message: null,
  action: null,
  fetchedAt: '',
  ...extra,
});
const NOW = Date.parse('2026-10-06T12:00:00Z');

describe('alerts', () => {
  it('warns once per window when the limit is exceeded', () => {
    let r = detectAlerts([], [rep(85)], {}, cfg, NOW);
    expect(r.events).toHaveLength(0);
    r = detectAlerts([rep(85)], [rep(91)], r.memory, cfg, NOW);
    expect(r.events.map((e) => e.kind).join()).toBe('exceeded');
    r = detectAlerts([rep(91)], [rep(99)], r.memory, cfg, NOW);
    expect(r.events).toHaveLength(0);
  });

  it('warns again in the next window', () => {
    const first = detectAlerts([], [rep(95)], {}, cfg, NOW);
    const next = detectAlerts([rep(95)], [rep(93, '2026-10-06T20:00:00Z')], first.memory, cfg, NOW);
    expect(next.events.map((e) => e.kind).join()).toBe('exceeded');
  });

  it('detects the reset of an exceeded limit', () => {
    const r = detectAlerts([rep(95)], [rep(3, '2026-10-06T20:00:00Z')], {}, cfg, NOW);
    expect(r.events.map((e) => e.kind).join()).toBe('reset');
    // no avisa de reinicios de límites que no se habían superado
    expect(detectAlerts([rep(60)], [rep(3, '2026-10-06T20:00:00Z')], {}, cfg, NOW).events).toHaveLength(0);
    expect(detectAlerts([rep(95)], [rep(3, '2026-10-06T20:00:00Z')], {}, { ...cfg, onReset: false }, NOW).events).toHaveLength(0);
  });

  it('ignores stale or failed reports', () => {
    expect(detectAlerts([], [rep(99, undefined, { stale: true })], {}, cfg, NOW).events).toHaveLength(0);
    expect(detectAlerts([], [rep(99, undefined, { status: 'error' })], {}, cfg, NOW).events).toHaveLength(0);
  });

  it('picks the effect and moment', () => {
    const fx = { exceededEffect: 'glow', resetEffect: 'custom' } as const;
    const exceeded = detectAlerts([], [rep(99)], {}, cfg, NOW).events;
    expect(effectFor(exceeded, fx)?.effect).toBe('glow');
    expect(effectFor(exceeded, fx)?.moment).toBe('exceeded');
    const reset = detectAlerts([rep(95)], [rep(3, '2026-10-06T20:00:00Z')], {}, cfg, NOW).events;
    expect(effectFor(reset, fx)?.moment).toBe('reset');
    expect(effectFor([], fx)).toBeNull();
    expect(notificationText(exceeded)?.title).toBe('Límite superado');
    expect(notificationText(reset)?.title).toBe('Límite reiniciado');
  });
});

describe('pace', () => {
  it('computes ratio, projection and exhaustion', () => {
    // 50 % gastado con el 25 % del tiempo → ritmo 2×, se agota a mitad de ventana
    const p = paceOf(0.5, 0, 100, 25);
    expect(p.ratio).toBe(2);
    expect(p.projected).toBe(200);
    expect(p.exhaustAt?.getTime()).toBe(50);
    expect(p.status).toBe('over');
    expect(paceOf(0.2, 0, 100, 50).status).toBe('ok');
  });

  it('uses the meter window', () => {
    // reinicio a las 15:00, ventana 5 h → empezó a las 10:00; ahora 12:00 = 40 %
    const p = meterPace(rep(20).meters[0], NOW)!;
    expect(p.elapsed).toBe(0.4);
    expect(p.status).toBe('ok');
  });

  it('projects monthly spend', () => {
    const mid = Date.UTC(2026, 9, 16, 12); // 15,5 de 31 días = mitad de mes
    const p = spendPace({ amount: 30, currency: 'USD', periodLabel: '', budget: 50 }, mid)!;
    expect(Math.round(p.projectedAmount!)).toBe(60);
    expect(p.status).toBe('over');
  });
});
