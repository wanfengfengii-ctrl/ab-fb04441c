import { LIMITS } from '../solver/validate';

interface GridEditorProps {
  rows: number;
  cols: number;
  cells: number[][];
  onRowsChange: (n: number) => void;
  onColsChange: (n: number) => void;
  onCellChange: (r: number, c: number, v: number) => void;
}

const range = (lo: number, hi: number): number[] =>
  Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

/** 整数剂量图编辑器：行 2–5、列 2–6，每格 0–4 */
export function GridEditor({ rows, cols, cells, onRowsChange, onColsChange, onCellChange }: GridEditorProps) {
  return (
    <div className="grid-editor">
      <div className="grid-controls">
        <label>
          行数
          <select value={rows} onChange={(e) => onRowsChange(Number(e.target.value))}>
            {range(LIMITS.minRows, LIMITS.maxRows).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          列数
          <select value={cols} onChange={(e) => onColsChange(Number(e.target.value))}>
            {range(LIMITS.minCols, LIMITS.maxCols).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="hint">每格 0–4，总剂量 ≤ 36</span>
      </div>
      <table className="cell-input-table">
        <tbody>
          {cells.map((row, r) => (
            <tr key={r}>
              {row.map((v, c) => (
                <td key={c}>
                  <input
                    type="number"
                    min={LIMITS.minCell}
                    max={LIMITS.maxCell}
                    step={1}
                    value={Number.isNaN(v) ? '' : v}
                    aria-label={`剂量 (${r},${c})`}
                    onChange={(e) => {
                      const t = e.target.value;
                      onCellChange(r, c, t === '' ? NaN : Number(t));
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
