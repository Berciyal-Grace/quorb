import { describe, expect, it } from 'vitest';
import { nearestEdge, panelRect, stripRect, union } from './dock';

const area = { x: 0, y: 0, w: 1920, h: 1040 }; // pantalla menos barra de tareas

describe('dock', () => {
  it('finds the nearest edge and offset', () => {
    expect(nearestEdge(area, 960, 20)).toEqual({ edge: 'top', offset: 0.5 });
    expect(nearestEdge(area, 1900, 520)).toEqual({ edge: 'right', offset: 0.5 });
    expect(nearestEdge(area, 10, 260).edge).toBe('left');
    expect(nearestEdge(area, 480, 1030)).toEqual({ edge: 'bottom', offset: 0.25 });
  });

  it('keeps the strip flush and inside the screen', () => {
    expect(stripRect(area, 'top', 0.5, 400, 80)).toEqual({ x: 760, y: 0, w: 400, h: 80 });
    expect(stripRect(area, 'bottom', 0, 400, 80)).toEqual({ x: 0, y: 960, w: 400, h: 80 });
    expect(stripRect(area, 'right', 1, 80, 400)).toEqual({ x: 1840, y: 640, w: 80, h: 400 });
  });

  it('opens the panel towards the inside, clamped', () => {
    const top = stripRect(area, 'top', 0.5, 400, 80);
    expect(panelRect(area, 'top', top, 800, 300, 200)).toEqual({ x: 650, y: 88, w: 300, h: 200 });
    const right = stripRect(area, 'right', 0.02, 80, 400);
    const p = panelRect(area, 'right', right, 30, 300, 260);
    expect(p).toEqual({ x: 1532, y: 0, w: 300, h: 260 });
    const left = stripRect(area, 'left', 0.5, 80, 400);
    expect(panelRect(area, 'left', left, 520, 300, 200).x).toBe(88);
  });

  it('unions rects', () => {
    expect(union({ x: 10, y: 10, w: 10, h: 10 }, { x: 0, y: 15, w: 5, h: 20 })).toEqual({ x: 0, y: 10, w: 20, h: 25 });
  });
});
