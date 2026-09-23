import { describe, it, expect } from 'vitest';
import { solve } from '../solver/solve';
import { buildPlacements, comparePlacements, placementKey } from '../solver/placements';
import type { Placement, ProblemInput } from '../solver/types';

const keys = (sol: Placement[]): string[] => sol.map(placementKey);

describe('solve：基本情形', () => {
  it('单次击发即可命中时给出唯一解', () => {
    const r = solve({ rows: 2, cols: 2, cells: [[1, 1], [1, 1]], apertures: [{ height: 2, width: 2 }] });
    expect(r.status).toBe('unique');
    expect(r.shotCount).toBe(1);
    expect(r.solutions).toHaveLength(1);
    expect(keys(r.solutions[0])).toEqual(['0,0,2,2']);
  });

  it('允许对同一放置重复击发', () => {
    const r = solve({ rows: 2, cols: 2, cells: [[2, 2], [2, 2]], apertures: [{ height: 2, width: 2 }] });
    expect(r.status).toBe('unique');
    expect(r.shotCount).toBe(2);
    expect(keys(r.solutions[0])).toEqual(['0,0,2,2', '0,0,2,2']);
  });

  it('任何击发都会过曝时判定不可实现', () => {
    const r = solve({ rows: 2, cols: 2, cells: [[1, 0], [0, 0]], apertures: [{ height: 2, width: 2 }] });
    expect(r.status).toBe('infeasible');
    expect(r.solutions).toHaveLength(0);
  });

  it('目标格无任何孔径覆盖时判定不可实现', () => {
    const r = solve({
      rows: 2,
      cols: 3,
      cells: [[0, 0, 1], [0, 0, 0]],
      apertures: [{ height: 2, width: 1 }],
    });
    // (0,2) 只能被 2×1 在 left=2 处覆盖，但会连带 (1,2)=0 过曝
    expect(r.status).toBe('infeasible');
  });

  it('全零目标：零次击发的唯一解', () => {
    const r = solve({ rows: 3, cols: 3, cells: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], apertures: [{ height: 1, width: 1 }] });
    expect(r.status).toBe('unique');
    expect(r.shotCount).toBe(0);
    expect(r.solutions).toEqual([[]]);
  });

  it('重复定义的孔径按同一放置去重，不产生伪并列', () => {
    const r = solve({
      rows: 2,
      cols: 2,
      cells: [[1, 1], [1, 1]],
      apertures: [{ height: 2, width: 2 }, { height: 2, width: 2 }],
    });
    expect(r.status).toBe('unique');
    expect(r.shotCount).toBe(1);
  });
});

