import type { Placement, ProblemInput, SolveResult } from './types';
import { buildPlacements } from './placements';

interface NodeInfo {
  /** 从该状态精确凑齐剩余剂量所需的最少击发次数 */
  count: number;
  /** 达到最少次数的不同多重集数量（截断到 2，足以区分唯一 / 并列） */
  ways: number;
}

/** 状态编码分半：前 15 格与后 15 格各编为一个 base-5 整数（5^15 < 2^35，安全） */
const SPLIT = 15;
const POW5: number[] = (() => {
  const p = [1];
  for (let k = 1; k < SPLIT; k++) p.push(p[k - 1] * 5);
  return p;
})();
const KEY1_STRIDE = 2 ** 35; // > 5^15，用于把放置编号并入一级键

/**
 * 完整比较所有可行击发多重集的精确求解器。
 *
 * 模型：每种可行放置是一个 0/1 向量，击发多重集是其非负整数组合，
 * 要求逐格恰好等于目标剂量（不得过曝），重复击发允许。
 *
 * 方法：把放置按 (top, left, height, width) 规范序编号 0..n-1，
 * 用带记忆化的递归按编号顺序决定每种放置的使用次数 x_i（0..覆盖格最小剩余剂量），
 * 每个多重集恰好被枚举一次；状态 (剩余剂量向量, 起始编号) 记忆化，
 * 返回该状态下的最少击发次数与达到该次数的多重集数（截断到 2）。
 *
 * 性能：剩余剂量以 base-5 双整数增量编码作为记忆键；每格需求用位掩码维护，
 * 配合“编号 ≥ i 的放置已无法覆盖的格”掩码 watch[i] 做 O(1) 死路剪枝。
 *
 * 字典序：方案按元组升序排列后，含更多小号元组者字典序更小，
 * 因此枚举方案时在每层从大到小尝试 x_i 即按字典序产出。
 */
