import type { Aperture, ProblemInput } from './types';
import { validateProblem } from './validate';

/** 导入文件的 JSON 格式示例（apertures 支持 {height,width} 或 [height,width] 两种写法） */
export const IMPORT_EXAMPLE = `{
  "rows": 2,
  "cols": 2,
  "cells": [[1, 1], [1, 1]],
  "apertures": [{ "height": 1, "width": 2 }, [2, 1]]
}`;

export function serializeProblem(p: ProblemInput): string {
  return JSON.stringify(
    { rows: p.rows, cols: p.cols, cells: p.cells, apertures: p.apertures },
    null,
    2,
  );
}

export type ParseOutcome =
  | { ok: true; value: ProblemInput }
  | { ok: false; errors: string[] };

/** 解析并校验导入的 JSON 文本；任何不合法都会得到中文错误列表 */
export function parseProblemJson(text: string): ParseOutcome {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['JSON 解析失败：请检查括号、引号与逗号'] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: ['导入内容须为 JSON 对象'] };
  }
  const o = raw as Record<string, unknown>;

  const errors: string[] = [];
  if (!Array.isArray(o.cells)) errors.push('缺少 cells 二维数组');
  if (!Array.isArray(o.apertures)) errors.push('缺少 apertures 数组');
  if (errors.length > 0) return { ok: false, errors };

  const apertures: Aperture[] = (o.apertures as unknown[]).map((a) => {
    if (Array.isArray(a) && a.length === 2) return { height: Number(a[0]), width: Number(a[1]) };
    if (typeof a === 'object' && a !== null) {
      const r = a as Record<string, unknown>;
      return { height: Number(r.height), width: Number(r.width) };
    }
    return { height: NaN, width: NaN };
  });

  const value: ProblemInput = {
    rows: Number(o.rows),
    cols: Number(o.cols),
    cells: (o.cells as unknown[]).map((row) => (Array.isArray(row) ? row.map(Number) : [])),
    apertures,
  };

  const vErrors = validateProblem(value);
  if (vErrors.length > 0) return { ok: false, errors: vErrors };
  return { ok: true, value };
}
