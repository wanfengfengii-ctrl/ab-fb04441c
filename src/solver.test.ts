import { describe, it, expect } from 'vitest';
import {
  solve,
  simulate,
  buildPlacements,
  canonicalize,
  compareRect,
  validateDose,
  validateApertures,
  type Aperture,
  type Rect,
} from './solver';

/** 独立参考枚举器：最朴素的多重集计数递归（与求解器代码路径不同），
 *  用于小规模随机对拍，验证“完整枚举 + 最少发数 + 字典序”结论。 */
function referenceSolve(grid: number[][], aps: Aperture[]) {
  const rows = grid.length;
  const cols = grid[0].length;
  const placements = buildPlacements(aps, rows, cols);
  const total = grid.flat().reduce((a, b) => a + b, 0);
  const solutions: Rect[][] = [];

  const residual = grid.flat().map((v) => v);
  const path: number[] = [];

  const rec = (i: number, area: number) => {
    if (area === total) {
      solutions.push(path.map((t) => placements[t]));
      return;
    }
    if (i >= placements.length) return;
    const r = placements[i];
    const cells: number[] = [];
    for (let y = 0; y < r.height; y++)
      for (let x = 0; x < r.width; x++)
        cells.push((r.top + y) * cols + r.left + x);
    let cap = Math.floor((total - area) / cells.length);
    for (const idx of cells) cap = Math.min(cap, residual[idx]);
    for (let k = 0; k <= cap; k++) {
      if (k > 0) {
        for (const idx of cells) residual[idx] -= 1;
        path.push(i);
      }
      rec(i + 1, area + k * cells.length);
    }
    for (let k = 0; k < cap; k++) {
      path.pop();
      for (const idx of cells) residual[idx] += 1;
    }
  };
  rec(0, 0);

  const key = (s: Rect[]) =>
    canonicalize(s)
      .map((r) => [r.top, r.left, r.height, r.width])
      .map((t) => t.join(','))
      .join('|');
  // 去重（同一规范方案可能由不同顺序产生）
  const uniq = [...new Map(solutions.map((s) => [key(s), canonicalize(s)])).values()];
  uniq.sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    for (let i = 0; i < a.length; i++) {
      const c = compareRect(a[i], b[i]);
      if (c !== 0) return c;
    }
    return 0;
  });
  return { uniq, totalCount: solutions.length };
}

describe('buildPlacements', () => {
  it('按 (top,left,height,width) 排序且去重', () => {
    const ps = buildPlacements(
      [
        { height: 2, width: 2 },
        { height: 2, width: 2 },
      ],
      3,
      3,
    );
    expect(ps).toHaveLength(4);
    expect(ps).toEqual([
      { top: 0, left: 0, height: 2, width: 2 },
      { top: 0, left: 1, height: 2, width: 2 },
      { top: 1, left: 0, height: 2, width: 2 },
      { top: 1, left: 1, height: 2, width: 2 },
    ]);
  });

  it('排除越界尺寸', () => {
    expect(buildPlacements([{ height: 3, width: 1 }], 2, 2)).toHaveLength(0);
    expect(buildPlacements([{ height: 1, width: 3 }], 2, 2)).toHaveLength(0);
  });
});

describe('validateDose', () => {
  it('接受合法图', () => {
    expect(validateDose([
      [0, 1],
      [4, 3],
    ]).ok).toBe(true);
  });
  it('拒绝越界数值/尺寸/总剂量', () => {
    expect(validateDose([[1, 1]]).ok).toBe(false); // 行数
    expect(validateDose([[1], [1]]).ok).toBe(false); // 列数
    expect(validateDose([
      [5, 0],
      [0, 0],
    ]).ok).toBe(false);
    // 3×3 全 4：总剂量恰好 36，合法
    expect(
      validateDose([
        [4, 4, 4],
        [4, 4, 4],
        [4, 4, 4],
      ]).ok,
    ).toBe(true);
    expect(
      validateDose([
        [4, 4, 4, 4],
        [4, 4, 4, 4],
        [4, 4, 4, 1],
      ]).ok,
    ).toBe(false); // 37
  });
});

