/**
 * 纯本地穷举求解器。
 *
 * 问题：在 rows×cols 剂量图上，允许使用有限种“矩形孔径”（每种孔径可
 * 放置在任何不越界的位置），一次击发给所覆盖格子各加 1 单位剂量。
 * 求击发次数最少、且规范化后字典序最小的方案；不得过曝。
 *
 * 关键事实：
 *  - 每发 = 一个放置矩形 r = [top,left,height,width]，所有合法放置构成
 *    有限“模板”集合 T。方案就是 T 上的多重集（每发重复允许）。
 *  - 模板按 (top,left,height,width) 全序编号；任何方案规范化为非降编号
 *    序列后即与“多重集”一一对应，故“对整份列表取字典序”等价于：
 *    在最少发数下取编号向量字典序最小者。
 *  - 完整比较所有可行多重集 = 对 x_t∈{0,1,2,…} 完整枚举所有满足
 *    A x = target 且不产生过曝的计数向量。总剂量 ≤ 36，单发面积 ≥ 1，
 *    故发数上界为 36，搜索空间有限。
 */

export interface Rect {
  top: number;
  left: number;
  height: number;
  width: number;
}

export interface Aperture {
  height: number;
  width: number;
}

export type Status = 'unique' | 'tie' | 'infeasible';

export interface SolveResult {
  status: Status;
  /** 最优方案（不可行时为空数组） */
  best: Rect[];
  /** 并列最优的第二份规范方案；仅 status === 'tie' 时存在 */
  second: Rect[];
  shots: number;
  /** 引擎实际完整枚举过的可行多重集数量 */
  enumerated: number;
}

/** 字典序比较矩形元组 (top,left,height,width)：a<b 返回负数 */
export function compareRect(a: Rect, b: Rect): number {
  return (
    a.top - b.top ||
    a.left - b.left ||
    a.height - b.height ||
    a.width - b.width
  );
}

/** 规范化：击发按零基 (top,left,height,width) 字典序非降排列 */
export function canonicalize(shots: Rect[]): Rect[] {
  return [...shots].sort(compareRect);
}

/** 判断矩形在 rows×cols 网格上是否越界 */
export function inBounds(r: Rect, rows: number, cols: number): boolean {
  return (
    r.top >= 0 &&
    r.left >= 0 &&
    r.height >= 1 &&
    r.width >= 1 &&
    r.top + r.height <= rows &&
    r.left + r.width <= cols
  );
}

/**
 * 由允许孔径生成全部合法放置模板，按元组字典序排序。
 * 同尺寸去重；越界尺寸直接排除。
 */
