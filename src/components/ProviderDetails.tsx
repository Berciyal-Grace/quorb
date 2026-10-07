import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { formatCompact, formatMoney, formatResetIn, shortLabel } from '../lib/format';
import { meterPace, spendPace, type Pace } from '../lib/pace';
import type { Sample, UsageReport } from '../lib/types';
import { RING_COLORS } from './RingGauge';

const RANGES = [
  { hours: 24, label: '24 h' },
  { hours: 24 * 7, label: '7 días' },
  { hours: 24 * 30, label: '30 días' },
] as const;

function untilText(d: Date): string {
  return formatResetIn(d.toISOString()) ?? '';
}

function paceText(p: Pace): string {
  if (p.ratio == null) return 'Acaba de empezar la ventana';
  const r = p.ratio.toLocaleString('es-ES', { maximumFractionDigits: 1 });
  if (p.status === 'over' && p.exhaustAt) return `Ritmo ${r}× · se agota ${untilText(p.exhaustAt)}`;
  if (p.status === 'over') return `Ritmo ${r}× · no llegas al reinicio`;
  if (p.status === 'fast') return `Ritmo ${r}× · acabarías en ${Math.round(p.projected ?? 0)} %`;
  return `Ritmo ${r}× · acabarías en ${Math.round(p.projected ?? 0)} %`;
}

/** Barra de ritmo: relleno = consumido; marca vertical = tiempo transcurrido. */
function PaceBar({ pace, color }: { pace: Pace; color: string }) {
  return (
    <span className="pace__track" data-status={pace.status}>
      <span className="pace__fill" style={{ width: `${Math.min(100, pace.used * 100)}%`, background: color }} />
      <span className="pace__now" style={{ left: `${pace.elapsed * 100}%` }} title="Tiempo transcurrido de la ventana" />
    </span>
  );
}

function Sparkline({ series, max, height = 46 }: { series: { color: string; points: [number, number][] }[]; max: number; height?: number }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return <p className="hist__empty">Aún no hay suficientes lecturas. Se irán guardando cada pocos minutos.</p>;
  const t0 = Math.min(...all.map((p) => p[0]));
  const t1 = Math.max(...all.map((p) => p[0]));
  const W = 100;
  const x = (t: number) => (t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * W);
  const y = (v: number) => height - 2 - (Math.min(v, max) / max) * (height - 4);
  return (
    <svg className="hist__svg" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label="Historial de consumo">
      {[0.5, 1].map((g) => (
        <line key={g} x1="0" x2={W} y1={y(max * g)} y2={y(max * g)} className="hist__grid" />
      ))}
      {series.map((s, i) => (
        <polyline
          key={i}
          fill="none"
          stroke={s.color}
          strokeWidth="1.6"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          points={s.points.map(([t, v]) => `${x(t).toFixed(2)},${y(v).toFixed(2)}`).join(' ')}
        />
      ))}
    </svg>
  );
}

/** Barras de tokens por día (datos del propio proveedor, p. ej. NaN). */
function DailyBars({ days }: { days: { date: string; value: number }[] }) {
  const last = days.slice(-30);
  const max = Math.max(...last.map((d) => d.value), 1);
  const H = 40;
  const bw = 100 / last.length;
  const fmtDay = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return (
    <div className="daily">
      <svg className="hist__svg" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label="Tokens por día">
        {last.map((d, i) => {
          const h = Math.max(0.6, (d.value / max) * (H - 2));
          return (
            <rect key={d.date} x={i * bw + bw * 0.15} y={H - h} width={bw * 0.7} height={h} rx="0.6" fill="var(--ring-1)">
              <title>{`${fmtDay(d.date)}: ${formatCompact(d.value)} tokens`}</title>
            </rect>
          );
        })}
      </svg>
      <span className="daily__axis">
        <span>{fmtDay(last[0].date)}</span>
        <span>máx. {formatCompact(max)}</span>
        <span>{fmtDay(last[last.length - 1].date)}</span>
      </span>
    </div>
  );
}

