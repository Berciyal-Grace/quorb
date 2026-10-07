import type { CSSProperties } from 'react';
import type { Meter } from '../lib/types';
import { formatCompact, formatPercent, formatResetIn, levelFor } from '../lib/format';

export function MeterBar({ meter, color }: { meter: Meter; color?: string }) {
  const pct = meter.percent;
  const reset = formatResetIn(meter.resetsAt);
  const amount =
    meter.used != null
      ? meter.limit != null
        ? `${formatCompact(meter.used)} / ${formatCompact(meter.limit)}${meter.unit ? ` ${meter.unit}` : ''}`
        : `${formatCompact(meter.used)}${meter.unit ? ` ${meter.unit}` : ''}`
      : null;

  return (
    <div
      className="meter"
      data-level={levelFor(pct)}
      data-colored={color ? true : undefined}
      style={color ? ({ '--bar-color': color } as CSSProperties) : undefined}
    >
      <div className="meter__row">
        <span className="meter__label">
          {color && <span className="meter__swatch" aria-hidden="true" />}
          {meter.label}
        </span>
        <span className="meter__value">{pct != null ? formatPercent(pct) : amount}</span>
      </div>
      {pct != null && (
        <div
          className="meter__track"
          role="progressbar"
          aria-label={meter.label}
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="meter__fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
        </div>
      )}
      {(reset || (pct != null && amount)) && (
        <div className="meter__meta">
          {pct != null && amount && <span>{amount}</span>}
          {reset && <span>reinicia {reset}</span>}
        </div>
      )}
    </div>
  );
}
