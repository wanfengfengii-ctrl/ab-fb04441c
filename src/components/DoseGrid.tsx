import type { Rect } from '../solver';

// 网格视觉常量（与 styles.css 中 .dose-grid 的 padding/gap 对应）
const PAD = 4;
const GAP = 4;

/** 第 k 个格子起点的 calc 表达式：pad + k×(cell + gap)，只含加法 */
function offset(k: number): string {
  return `calc(${PAD}px${` + var(--cell) + ${GAP}px`.repeat(k)})`;
}
/** 跨 n 个格子（含中间间隙）的尺寸 calc 表达式 */
function span(n: number): string {
  return `calc(${Array(n).fill('var(--cell)').join(` + ${GAP}px + `)})`;
}

interface DoseGridProps {
  rows: number;
  cols: number;
  /** 每格显示的主数值 */
  values: number[][];
  /** 每格角标（如目标值 a/target） */
  corner?: (r: number, c: number) => string | null;
  /** 当前击发矩形高亮 */
  highlight?: Rect | null;
  /** 按相对目标剂量着色（0..1），不传则按 value/4 */
  intensity?: (r: number, c: number) => number;
  dimZero?: boolean;
}

/** 只读剂量网格，带矩形高亮覆盖层 */
export default function DoseGrid({
  rows,
  cols,
  values,
  corner,
  highlight,
  intensity,
  dimZero = false,
}: DoseGridProps) {
  return (
    <div
      className="dose-grid"
      style={{
        gridTemplateColumns: `repeat(${cols}, var(--cell))`,
        gridTemplateRows: `repeat(${rows}, var(--cell))`,
      }}
    >
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const v = values[r][c];
          const t = intensity ? intensity(r, c) : Math.min(v / 4, 1);
          const note = corner?.(r, c);
          return (
            <div
              key={`${r}-${c}`}
              className={`cell${v === 0 && dimZero ? ' dim' : ''}`}
              style={{
                background: `rgba(64, 140, 255, ${0.08 + 0.22 * t})`,
                borderColor: `rgba(64, 140, 255, ${0.15 + 0.55 * t})`,
              }}
            >
              <span className="cell-value">{v}</span>
              {note !== null && note !== undefined && (
                <span className="cell-corner">{note}</span>
              )}
            </div>
          );
        }),
      )}
      {highlight && (
        <div
          className="shot-outline"
          style={{
            left: offset(highlight.left),
            top: offset(highlight.top),
            width: span(highlight.width),
            height: span(highlight.height),
          }}
        />
      )}
    </div>
  );
}
