import { useMemo } from 'react';
import type { ProblemInput, SolveResult } from '../solver/types';
import { DoseGrid } from './DoseGrid';

interface ResultPanelProps {
  result: SolveResult;
  problem: ProblemInput;
  solutionIdx: number;
  onSolutionIdxChange: (i: number) => void;
  step: number;
  onStepChange: (s: number) => void;
}

const STATUS_TEXT = {
  unique: '唯一最优方案',
  tied: '并列最优',
  infeasible: '不可实现',
} as const;

/** 综合结果：状态、击发序列与逐次击发查看器 */
export function ResultPanel({ result, problem, solutionIdx, onSolutionIdxChange, step, onStepChange }: ResultPanelProps) {
  const { rows, cols, cells } = problem;
  const solution = result.solutions[Math.min(solutionIdx, result.solutions.length - 1)];
  const k = solution?.length ?? 0;
  const clampedStep = Math.min(step, k);

  const cumulative = useMemo(() => {
    const acc = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
    if (solution) {
      for (let s = 0; s < clampedStep; s++) {
        const p = solution[s];
        for (let r = p.top; r < p.top + p.height; r++) {
          for (let c = p.left; c < p.left + p.width; c++) acc[r][c]++;
        }
      }
    }
    return acc;
  }, [solution, clampedStep, rows, cols]);

  const remaining = useMemo(
    () => cells.map((row, r) => row.map((v, c) => v - cumulative[r][c])),
    [cells, cumulative],
  );

  const highlight = useMemo(() => {
    const set = new Set<string>();
    if (solution && clampedStep >= 1) {
      const p = solution[clampedStep - 1];
      for (let r = p.top; r < p.top + p.height; r++) {
        for (let c = p.left; c < p.left + p.width; c++) set.add(`${r},${c}`);
      }
    }
    return set;
  }, [solution, clampedStep]);

  const totalDose = cells.flat().reduce((a, b) => a + b, 0);
  const remainingTotal = remaining.flat().reduce((a, b) => a + b, 0);
  const currentShot = solution && clampedStep >= 1 ? solution[clampedStep - 1] : null;

  return (
    <div className="result-panel">
      <div className={`status-banner status-${result.status}`}>
        <strong>{STATUS_TEXT[result.status]}</strong>
        {result.status !== 'infeasible' && <span>最少击发 {result.shotCount} 次</span>}
        {result.status === 'tied' && <span>存在多份最优方案，以下为字典序最小的前两份</span>}
        {result.status === 'infeasible' && <span>给定孔径无法在不超曝的前提下精确叠加出目标剂量</span>}
      </div>

      <div className="stats-line">
        已完整比较全部可行多重集：可行放置 {result.stats.placements} 种 · 枚举状态 {result.stats.states} 个
      </div>

      {result.status === 'tied' && result.solutions.length >= 2 && (
        <div className="solution-tabs" role="tablist">
          {result.solutions.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={solutionIdx === i}
              className={`btn btn-small ${solutionIdx === i ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => onSolutionIdxChange(i)}
            >
              方案 {i + 1}（字典序第 {i + 1}）
            </button>
          ))}
        </div>
      )}

      {solution && (
        <>
          <div className="stepper">
            <div className="stepper-buttons">
              <button type="button" className="btn btn-ghost" disabled={clampedStep === 0} onClick={() => onStepChange(0)}>
                ⏮ 起始
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={clampedStep === 0}
                onClick={() => onStepChange(clampedStep - 1)}
              >
                ◀ 上一次
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={clampedStep >= k}
                onClick={() => onStepChange(clampedStep + 1)}
              >
                击发 ▶
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={clampedStep >= k}
                onClick={() => onStepChange(k)}
              >
                结束 ⏭
              </button>
            </div>
            <div className="step-info">
              {k === 0 && '目标剂量全为零，无需击发'}
              {k > 0 && clampedStep === 0 && '尚未击发：显示目标剂量'}
              {clampedStep >= 1 && currentShot && (
                <>
                  第 {clampedStep}/{k} 次击发：
                  <code>
                    (top={currentShot.top}, left={currentShot.left}, height={currentShot.height}, width=
                    {currentShot.width})
                  </code>
                </>
              )}
              {clampedStep === k && k > 0 && ' —— 全部击发完成'}
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: k === 0 ? '100%' : `${(clampedStep / k) * 100}%` }} />
            </div>
          </div>

          <div className="grids-row">
            <DoseGrid values={cells} caption="目标剂量" tone="target" highlight={highlight} footer={`总计 ${totalDose}`} />
            <DoseGrid
              values={cumulative}
              caption={`累计剂量（${clampedStep} 次击发后）`}
              tone="cumulative"
              highlight={highlight}
              footer={`总计 ${totalDose - remainingTotal}`}
            />
            <DoseGrid
              values={remaining}
              caption="剩余剂量"
              tone="remaining"
              highlight={highlight}
              footer={`总计 ${remainingTotal}`}
            />
          </div>

          {k > 0 && (
            <table className="shot-table">
            <thead>
              <tr>
                <th>#</th>
                <th>top</th>
                <th>left</th>
                <th>height</th>
                <th>width</th>
              </tr>
            </thead>
            <tbody>
              {solution.map((p, i) => (
                <tr
                  key={i}
                  className={i === clampedStep - 1 ? 'active' : i < clampedStep ? 'done' : ''}
                  onClick={() => onStepChange(i + 1)}
                  title="点击跳转到该次击发"
                >
                  <td>{i + 1}</td>
                  <td>{p.top}</td>
                  <td>{p.left}</td>
                  <td>{p.height}</td>
                  <td>{p.width}</td>
                </tr>
              ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