describe('validateApertures', () => {
  it('去重并拒绝非法孔径', () => {
    const r = validateApertures(
      [
        { height: 1, width: 1 },
        { height: 1, width: 1 },
      ],
      2,
      2,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.list).toHaveLength(1);
    expect(validateApertures([], 2, 2).ok).toBe(false);
    expect(validateApertures([{ height: 0, width: 1 }], 2, 2).ok).toBe(false);
    expect(validateApertures([{ height: 3, width: 1 }], 2, 2).ok).toBe(false);
  });
});

describe('solve - 基本情形', () => {
  it('单孔径全覆盖：唯一解 1 发', () => {
    const r = solve(
      [
        [1, 1],
        [1, 1],
      ],
      [{ height: 2, width: 2 }],
    );
    expect(r.status).toBe('unique');
    expect(r.shots).toBe(1);
    expect(r.best).toEqual([{ top: 0, left: 0, height: 2, width: 2 }]);
  });

  it('零剂量图：0 发唯一解', () => {
    const r = solve(
      [
        [0, 0],
        [0, 0],
      ],
      [{ height: 1, width: 1 }],
    );
    expect(r.status).toBe('unique');
    expect(r.shots).toBe(0);
    expect(r.enumerated).toBe(1);
  });

  it('大孔径会覆盖零格 → 不可实现', () => {
    const r = solve(
      [
        [1, 0],
        [0, 0],
      ],
      [{ height: 2, width: 2 }],
    );
    expect(r.status).toBe('infeasible');
    expect(r.best).toEqual([]);
  });

  it('不得不过曝时判不可实现（禁止过曝）', () => {
    const r = solve(
      [
        [1, 1],
        [1, 0],
      ],
      [{ height: 2, width: 2 }],
    );
    expect(r.status).toBe('infeasible');
  });

  it('单像素孔径总能实现', () => {
    const grid = [
      [1, 0],
      [0, 1],
    ];
    const r = solve(grid, [{ height: 1, width: 1 }]);
    expect(r.status).toBe('unique');
    expect(r.shots).toBe(2);
    const { accumulated, remaining } = simulate(grid, r.best, r.shots);
    expect(accumulated).toEqual(grid);
    expect(remaining).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('优先少发数：2×2 两发优于 1×1 八发', () => {
    const grid = [
      [2, 2],
      [2, 2],
    ];
    const r = solve(grid, [
      { height: 1, width: 1 },
      { height: 2, width: 2 },
    ]);
    expect(r.shots).toBe(2);
    expect(r.best.every((x) => x.height === 2 && x.width === 2)).toBe(true);
  });
});

describe('solve - 并列与字典序', () => {
  it('横排/竖排两种两发方案并列，取字典序前两名', () => {
    const grid = [
      [1, 1],
      [1, 1],
    ];
    const r = solve(grid, [
      { height: 1, width: 2 },
      { height: 2, width: 1 },
    ]);
    expect(r.status).toBe('tie');
    expect(r.shots).toBe(2);
    // 字典序：height=1 的横排先于 height=2 的竖排
    expect(r.best).toEqual([
      { top: 0, left: 0, height: 1, width: 2 },
      { top: 1, left: 0, height: 1, width: 2 },
    ]);
    expect(r.second).toEqual([
      { top: 0, left: 0, height: 2, width: 1 },
      { top: 0, left: 1, height: 2, width: 1 },
    ]);
  });

  it('方案均已规范化（非降元组）', () => {
    const grid = [
      [2, 1],
      [1, 2],
    ];
    const r = solve(grid, [
      { height: 1, width: 1 },
      { height: 2, width: 2 },
    ]);
    const sorted = canonicalize(r.best);
    expect(r.best).toEqual(sorted);
  });

  it('重复击发允许且会被使用', () => {
    const r = solve(
      [
        [3, 3],
        [3, 3],
      ],
      [{ height: 2, width: 2 }],
    );
    expect(r.shots).toBe(3);
    expect(r.best).toHaveLength(3);
  });
});

describe('solve - 贪心陷阱', () => {
  it('贪心选大孔径会封死区域时，穷举得到全局最优', () => {
    // 3×3：四角与中心为 0，十字为 1。
    // 2×2 大孔径任意放置都会盖住某个 0 格 → 不可用；
    // “贪心先上大孔径”直接无解，但穷举应回退到 1×2 / 2×1 条带：4 发。
    const grid = [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ];
    const r = solve(grid, [
      { height: 2, width: 2 },
      { height: 1, width: 2 },
      { height: 2, width: 1 },
      { height: 1, width: 1 },
    ]);
    expect(r.status).not.toBe('infeasible');
    expect(r.shots).toBe(4);
    // 任何 2×2 都不应出现在最优解中
    expect(
      r.best.some((x) => x.height === 2 && x.width === 2),
    ).toBe(false);
    // 结果必须精确命中目标、无过曝
    const { accumulated, remaining } = simulate(grid, r.best, r.shots);
    expect(accumulated).toEqual(grid);
    expect(remaining.flat().every((v) => v === 0)).toBe(true);
  });
});

describe('simulate', () => {
  it('逐发累计与剩余正确', () => {
    const grid = [
      [1, 1],
      [1, 1],
    ];
    const shots = [{ top: 0, left: 0, height: 2, width: 2 }];
    expect(simulate(grid, shots, 0)).toEqual({
      accumulated: [
        [0, 0],
        [0, 0],
      ],
      remaining: grid,
    });
    expect(simulate(grid, shots, 1).accumulated).toEqual(grid);
  });
});

describe('随机对拍（独立参考枚举器）', () => {
  // 简易确定性 PRNG
  function mulberry(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const dims: Array<[number, number]> = [
    [2, 2],
    [2, 3],
    [3, 2],
    [2, 4],
    [3, 3],
  ];

  for (let seed = 1; seed <= 120; seed++) {
    const rand = mulberry(seed * 7919 + 13);
    const [rows, cols] = dims[Math.floor(rand() * dims.length)];
    // 生成总剂量 ≤36 的随机图
    let grid: number[][];
    do {
      grid = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => Math.floor(rand() * 5)),
      );
    } while (grid.flat().reduce((a, b) => a + b, 0) > 36);

    const apSet = new Set<string>();
    const aps: Aperture[] = [];
    const kinds = 1 + Math.floor(rand() * 3); // 1..3 种孔径
    while (aps.length < kinds) {
      const h = 1 + Math.floor(rand() * rows);
      const w = 1 + Math.floor(rand() * cols);
      const key = `${h}x${w}`;
      if (!apSet.has(key)) {
        apSet.add(key);
        aps.push({ height: h, width: w });
      }
    }

    it(`seed=${seed} ${rows}x${cols} aps=[${aps.map((a) => `${a.height}x${a.width}`).join(',')}]`, () => {
      const r = solve(grid, aps);
      const ref = referenceSolve(grid, aps);
      if (ref.uniq.length === 0) {
        expect(r.status).toBe('infeasible');
        expect(r.shots).toBe(0);
      } else {
        expect(r.status === 'unique' || r.status === 'tie').toBe(true);
        expect(r.shots).toBe(ref.uniq[0].length);
        expect(r.best).toEqual(ref.uniq[0]);
        const isTie =
          ref.uniq.length > 1 && ref.uniq[1].length === ref.uniq[0].length;
        expect(r.status).toBe(isTie ? 'tie' : 'unique');
        if (isTie) expect(r.second).toEqual(ref.uniq[1]);
        // 物理校验：累计剂量精确等于目标（无过曝、无欠曝）
        const { accumulated } = simulate(grid, r.best, r.best.length);
        expect(accumulated).toEqual(grid);
      }
    });
  }
});
