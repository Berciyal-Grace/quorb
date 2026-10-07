import type { ButtonHTMLAttributes } from 'react';
import type { UsageReport } from '../lib/types';
import { peakMeter } from '../lib/format';
import { RingGauge } from './RingGauge';
import { ProviderLogo } from './ProviderLogo';

/**
 * Círculo de la tira siempre visible: solo anillos + logo, sin texto.
 * Los detalles se ven en el panel que se abre al pasar el ratón.
 */
export function ProviderGauge({
  report,
  small,
  size,
  active,
  dragging = false,
  onHover,
  pointer,
}: {
  report: UsageReport;
  small: boolean;
  /** Diámetro en px */
  size: number;
  active: boolean;
  onHover: (el: HTMLElement) => void;
  /** Se está arrastrando para reordenar */
  dragging?: boolean;
  /** Manejadores de puntero para reordenar arrastrando */
  pointer?: Pick<ButtonHTMLAttributes<HTMLButtonElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp'>;
}) {
  const peak = peakMeter(report);
  const all = report.meters.filter((m) => m.percent != null).map((m) => ({ percent: m.percent, label: m.label }));
  // Pequeños: un único anillo con el límite más cercano.
  // Con círculos muy pequeños, máximo dos anillos para que el logo siga viéndose.
  const rings = small ? (peak ? [{ percent: peak.percent, label: peak.label }] : []) : all.slice(0, size < 40 ? 2 : 3);
  const muted = report.status === 'needsLogin' || report.status === 'unconfigured' || report.status === 'error';
  // El grosor de los anillos escala con el círculo (con un mínimo legible).
  const stroke = Math.max(2.5, Math.round(size * (small ? 0.085 : 0.066) * 2) / 2);
  const gap = Math.max(1, Math.round(size * 0.025 * 2) / 2);
  const alert = muted || report.status === 'warning' || (peak?.percent ?? 0) >= 90;

  return (
    <button
      type="button"
      className="orb"
      data-id={report.id}
      data-active={active || undefined}
      data-dragging={dragging || undefined}
      data-status={report.status}
      aria-label={report.name}
      aria-expanded={active}
      onMouseEnter={(e) => onHover(e.currentTarget)}
      onFocus={(e) => onHover(e.currentTarget)}
      onClick={(e) => onHover(e.currentTarget)}
      onPointerCancel={pointer?.onPointerUp}
      {...pointer}
    >
      <RingGauge rings={rings} size={size} stroke={stroke} gap={gap} muted={muted}>
        <span className="logo">
          <ProviderLogo id={report.id} name={report.name} />
        </span>
      </RingGauge>
      {alert && <span className="orb__badge" data-kind={muted ? 'action' : 'hot'} aria-hidden="true" />}
    </button>
  );
}
