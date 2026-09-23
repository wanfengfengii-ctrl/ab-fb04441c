/** 允许孔径：矩形的高与宽（正整数，不得越界） */
export interface Aperture {
  height: number;
  width: number;
}

/** 一次击发：孔径矩形在剂量图上的具体放置（零基 top/left） */
export interface Placement {
  top: number;
  left: number;
  height: number;
  width: number;
}

/** 工艺输入：整数剂量图 + 允许孔径集合 */
export interface ProblemInput {
  rows: number;
  cols: number;
  cells: number[][];
  apertures: Aperture[];
}

export type SolveStatus = 'unique' | 'tied' | 'infeasible';

export interface SolveStats {
  /** 去重后的可行放置总数 */
  placements: number;
  /** 完整比较过程中访问的状态数（体现穷举规模） */
  states: number;
}

export interface SolveResult {
  status: SolveStatus;
  /** 最少击发次数；不可实现时为 0 */
  shotCount: number;
  /**
   * 规范方案：每份方案内的击发已按 (top, left, height, width) 元组升序排列；
   * 唯一解给 1 份，并列最优给字典序最小的前 2 份，不可实现给 0 份。
   */
  solutions: Placement[][];
  stats: SolveStats;
}
