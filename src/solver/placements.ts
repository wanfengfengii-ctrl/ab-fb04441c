import type { Aperture, Placement } from './types';

export function placementKey(p: Placement): string {
  return `${p.top},${p.left},${p.height},${p.width}`;
}

/** 规范序：按零基 (top, left, height, width) 元组升序 */
export function comparePlacements(a: Placement, b: Placement): number {
  return a.top - b.top || a.left - b.left || a.height - b.height || a.width - b.width;
}

/**
 * 由允许孔径生成全部可行放置：
 * 每种孔径在剂量图内所有零基位置各产生一个放置；不同孔径定义出的相同矩形去重；
 * 结果按规范序排序，下标即规范序编号。
 */
export function buildPlacements(rows: number, cols: number, apertures: Aperture[]): Placement[] {
  const seen = new Set<string>();
  const out: Placement[] = [];
  for (const { height, width } of apertures) {
    if (!Number.isInteger(height) || !Number.isInteger(width) || height < 1 || width < 1) continue;
    for (let top = 0; top + height <= rows; top++) {
      for (let left = 0; left + width <= cols; left++) {
        const p: Placement = { top, left, height, width };
        const key = placementKey(p);
        if (!seen.has(key)) {
          seen.add(key);
          out.push(p);
        }
      }
    }
  }
  out.sort(comparePlacements);
  return out;
}
