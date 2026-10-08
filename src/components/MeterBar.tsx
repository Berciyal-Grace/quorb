import type { CSSProperties } from 'react';
import type { Meter } from '../lib/types';
import { formatCompact, formatPercent, formatResetIn, levelFor } from '../lib/format';

/**
 * Un límite del panel (EGDEV Foundation): marca del anillo + etiqueta + %,
 * ProgressBar --lg y cuándo se reinicia. `ring` = anillo del círculo (1–3) o null.
 */
export function MeterBar({ meter, ring }: { meter: Meter; ring: number | null }) {
  const pct = meter.percent;
  const reset = formatResetIn(meter.resetsAt);
  const amount =
    meter.used != null
      ? meter.limit != null
        ? `${formatCompact(meter.used)} / ${formatCompact(meter.limit)}${meter.unit ? ` ${meter.unit}` : ''}`
        : `${formatCompact(meter.used)}${meter.unit ? ` ${meter.unit}` : ''}`
      : null;
  const meta = [pct != null ? amount : null, reset ? `Se reinicia ${reset}` : null].filter(Boolean).join(' · ');

  return (
    <div className="q-meter" data-ring={ring ?? undefined} data-level={levelFor(pct)}>
      <div className="q-meter__row">
        {ring != null && <span className={`eg-gauge__key${ring > 1 ? ` eg-gauge__key--${ring}` : ''}`} aria-hidden="true" />}
        <span className="q-meter__label">{meter.label}</span>
        <b className="q-meter__value">{pct != null ? formatPercent(pct) : amount}</b>
      </div>
      {pct != null && (
        <span
          className="eg-progress eg-progress--lg"
          role="progressbar"
          aria-label={meter.label}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{ '--p': Math.min(100, Math.max(0, pct)) / 100 } as CSSProperties}
        >
          <span className="eg-progress__bar" />
        </span>
      )}
      {meta && <span className="q-meter__meta">{meta}</span>}
    </div>
  );
}
