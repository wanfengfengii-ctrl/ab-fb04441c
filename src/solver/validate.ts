import type { ProblemInput } from './types';

/** 工艺约束上限 */
export const LIMITS = {
  minRows: 2,
  maxRows: 5,
  minCols: 2,
  maxCols: 6,
  minCell: 0,
  maxCell: 4,
  maxTotal: 36,
  minApertures: 1,
  maxApertures: 8,
} as const;

function fmt(v: unknown): string {
  return typeof v === 'number' && Number.isNaN(v) ? '空' : String(v);
}

/**
 * 校验工艺输入，返回中文错误列表（空数组表示合法）。
 * 规则：行 2–5、列 2–6；每格 0–4 整数且总剂量 ≤ 36；
 * 孔径 1–8 种，宽高为正整数且不得越界。
 */
export function validateProblem(input: ProblemInput): string[] {
  const errors: string[] = [];
  const { rows, cols, cells, apertures } = input;

  const rowsOk = Number.isInteger(rows) && rows >= LIMITS.minRows && rows <= LIMITS.maxRows;
  const colsOk = Number.isInteger(cols) && cols >= LIMITS.minCols && cols <= LIMITS.maxCols;
  if (!rowsOk) errors.push(`行数须为 ${LIMITS.minRows}–${LIMITS.maxRows} 的整数（当前：${fmt(rows)}）`);
  if (!colsOk) errors.push(`列数须为 ${LIMITS.minCols}–${LIMITS.maxCols} 的整数（当前：${fmt(cols)}）`);

  const dimsOk = rowsOk && colsOk;
  if (dimsOk) {
    const shapeBad =
      !Array.isArray(cells) ||
      cells.length !== rows ||
      cells.some((row) => !Array.isArray(row) || row.length !== cols);
    if (shapeBad) {
      errors.push('剂量图尺寸与行列数不一致');
    } else {
      let total = 0;
      let bad = 0;
      for (const row of cells) {
        for (const v of row) {
          if (!Number.isInteger(v) || v < LIMITS.minCell || v > LIMITS.maxCell) bad++;
          else total += v;
        }
      }
      if (bad > 0) {
        errors.push(`存在 ${bad} 个非法剂量格：每格须为 ${LIMITS.minCell}–${LIMITS.maxCell} 的整数`);
      } else if (total > LIMITS.maxTotal) {
        errors.push(`总剂量 ${total} 超过上限 ${LIMITS.maxTotal}`);
      }
    }
  }

  if (!Array.isArray(apertures) || apertures.length < LIMITS.minApertures || apertures.length > LIMITS.maxApertures) {
    errors.push(
      `孔径种数须为 ${LIMITS.minApertures}–${LIMITS.maxApertures}（当前：${Array.isArray(apertures) ? apertures.length : '非法'}）`,
    );
  } else {
    apertures.forEach((a, i) => {
      const height = a?.height;
      const width = a?.width;
      if (!Number.isInteger(height) || !Number.isInteger(width) || (height as number) < 1 || (width as number) < 1) {
        errors.push(`孔径 #${i + 1}：宽、高须为正整数`);
      } else if (dimsOk && ((height as number) > rows || (width as number) > cols)) {
        errors.push(`孔径 #${i + 1}（${height}×${width}）越界：不得超过剂量图 ${rows}×${cols}`);
      }
    });
  }

  return errors;
}
