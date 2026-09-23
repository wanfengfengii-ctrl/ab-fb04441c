import { describe, it, expect } from 'vitest';
import { validateProblem, LIMITS } from '../solver/validate';
import { parseProblemJson, serializeProblem, IMPORT_EXAMPLE } from '../solver/serialize';
import type { ProblemInput } from '../solver/types';

const valid: ProblemInput = {
  rows: 3,
  cols: 4,
  cells: [
    [1, 2, 0, 1],
    [0, 3, 1, 2],
    [2, 1, 0, 0],
  ],
  apertures: [{ height: 1, width: 2 }],
};

describe('validateProblem', () => {
  it('合法输入无错误', () => {
    expect(validateProblem(valid)).toEqual([]);
  });

  it('行数越界（<2 或 >5）', () => {
    expect(validateProblem({ ...valid, rows: 1, cells: [[1, 2, 3, 4]] })).not.toEqual([]);
    expect(validateProblem({ ...valid, rows: 6 })).not.toEqual([]);
  });

  it('列数越界（<2 或 >6）', () => {
    expect(validateProblem({ ...valid, cols: 1 })).not.toEqual([]);
    expect(validateProblem({ ...valid, cols: 7 })).not.toEqual([]);
  });

  it('剂量格须为 0–4 的整数', () => {
    const bad1 = { ...valid, cells: valid.cells.map((r, i) => (i === 0 ? [5, ...r.slice(1)] : r)) };
    const bad2 = { ...valid, cells: valid.cells.map((r, i) => (i === 0 ? [-1, ...r.slice(1)] : r)) };
    const bad3 = { ...valid, cells: valid.cells.map((r, i) => (i === 0 ? [1.5, ...r.slice(1)] : r)) };
    expect(validateProblem(bad1).join()).toContain('非法剂量格');
    expect(validateProblem(bad2).join()).toContain('非法剂量格');
    expect(validateProblem(bad3).join()).toContain('非法剂量格');
  });

  it('总剂量不得超过 36', () => {
    const cells = Array.from({ length: 3 }, () => Array(4).fill(4)); // 48 > 36
    const errs = validateProblem({ ...valid, cells });
    expect(errs.join()).toContain('超过上限');
  });

  it('总剂量恰为 36 时合法', () => {
    const cells = [
      [4, 4, 4, 4],
      [4, 4, 4, 4],
      [4, 0, 0, 0],
    ]; // 36
    expect(validateProblem({ ...valid, cells })).toEqual([]);
  });

  it('孔径种数须为 1–8', () => {
    expect(validateProblem({ ...valid, apertures: [] }).join()).toContain('孔径种数');
    const nine = Array.from({ length: 9 }, () => ({ height: 1, width: 1 }));
    expect(validateProblem({ ...valid, apertures: nine }).join()).toContain('孔径种数');
    const eight = Array.from({ length: 8 }, () => ({ height: 1, width: 1 }));
    expect(validateProblem({ ...valid, apertures: eight })).toEqual([]);
  });

  it('孔径宽高须为正整数且不得越界', () => {
    expect(validateProblem({ ...valid, apertures: [{ height: 0, width: 1 }] }).join()).toContain('正整数');
    expect(validateProblem({ ...valid, apertures: [{ height: 1.5, width: 1 }] }).join()).toContain('正整数');
    expect(validateProblem({ ...valid, apertures: [{ height: 4, width: 1 }] }).join()).toContain('越界'); // 4 > 3 行
    expect(validateProblem({ ...valid, apertures: [{ height: 1, width: 5 }] }).join()).toContain('越界'); // 5 > 4 列
    expect(validateProblem({ ...valid, apertures: [{ height: 3, width: 4 }] })).toEqual([]);
  });

  it('剂量图尺寸须与行列数一致', () => {
    const bad = { ...valid, cells: [[1, 2], [3, 4]] };
    expect(validateProblem(bad).join()).toContain('不一致');
  });

  it('约束上限常量与题面一致', () => {
    expect([LIMITS.minRows, LIMITS.maxRows, LIMITS.minCols, LIMITS.maxCols]).toEqual([2, 5, 2, 6]);
    expect([LIMITS.minCell, LIMITS.maxCell, LIMITS.maxTotal]).toEqual([0, 4, 36]);
    expect([LIMITS.minApertures, LIMITS.maxApertures]).toEqual([1, 8]);
  });
});

describe('parseProblemJson / serializeProblem', () => {
  it('序列化后可无损回读', () => {
    const text = serializeProblem(valid);
    const r = parseProblemJson(text);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(valid);
  });

  it('非法 JSON 报错', () => {
    const r = parseProblemJson('{ not json');
    expect(r.ok).toBe(false);
  });

  it('非对象报错', () => {
    expect(parseProblemJson('[1,2,3]').ok).toBe(false);
    expect(parseProblemJson('42').ok).toBe(false);
  });

  it('缺少字段报错', () => {
    const r = parseProblemJson('{"rows":2}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('cells');
  });

  it('apertures 支持 [height,width] 数组写法', () => {
    const r = parseProblemJson('{"rows":2,"cols":2,"cells":[[1,1],[1,1]],"apertures":[[1,2],[2,1]]}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.apertures).toEqual([{ height: 1, width: 2 }, { height: 2, width: 1 }]);
  });

  it('语义不合法（如孔径越界）会带校验错误', () => {
    const r = parseProblemJson('{"rows":2,"cols":2,"cells":[[1,1],[1,1]],"apertures":[{"height":3,"width":1}]}');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toContain('越界');
  });

  it('内置示例本身合法', () => {
    expect(parseProblemJson(IMPORT_EXAMPLE).ok).toBe(true);
  });
});
