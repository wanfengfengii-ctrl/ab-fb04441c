/**
 * 导入解析（纯本地，无网络）。
 * 支持两种形态：
 *  1) 纯剂量图文本：每行 2~6 个整数，空白/逗号分隔，共 2~5 行，例如
 *       1 0 2
 *       0 3 1
 *  2) JSON：{"grid": [[..],..], "apertures": [[h,w],..]}，任一字段可缺省。
 */
import type { Aperture } from './solver';

export interface Imported {
  grid?: number[][];
  apertures?: Aperture[];
}

function splitRow(line: string): string[] {
  return line.trim().split(/[\s,，、;；|]+/).filter((s) => s.length > 0);
}

function toInt(s: string, ctx: string): number {
  if (!/^[+-]?\d+$/.test(s.trim())) {
    throw new Error(`${ctx} 不是整数：“${s}”`);
  }
  return Number(s.trim());
}

function parseGridText(text: string): number[][] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2 || lines.length > 5) {
    throw new Error(`剂量图需 2~5 行（解析到 ${lines.length} 行）`);
  }
  const cols = splitRow(lines[0]).length;
  if (cols < 2 || cols > 6) {
    throw new Error(`剂量图需 2~6 列（首行解析到 ${cols} 列）`);
  }
  return lines.map((line, r) => {
    const parts = splitRow(line);
    if (parts.length !== cols) {
      throw new Error(`第 ${r + 1} 行有 ${parts.length} 个数，应为 ${cols} 个`);
    }
    return parts.map((s) => toInt(s, `第 ${r + 1} 行`));
  });
}

function parseApertures(raw: unknown): Aperture[] {
  if (!Array.isArray(raw)) throw new Error('apertures 必须是数组');
  return raw.map((item, i) => {
    if (!Array.isArray(item) || item.length !== 2) {
      throw new Error(`第 ${i + 1} 种孔径需为 [height,width] 二元数组`);
    }
    const height = toInt(String(item[0]), `第 ${i + 1} 种孔径的 height`);
    const width = toInt(String(item[1]), `第 ${i + 1} 种孔径的 width`);
    return { height, width };
  });
}

export function parseImport(text: string): Imported {
  const t = text.trim();
  if (t.length === 0) throw new Error('导入内容为空');

  if (t.startsWith('{')) {
    let obj: unknown;
    try {
      obj = JSON.parse(t);
    } catch (e) {
      throw new Error(`JSON 解析失败：${(e as Error).message}`);
    }
    if (typeof obj !== 'object' || obj === null) {
      throw new Error('JSON 顶层需为对象');
    }
    const o = obj as Record<string, unknown>;
    const out: Imported = {};
    if (o.grid !== undefined) {
      if (!Array.isArray(o.grid)) throw new Error('grid 必须是二维数组');
      out.grid = (o.grid as unknown[]).map((row, r) => {
        if (!Array.isArray(row)) throw new Error(`grid 第 ${r + 1} 行不是数组`);
        return row.map((v, c) => toInt(String(v), `grid[${r + 1}][${c + 1}]`));
      });
    }
    if (o.apertures !== undefined) {
      out.apertures = parseApertures(o.apertures);
    }
    if (out.grid === undefined && out.apertures === undefined) {
      throw new Error('JSON 中未找到 grid 或 apertures 字段');
    }
    return out;
  }

  return { grid: parseGridText(t) };
}
