import type { UsageReport } from '../lib/types';
import { formatMoney } from '../lib/format';
import { MeterBar } from './MeterBar';
import { RING_COLORS } from './RingGauge';
import { api } from '../lib/api';
import { ProviderLogo } from './ProviderLogo';

const STATUS_LABEL: Record<UsageReport['status'], string> = {
  ok: 'Al día',
  warning: 'Atención',
  error: 'Error',
  needsLogin: 'Sin sesión',
  unconfigured: 'Sin configurar',
};

function ActionButton({ report }: { report: UsageReport }) {
  if (report.action === 'login') {
    return (
      <button className="btn btn--accent" onClick={() => api.openLogin(report.id).catch(console.error)}>
        Iniciar sesión
      </button>
    );
  }
  if (report.action === 'settings') {
    return (
      <button className="btn" onClick={() => api.openSettings().catch(console.error)}>
        Configurar
      </button>
    );
  }
  return null;
}

/** Detalle con barras: se abre al hacer clic en un círculo. */
export function ProviderCard({ report }: { report: UsageReport }) {
  const { spend } = report;
  let ringIndex = 0;
  return (
    <article className="card" data-status={report.status} data-provider={report.id}>
      <header className="card__head">
        <span className="card__logo logo">
          <ProviderLogo id={report.id} name={report.name} />
        </span>
        <h2 className="card__name">{report.name}</h2>
        <span className="card__dot" title={STATUS_LABEL[report.status]} />
        {report.plan && <span className="pill">{report.plan}</span>}
        {report.stale && <span className="pill pill--muted" title="Datos del último ciclo correcto">caché</span>}
      </header>

      {report.meters.length > 0 && (
        <div className="card__meters">
          {report.meters.map((m) => {
            // Mismo color que su anillo en el círculo.
            const ring = m.percent != null ? ringIndex++ : -1;
            return <MeterBar key={m.label} meter={m} color={ring >= 0 && ring < RING_COLORS.length ? RING_COLORS[ring] : undefined} />;
          })}
        </div>
      )}

      {spend && (
        <div className="spend">
          <span className="spend__label">{spend.periodLabel}</span>
          <span className="spend__amount">{formatMoney(spend.amount, spend.currency)}</span>
          {spend.budget != null && spend.budget > 0 && (
            <span className="spend__budget">de {formatMoney(spend.budget, spend.currency)}</span>
          )}
        </div>
      )}

      {report.message && <p className="card__msg">{report.message}</p>}
      <ActionButton report={report} />
    </article>
  );
}