export function ProviderDetails({ report }: { report: UsageReport }) {
  const [hours, setHours] = useState<number>(24 * 7);
  const [samples, setSamples] = useState<Sample[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getHistory(report.id, hours)
      .then((s) => alive && setSamples(s))
      .catch(() => alive && setSamples([]));
    return () => {
      alive = false;
    };
  }, [report.id, hours, report.fetchedAt]);

  const ringMeters = report.meters.filter((m) => m.percent != null);
  const paces = ringMeters.map((m, i) => ({ m, color: RING_COLORS[i] ?? 'var(--text-2)', pace: meterPace(m) }));
  const sp = report.spend ? spendPace(report.spend) : null;

  const series = useMemo(() => {
    if (!samples) return { pct: [], spend: [] as [number, number][] };
    const pct = ringMeters.slice(0, 3).map((m, i) => ({
      color: RING_COLORS[i],
      points: samples.filter((s) => s.l === m.label).map((s) => [s.t, s.v] as [number, number]),
    }));
    const spend = samples.filter((s) => s.l === 'spend').map((s) => [s.t, s.v] as [number, number]);
    return { pct, spend };
  }, [samples, report.meters]);

  // Escala del eje: no aplastamos consumos pequeños contra el 0.
  const peakPct = Math.max(0, ...series.pct.flatMap((s) => s.points.map((p) => p[1])));
  const pctMax = Math.min(100, Math.max(10, Math.ceil((peakPct * 1.15) / 5) * 5));
  const spendMax = Math.max(report.spend?.budget ?? 0, ...series.spend.map((p) => p[1]), 1);

  return (
    <div className="details">
      <section className="details__sec">
        <h3 className="details__title">Ritmo de consumo</h3>
        {paces.filter((p) => p.pace).length === 0 && !sp && <p className="hist__empty">Sin ventana de tiempo conocida para calcular el ritmo.</p>}
        {paces.map(
          ({ m, color, pace }) =>
            pace && (
              <div key={m.label} className="pace" data-status={pace.status}>
                <span className="pace__row">
                  <span className="pace__label">{shortLabel(m.label)}</span>
                  <span className="pace__txt">{paceText(pace)}</span>
                </span>
                <PaceBar pace={pace} color={color} />
              </div>
            ),
        )}
        {sp && report.spend && (
          <div className="pace" data-status={sp.status}>
            <span className="pace__row">
              <span className="pace__label">Gasto</span>
              <span className="pace__txt">
                {sp.projectedAmount != null
                  ? `Al ritmo actual: ${formatMoney(sp.projectedAmount, report.spend.currency)} a fin de mes`
                  : 'Acaba de empezar el mes'}
              </span>
            </span>
            {report.spend.budget ? <PaceBar pace={sp} color={RING_COLORS[0]} /> : null}
          </div>
        )}
      </section>

      {report.daily && report.daily.length > 1 && (
        <section className="details__sec">
          <h3 className="details__title">Tokens por día · 30 días</h3>
          <DailyBars days={report.daily} />
        </section>
      )}

      <section className="details__sec">
        <div className="details__head">
          <h3 className="details__title">Historial</h3>
          <span className="seg" role="tablist" aria-label="Rango">
            {RANGES.map((r) => (
              <button key={r.hours} role="tab" aria-selected={hours === r.hours} onClick={() => setHours(r.hours)}>
                {r.label}
              </button>
            ))}
          </span>
        </div>
        {samples == null ? (
          <p className="hist__empty">Cargando…</p>
        ) : series.pct.some((s) => s.points.length) ? (
          <>
            <Sparkline series={series.pct} max={pctMax} />
            <span className="daily__axis">
              <span>{RANGES.find((r) => r.hours === hours)?.label}</span>
              <span>escala 0–{pctMax} %</span>
            </span>
          </>
        ) : series.spend.length ? (
          <Sparkline series={[{ color: RING_COLORS[0], points: series.spend }]} max={spendMax} />
        ) : (
          <p className="hist__empty">Aún no hay lecturas guardadas.</p>
        )}
      </section>
    </div>
  );
}
