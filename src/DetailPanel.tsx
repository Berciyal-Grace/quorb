import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { PhysicalPosition, PhysicalSize } from '@tauri-apps/api/dpi';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ProviderCard } from './components/ProviderCard';
import { ProviderDetails } from './components/ProviderDetails';
import { api } from './lib/api';
import { reportSummary } from './lib/format';
import { OFFICIAL_USAGE_URL } from './lib/order';
import { createLatestQueue, detailBounds, DETAIL_EVENTS, type DetailInteraction, type DetailState } from './lib/detail-panel';

function readDetailsPreference(): boolean {
  try { return JSON.parse(localStorage.getItem('detailsOpen') ?? 'false') === true; }
  catch { return false; }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement('textarea');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  }
}

export function DetailPanel() {
  const [data, setData] = useState<DetailState | null>(null);
  const [positioned, setPositioned] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(readDetailsPreference);
  const [toast, setToast] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<DetailState | null>(null);
  const enqueue = useRef(createLatestQueue()).current;

  const interact = (kind: DetailInteraction['kind']) => {
    const state = dataRef.current;
    if (!state) return;
    emitTo('widget', DETAIL_EVENTS.interaction, {
      revision: state.revision, provider: state.report.id, kind,
    } satisfies DetailInteraction).catch(console.warn);
  };

  useEffect(() => {
    let disposed = false;
    const unlisteners: (() => void)[] = [];
    const ready = () => emitTo('widget', DETAIL_EVENTS.ready).catch(console.warn);
    const register = async () => {
      const stateListener = await listen<DetailState | null>(DETAIL_EVENTS.state, ({ payload }) => {
        if (disposed) return;
        const wasClosed = dataRef.current === null;
        dataRef.current = payload;
        // Invalidate an in-flight show immediately, before React commits new content.
        enqueue(async () => { if (!payload) await getCurrentWindow().hide(); }).catch(console.warn);
        if (!payload || wasClosed) setPositioned(false);
        setData(payload);
      });
      if (disposed) { stateListener(); return; }
      unlisteners.push(stateListener);
      const requestListener = await listen(DETAIL_EVENTS.requestReady, ready);
      if (disposed) { requestListener(); return; }
      unlisteners.push(requestListener);
      await ready();
    };
    register().catch(console.warn);
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
      dataRef.current = null;
      enqueue(async () => { await getCurrentWindow().hide(); }).catch(console.warn);
    };
  }, [enqueue]);

  useLayoutEffect(() => {
    if (!data || !panelRef.current) return;
    let disposed = false;
    const measure = () => {
      const panel = panelRef.current;
      if (disposed || !panel) return;
      const bounds = detailBounds(data, panel.getBoundingClientRect().height);
      enqueue(async (current) => {
        const win = getCurrentWindow();
        const sf = data.scaleFactor;
        if (!current()) return;
        await win.setPosition(new PhysicalPosition(Math.round(bounds.x * sf), Math.round(bounds.y * sf)));
        if (!current()) return;
        await win.setSize(new PhysicalSize(Math.max(1, Math.round(bounds.w * sf)), Math.max(1, Math.round(bounds.h * sf))));
        if (!current() || disposed) return;
        setPositioned(true);
        // The native command refuses to show an orphan panel when the widget is hidden.
        await api.showDetail();
      }).catch(console.warn);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(panelRef.current);
    return () => { disposed = true; observer.disconnect(); };
  }, [data, detailsOpen, enqueue]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!data) return null;
  // El panel se diseña a la medida del DS (círculo de 56 px) y se escala entero con el tamaño de los círculos.
  const zoom = Math.max(0.6, Math.min(1.5, data.orbSize / 56));
  const updated = data.updatedAt == null ? '—' : new Date(data.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return (
    <div
      className="dock detail-dock"
      data-edge={data.edge}
      style={{ '--panel-alpha': String(data.opacity), '--ring-1': data.colors[0], '--ring-2': data.colors[1], '--ring-3': data.colors[2] } as CSSProperties}
      onMouseEnter={() => interact('enter')}
      onMouseLeave={() => interact('leave')}
    >
      <div
        ref={panelRef}
        className="panel q-panel eg-module-card eg-module-card--glass"
        role="dialog"
        aria-label={`Detalle de ${data.report.name}`}
        style={{ left: 0, top: 0, width: data.width / zoom, maxHeight: data.maxHeight / zoom, overflowY: 'auto', zoom, '--orb': data.orbSize, visibility: positioned ? 'visible' : 'hidden' } as CSSProperties}
      >
        <ProviderCard report={data.report} />
        <button className="panel__more" aria-expanded={detailsOpen} onClick={() => {
          const next = !detailsOpen;
          setDetailsOpen(next);
          try { localStorage.setItem('detailsOpen', JSON.stringify(next)); } catch { /* preference is optional */ }
        }}>
          <span>Ritmo e historial</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
        {detailsOpen && <ProviderDetails key={data.report.id} report={data.report} />}
        <div className="panel__actions">
          {OFFICIAL_USAGE_URL[data.report.id] && <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => openUrl(OFFICIAL_USAGE_URL[data.report.id]).catch(console.warn)}>Uso oficial ↗</button>}
          <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={async () => setToast((await copyText(reportSummary(data.report))) ? 'Copiado ✓' : 'No se pudo copiar')}>{toast ?? 'Copiar resumen'}</button>
          <button type="button" className="eg-btn eg-btn--ghost eg-btn--sm" onClick={() => interact('hide')} title="Se sigue consultando y avisando; recupéralo en Ajustes">Ocultar</button>
        </div>
        <footer className="panel__foot"><span>Actualizado {updated}</span><span>cada {data.refreshMinutes} min</span></footer>
        {data.error && <p className="panel__error">{data.error}</p>}
      </div>
    </div>
  );
}
