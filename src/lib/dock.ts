// Geometría del dock: la tira va pegada a un borde de la pantalla y el panel
// de detalle se abre hacia el interior. Todo en píxeles lógicos.

export type Edge = 'top' | 'bottom' | 'left' | 'right';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

export const isEdge = (v: unknown): v is Edge => EDGES.includes(v as Edge);
export const isVertical = (e: Edge) => e === 'left' || e === 'right';

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

/** Borde más cercano a un punto y posición relativa (0–1) a lo largo de ese borde. */
export function nearestEdge(area: Rect, px: number, py: number): { edge: Edge; offset: number } {
  const d: Record<Edge, number> = {
    left: px - area.x,
    right: area.x + area.w - px,
    top: py - area.y,
    bottom: area.y + area.h - py,
  };
  const edge = (Object.keys(d) as Edge[]).reduce((a, b) => (d[b] < d[a] ? b : a));
  const offset = isVertical(edge) ? (py - area.y) / area.h : (px - area.x) / area.w;
  return { edge, offset: clamp(offset, 0, 1) };
}

/** Rectángulo de la tira: pegada al borde y centrada en `offset`, sin salirse. */
export function stripRect(area: Rect, edge: Edge, offset: number, w: number, h: number): Rect {
  if (isVertical(edge)) {
    const y = clamp(area.y + offset * area.h - h / 2, area.y, area.y + area.h - h);
    return { x: edge === 'left' ? area.x : area.x + area.w - w, y, w, h };
  }
  const x = clamp(area.x + offset * area.w - w / 2, area.x, area.x + area.w - w);
  return { x, y: edge === 'top' ? area.y : area.y + area.h - h, w, h };
}

/**
 * Rectángulo del panel: al lado de la tira, hacia el interior de la pantalla,
 * centrado en el círculo activo (`anchor`, coordenada absoluta a lo largo del borde).
 */
export function panelRect(area: Rect, edge: Edge, strip: Rect, anchor: number, w: number, h: number, gap = 8): Rect {
  switch (edge) {
    case 'top':
      return { x: clamp(anchor - w / 2, area.x, area.x + area.w - w), y: strip.y + strip.h + gap, w, h };
    case 'bottom':
      return { x: clamp(anchor - w / 2, area.x, area.x + area.w - w), y: strip.y - gap - h, w, h };
    case 'left':
      return { x: strip.x + strip.w + gap, y: clamp(anchor - h / 2, area.y, area.y + area.h - h), w, h };
    case 'right':
      return { x: strip.x - gap - w, y: clamp(anchor - h / 2, area.y, area.y + area.h - h), w, h };
  }
}

/** Stable panel capacity, independent of provider content; overflow scrolls inside the panel. */
export function panelHeightLimit(area: Rect, edge: Edge, strip: Rect, w: number, gap = 8): number {
  const available = isVertical(edge) ? area.h : area.h - strip.h - gap;
  return Math.max(1, Math.min(Math.round(w * 1.6), available));
}

/** Bounds for every panel anchor along the strip, so hovering does not move the window origin. */
export function panelWindowRect(area: Rect, edge: Edge, strip: Rect, w: number, h: number): Rect {
  const start = isVertical(edge) ? strip.y : strip.x;
  const end = start + (isVertical(edge) ? strip.h : strip.w);
  return union(union(strip, panelRect(area, edge, strip, start, w, h)), panelRect(area, edge, strip, end, w, h));
}

export function union(a: Rect, b?: Rect | null): Rect {
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

export function contains(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}