describe('solve：最优性与规范序', () => {
  it('先最小化击发次数（大孔径优先于多小孔径）', () => {
    const r = solve({
      rows: 2,
      cols: 2,
      cells: [[1, 1], [1, 1]],
      apertures: [{ height: 1, width: 1 }, { height: 2, width: 2 }],
    });
    expect(r.status).toBe('unique');
    expect(r.shotCount).toBe(1);
    expect(keys(r.solutions[0])).toEqual(['0,0,2,2']);
  });

  it('并列最优：横切两刀与竖切两刀同为最优', () => {
    const r = solve({
      rows: 2,
      cols: 2,
      cells: [[1, 1], [1, 1]],
      apertures: [{ height: 1, width: 2 }, { height: 2, width: 1 }],
    });
    expect(r.status).toBe('tied');
    expect(r.shotCount).toBe(2);
    expect(r.solutions).toHaveLength(2);
    // 字典序最小：height=1 的元组先于 height=2
    expect(keys(r.solutions[0])).toEqual(['0,0,1,2', '1,0,1,2']);
    expect(keys(r.solutions[1])).toEqual(['0,0,2,1', '0,1,2,1']);
  });

  it('字典序比较整份列表：含更多小号元组者在前', () => {
    const r = solve({
      rows: 2,
      cols: 3,
      cells: [[1, 1, 1], [0, 0, 0]],
      apertures: [{ height: 1, width: 1 }, { height: 1, width: 2 }],
    });
    expect(r.status).toBe('tied');
    expect(r.shotCount).toBe(2);
    // 方案甲 [(0,0,1,1),(0,1,1,2)] 与方案乙 [(0,0,1,2),(0,2,1,1)] 均为 2 发；
    // 甲的次小元组 (0,1,1,2) < 乙的 (0,2,1,1)，故甲在前
    expect(keys(r.solutions[0])).toEqual(['0,0,1,1', '0,1,1,2']);
    expect(keys(r.solutions[1])).toEqual(['0,0,1,2', '0,2,1,1']);
  });

  it('方案内部的击发按 (top,left,height,width) 升序', () => {
    const r = solve({
      rows: 3,
      cols: 3,
      cells: [[1, 0, 1], [0, 1, 0], [1, 0, 1]],
      apertures: [{ height: 1, width: 1 }],
    });
    expect(r.status).toBe('unique');
    const sorted = [...r.solutions[0]].sort(comparePlacements);
    expect(keys(r.solutions[0])).toEqual(keys(sorted));
  });

  it('1×1 孔径的大图：击发数等于总剂量', () => {
    const cells = [
      [4, 4, 4, 4, 4, 4],
      [4, 4, 4, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
    ]; // 总剂量 36，恰为上限
    const r = solve({ rows: 5, cols: 6, cells, apertures: [{ height: 1, width: 1 }] });
    expect(r.status).toBe('unique');
    expect(r.shotCount).toBe(36);
  });
});

/**
 * 对拍：暴力迭代加深枚举全部多重集（下标不减保证每个多重集只出现一次），
 * 与 DP 求解器比较状态、最少次数与前两份规范方案。
 */
function bruteForce(problem: ProblemInput) {
  const placements = buildPlacements(problem.rows, problem.cols, problem.apertures);
  const n = placements.length;
  const cellCount = problem.rows * problem.cols;
  const cover = placements.map((p) => {
    const list: number[] = [];
    for (let r = p.top; r < p.top + p.height; r++) {
      for (let c = p.left; c < p.left + p.width; c++) list.push(r * problem.cols + c);
    }
    return list;
  });
  const target = new Uint8Array(cellCount);
  problem.cells.forEach((row, r) => row.forEach((v, c) => {
    target[r * problem.cols + c] = v;
  }));
  const totalDose = target.reduce((a, b) => a + b, 0);

  const v = new Uint8Array(target);
  const isZero = () => v.every((x) => x === 0);

  for (let k = 0; k <= totalDose; k++) {
    const sols: number[][] = [];
    const prefix: number[] = [];
    const dfs = (start: number, remaining: number) => {
      if (remaining === 0) {
        if (isZero()) sols.push([...prefix]);
        return;
      }
      for (let j = start; j < n; j++) {
        if (cover[j].some((cell) => v[cell] === 0)) continue; // 会过曝
        for (const cell of cover[j]) v[cell]--;
        prefix.push(j);
        dfs(j, remaining - 1);
        prefix.pop();
        for (const cell of cover[j]) v[cell]++;
      }
    };
    dfs(0, k);
    if (sols.length > 0) {
      const sorted = sols
        .map((idxs) => idxs.map((i) => placements[i]).sort(comparePlacements))
        .sort((a, b) => {
          for (let t = 0; t < Math.min(a.length, b.length); t++) {
            const d = comparePlacements(a[t], b[t]);
            if (d !== 0) return d;
          }
          return a.length - b.length;
        });
      return {
        status: sorted.length >= 2 ? 'tied' : 'unique',
        shotCount: k,
        solutions: sorted.slice(0, 2),
      };
    }
  }
  return { status: 'infeasible', shotCount: 0, solutions: [] as Placement[][] };
}

describe('solve：与暴力枚举对拍（随机小规模）', () => {
  const sizes = [
    [1, 1],
    [1, 2],
    [2, 1],
    [2, 2],
    [1, 3],
    [3, 1],
  ] as const;

  const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

  it('50 组随机输入结果一致', () => {
    for (let iter = 0; iter < 50; iter++) {
      const rows = rand(2, 3);
      const cols = rand(2, 3);
      const cells = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => rand(0, 2)),
      );
      const shuffled = [...sizes].sort(() => Math.random() - 0.5);
      const apertures = shuffled.slice(0, rand(1, 4)).map(([height, width]) => ({ height, width }));

      const problem: ProblemInput = { rows, cols, cells, apertures };
      const expected = bruteForce(problem);
      const actual = solve(problem);

      expect(actual.status, JSON.stringify(problem)).toBe(expected.status);
      expect(actual.shotCount, JSON.stringify(problem)).toBe(expected.shotCount);
      expect(
        actual.solutions.map(keys),
        JSON.stringify(problem),
      ).toEqual(expected.solutions.map(keys));
    }
  });
});