export function buildPlacements(
  apertures: Aperture[],
  rows: number,
  cols: number,
): Rect[] {
  const seen = new Set<string>();
  const out: Rect[] = [];
  for (const ap of apertures) {
    const h = ap.height;
    const w = ap.width;
    if (!Number.isInteger(h) || !Number.isInteger(w)) continue;
    if (h < 1 || w < 1 || h > rows || w > cols) continue;
    for (let top = 0; top + h <= rows; top++) {
      for (let left = 0; left + w <= cols; left++) {
        const key = `${top},${left},${h},${w}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ top, left, height: h, width: w });
        }
      }
    }
  }
  return out.sort(compareRect);
}

/** 把矩形覆盖的格子展开为一维下标 [r*cols+c, ...] */
export function cellsOf(r: Rect, cols: number): number[] {
  const cells: number[] = [];
  for (let i = 0; i < r.height; i++) {
    const base = (r.top + i) * cols + r.left;
    for (let j = 0; j < r.width; j++) cells.push(base + j);
  }
  return cells;
}

/** 校验剂量图：2..5 行、2..6 列，每格 0..4 整数，总剂量 ≤ 36 */
export function validateDose(
  grid: number[][],
): { ok: true; rows: number; cols: number } | { ok: false; error: string } {
  const rows = grid.length;
  if (rows < 2 || rows > 5) {
    return { ok: false, error: `行数需在 2~5 之间（当前 ${rows}）` };
  }
  const cols = grid[0]?.length ?? 0;
  if (cols < 2 || cols > 6) {
    return { ok: false, error: `列数需在 2~6 之间（当前 ${cols}）` };
  }
  let total = 0;
  for (let r = 0; r < rows; r++) {
    if (grid[r].length !== cols) {
      return { ok: false, error: `第 ${r + 1} 行列数不一致` };
    }
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c];
      if (!Number.isInteger(v) || v < 0 || v > 4) {
        return {
          ok: false,
          error: `剂量格 (${r + 1},${c + 1}) 必须是 0~4 的整数（当前 ${v}）`,
        };
      }
      total += v;
    }
  }
  if (total > 36) {
    return { ok: false, error: `总剂量不得超过 36（当前 ${total}）` };
  }
  return { ok: true, rows, cols };
}

/** 校验允许孔径：1..8 种、正整数、可放入网格；返回去重后的尺寸 */
export function validateApertures(
  apertures: Aperture[],
  rows: number,
  cols: number,
): { ok: true; list: Aperture[] } | { ok: false; error: string } {
  if (apertures.length < 1 || apertures.length > 8) {
    return {
      ok: false,
      error: `允许孔径需在 1~8 种之间（当前 ${apertures.length}）`,
    };
  }
  const seen = new Set<string>();
  const list: Aperture[] = [];
  for (let i = 0; i < apertures.length; i++) {
    const { height, width } = apertures[i];
    if (
      !Number.isInteger(height) ||
      !Number.isInteger(width) ||
      height < 1 ||
      width < 1
    ) {
      return {
        ok: false,
        error: `第 ${i + 1} 种孔径的宽高必须为正整数（当前 ${height}×${width}）`,
      };
    }
    if (height > rows || width > cols) {
      return {
        ok: false,
        error: `第 ${i + 1} 种孔径 ${height}×${width} 超出网格 ${rows}×${cols}，必然越界`,
      };
    }
    const key = `${height}x${width}`;
    if (!seen.has(key)) {
      seen.add(key);
      list.push({ height, width });
    }
  }
  return { ok: true, list };
}

/**
 * 完整枚举所有可行多重集并返回规范最优解。
 *
 * 方法：对按元组排序后的放置模板做有界多重集计数 DFS（每个多重集恰好
 * 枚举一次），用剩余剂量做可行性剪枝，逐发检查过曝。叶节点处比较：
 * 先比击发次数（path 长度），再比编号向量字典序，保留前两名。
 */
export function solve(grid: number[][], apertures: Aperture[]): SolveResult {
  const vg = validateDose(grid);
  if (!vg.ok) throw new Error(vg.error);
  const va = validateApertures(apertures, vg.rows, vg.cols);
  if (!va.ok) throw new Error(va.error);

  const rows = vg.rows;
  const cols = vg.cols;
  const total = grid.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);

  if (total === 0) {
    // 零剂量图：唯一最优是空方案（0 发）
    return {
      status: 'unique',
      best: [],
      second: [],
      shots: 0,
      enumerated: 1,
    };
  }

  const placements = buildPlacements(va.list, rows, cols);
  const T = placements.length;
  const pCells = placements.map((r) => cellsOf(r, cols));
  const pArea = placements.map((r) => r.height * r.width);

  // 剩余剂量：初始即目标，DFS 中逐发扣除（cap 保证永不为负）
  const n = rows * cols;
  const rem = new Int32Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) rem[r * cols + c] = grid[r][c];
  }

  // 后缀模板可覆盖格子的并集（剪枝：正剂量格必须能被剩余模板覆盖）
  const suffixCover: Uint8Array[] = new Array(T + 1);
  suffixCover[T] = new Uint8Array(n);
  for (let t = T - 1; t >= 0; t--) {
    const cov = suffixCover[t + 1].slice();
    for (const idx of pCells[t]) cov[idx] = 1;
    suffixCover[t] = cov;
  }
  // 后缀最大单发面积（发数下界剪枝）
  const suffixMaxArea = new Int32Array(T + 1);
  for (let t = T - 1; t >= 0; t--) {
    suffixMaxArea[t] = Math.max(suffixMaxArea[t + 1], pArea[t]);
  }

  const state: {
    enumerated: number;
    bestCount: number;
    best: number[] | null;
    second: number[] | null;
  } = {
    enumerated: 0,
    bestCount: Infinity,
    best: null,
    second: null,
  };

  function accept(path: number[]): void {
    state.enumerated++;
    const sol = path.slice();
    if (state.best === null || sol.length < state.bestCount) {
      // 发现更少发数的新最优：旧“第二”作废，并列需重新判定
      state.best = sol;
      state.bestCount = sol.length;
      state.second = null;
    } else if (sol.length === state.bestCount) {
      const cur = state.best;
      if (cur !== null && lexLess(sol, cur)) {
        state.second = cur;
        state.best = sol;
      } else if (state.second === null || lexLess(sol, state.second)) {
        state.second = sol;
      }
    }
  }

  /** 同长度编号向量字典序比较 */
  function lexLess(a: number[], b: number[]): boolean {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] < b[i];
    }
    return false;
  }

  /**
   * @param t     当前模板编号
   * @param count 已击发次数
   * @param area  已投放总剂量（各发面积之和）
   * @param path  已选模板编号（非降）
   *
   * 进入时 rem 反映编号 <t 的模板已施加后的剩余剂量。
   */
  function dfs(t: number, count: number, area: number, path: number[]): void {
    const areaLeft = total - area;
    if (areaLeft === 0) {
      accept(path);
      return;
    }
    if (t >= T) return;

    // 正剂量格必须能被编号 ≥t 的模板覆盖，否则该格剂量永远无法补齐
    const cov = suffixCover[t];
    for (let idx = 0; idx < n; idx++) {
      if (rem[idx] > 0 && !cov[idx]) return;
    }
    // 发数下界：剩余总剂量 / 后缀最大单发面积；只可能严格大于当前最优时剪枝
    // （等于时仍可能产生并列第二份方案，必须保留）
    if (count + Math.ceil(areaLeft / suffixMaxArea[t]) > state.bestCount) return;

    // k 上界：不得过曝（覆盖格最小剩余剂量），且面积不超过剩余需求
    let cap = Math.floor(areaLeft / pArea[t]);
    for (const idx of pCells[t]) {
      if (rem[idx] < cap) cap = rem[idx];
    }

    // 先施加 cap 发，再降序枚举 k=cap..0，每轮结束回滚一发。
    // 降序可尽快遇到少发数方案以收紧 bestCount（枚举完整性不受顺序影响）。
    for (let u = 0; u < cap; u++) {
      path.push(t);
      for (const idx of pCells[t]) rem[idx] -= 1;
    }
    for (let k = cap; k >= 0; k--) {
      dfs(t + 1, count + k, area + k * pArea[t], path);
      if (k > 0) {
        path.pop();
        for (const idx of pCells[t]) rem[idx] += 1;
      }
    }
  }

  dfs(0, 0, 0, []);

  if (state.best === null) {
    return {
      status: 'infeasible',
      best: [],
      second: [],
      shots: 0,
      enumerated: state.enumerated,
    };
  }
  const bestPlan = state.best;
  const secondPlan = state.second;
  const toRects = (p: number[]) => p.map((t) => placements[t]);
  return {
    status: secondPlan !== null ? 'tie' : 'unique',
    best: toRects(bestPlan),
    second: secondPlan !== null ? toRects(secondPlan) : [],
    shots: bestPlan.length,
    enumerated: state.enumerated,
  };
}

/**
 * 逐步推演：方案前 upTo 发后的累计剂量与剩余剂量。
 */
export function simulate(
  grid: number[][],
  shots: Rect[],
  upTo: number,
): { accumulated: number[][]; remaining: number[][] } {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const accumulated = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );
  for (let s = 0; s < Math.min(upTo, shots.length); s++) {
    const r = shots[s];
    for (let i = 0; i < r.height; i++) {
      for (let j = 0; j < r.width; j++) {
        accumulated[r.top + i][r.left + j] += 1;
      }
    }
  }
  const remaining = grid.map((row, i) =>
    row.map((v, j) => v - accumulated[i][j]),
  );
  return { accumulated, remaining };
}
