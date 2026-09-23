import { solve } from '../solver/solve';
import type { ProblemInput, SolveResult } from '../solver/types';

/**
 * 在 Web Worker 中运行求解，避免大图穷举时阻塞界面。
 * 全部计算仍在浏览器本地完成，不发出任何网络请求。
 */
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent<ProblemInput>) => void) | null;
  postMessage: (result: SolveResult) => void;
};

scope.onmessage = (e) => {
  scope.postMessage(solve(e.data));
};