export function solve(problem: ProblemInput): SolveResult {
  const { rows, cols, cells } = problem;
  const placements = buildPlacements(rows, cols, problem.apertures);
  const n = placements.length;
  const cellCount = rows * cols;

  // 每个放置覆盖的格（行主序下标）
  const cover: number[][] = placements.map((p) => {
    const list: number[] = [];
    for (let r = p.top; r < p.top + p.height; r++) {
      for (let c = p.left; c < p.left + p.width; c++) list.push(r * cols + c);
    }
    return list;
  });

  // latest[c]：覆盖格 c 的最大放置编号
  const latest = new Int32Array(cellCount).fill(-1);
  placements.forEach((_, i) => {
    for (const cell of cover[i]) latest[cell] = i;
  });

  // watch[i]：位掩码，所有满足 latest[c] < i 的格 c——这些格在编号 ≥ i 时已无法被覆盖
  const watch = new Uint32Array(n + 1);
  {
    const byLatest = new Uint32Array(Math.max(n, 1));
    for (let c = 0; c < cellCount; c++) {
      if (latest[c] >= 0) byLatest[latest[c]] |= 1 << c;
    }
    let acc = 0;
    for (let i = 0; i <= n; i++) {
      watch[i] = acc;
      if (i < n) acc |= byLatest[i];
    }
  }

  const target = new Uint8Array(cellCount);
  cells.forEach((row, r) => row.forEach((v, c) => {
    target[r * cols + c] = v;
  }));

  // 快速不可实现判定：需求格无任何放置覆盖
  for (let c = 0; c < cellCount; c++) {
    if (target[c] > 0 && latest[c] < 0) {
      return { status: 'infeasible', shotCount: 0, solutions: [], stats: { placements: n, states: 0 } };
    }
  }

  // ---- 可变求解状态（dp 与枚举共用，严格成对增减保证复原） ----
  const v = new Uint8Array(target);
  let nzMask = 0; // 剩余需求 > 0 的格位掩码
  let e0 = 0; // 格 0..14 的 base-5 编码
  let e1 = 0; // 格 15..29 的 base-5 编码
  for (let c = 0; c < cellCount; c++) {
    if (v[c] > 0) {
      nzMask |= 1 << c;
      if (c < SPLIT) e0 += v[c] * POW5[c];
      else e1 += v[c] * POW5[c - SPLIT];
    }
  }

  const dec = (cell: number): void => {
    v[cell]--;
    if (v[cell] === 0) nzMask &= ~(1 << cell);
    if (cell < SPLIT) e0 -= POW5[cell];
    else e1 -= POW5[cell - SPLIT];
  };
  const inc = (cell: number): void => {
    if (v[cell] === 0) nzMask |= 1 << cell;
    v[cell]++;
    if (cell < SPLIT) e0 += POW5[cell];
    else e1 += POW5[cell - SPLIT];
  };

  const memo = new Map<number, Map<number, NodeInfo | null>>();
  let states = 0;

  function dp(i: number): NodeInfo | null {
    if ((nzMask & watch[i]) !== 0) return null; // 有格已无法被剩余放置覆盖
    if (nzMask === 0) return { count: 0, ways: 1 };
    if (i >= n) return null;

    const key1 = i * KEY1_STRIDE + e0;
    let inner = memo.get(key1);
    if (inner !== undefined) {
      const hit = inner.get(e1);
      if (hit !== undefined) return hit;
    }
    states++;

    // 放置 i 最多可使用的次数：受覆盖格中最小剩余剂量限制（保证不过曝）
    let maxCnt = Infinity;
    for (const cell of cover[i]) if (v[cell] < maxCnt) maxCnt = v[cell];

    let best: NodeInfo | null = null;
    for (let cnt = 0; cnt <= maxCnt; cnt++) {
      if (cnt > 0) for (const cell of cover[i]) dec(cell);
      const child = dp(i + 1);
      if (child) {
        const total = cnt + child.count;
        if (!best || total < best.count) {
          best = { count: total, ways: child.ways };
        } else if (total === best.count) {
          best.ways = Math.min(2, best.ways + child.ways);
        }
      }
    }
    // 复原：循环中共减量 maxCnt 次（maxCnt 为 0 时未减量）
    for (let k = 0; k < maxCnt; k++) for (const cell of cover[i]) inc(cell);

    if (inner === undefined) {
      inner = new Map();
      memo.set(key1, inner);
    }
    inner.set(e1, best);
    return best;
  }

  const root = dp(0);
  if (!root) {
    return { status: 'infeasible', shotCount: 0, solutions: [], stats: { placements: n, states } };
  }

  /** 与 dp 的提前返回对齐的只读查询（全零状态不入 memo，即时合成） */
  const infoAt = (i: number): NodeInfo | null => {
    if (nzMask === 0) return { count: 0, ways: 1 };
    if ((nzMask & watch[i]) !== 0) return null;
    if (i >= n) return null;
    const inner = memo.get(i * KEY1_STRIDE + e0);
    return inner?.get(e1) ?? null;
  };

  /**
   * 按字典序枚举前 limit 份规范方案。
   * 每层从大到小尝试放置 i 的使用次数：小号元组出现越多，排序后的列表字典序越小。
   */
  function enumerate(limit: number): Placement[][] {
    const out: Placement[][] = [];
    const prefix: number[] = [];

    function rec(i: number): void {
      if (out.length >= limit) return;
      if (nzMask === 0) {
        out.push(prefix.map((idx) => placements[idx]));
        return;
      }
      const cur = infoAt(i);
      if (!cur) return;

      let maxCnt = Infinity;
      for (const cell of cover[i]) if (v[cell] < maxCnt) maxCnt = v[cell];

      for (let cnt = maxCnt; cnt >= 0; cnt--) {
        for (let k = 0; k < cnt; k++) for (const cell of cover[i]) dec(cell);
        const child = infoAt(i + 1);
        if (child && cnt + child.count === cur.count) {
          for (let k = 0; k < cnt; k++) prefix.push(i);
          rec(i + 1);
          prefix.length -= cnt;
        }
        for (let k = 0; k < cnt; k++) for (const cell of cover[i]) inc(cell);
        if (out.length >= limit) return;
      }
    }

    rec(0);
    return out;
  }

  const tied = root.ways >= 2;
  const solutions = enumerate(tied ? 2 : 1);
  return {
    status: tied ? 'tied' : 'unique',
    shotCount: root.count,
    solutions,
    stats: { placements: n, states },
  };
}
