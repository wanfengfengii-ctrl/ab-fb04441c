import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Aperture, ProblemInput, SolveResult } from './solver/types';
import { validateProblem, LIMITS } from './solver/validate';
import { solve } from './solver/solve';
import { parseProblemJson, serializeProblem, IMPORT_EXAMPLE } from './solver/serialize';
import { GridEditor } from './components/GridEditor';
import { ApertureEditor } from './components/ApertureEditor';
import { ResultPanel } from './components/ResultPanel';

interface Outcome {
  result: SolveResult;
  problem: ProblemInput;
  key: string;
}

/** 演示用例：3×4 剂量图配四种孔径的综合场景 */
const SAMPLE: ProblemInput = {
  rows: 3,
  cols: 4,
  cells: [
    [1, 2, 2, 1],
    [2, 3, 3, 2],
    [1, 2, 2, 1],
  ],
  apertures: [
    { height: 1, width: 1 },
    { height: 1, width: 2 },
    { height: 2, width: 1 },
    { height: 2, width: 2 },
  ],
};

export default function App() {
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [cells, setCells] = useState<number[][]>(() => [
    [1, 1],
    [1, 1],
  ]);
  const [apertures, setApertures] = useState<Aperture[]>([
    { height: 1, width: 2 },
    { height: 2, width: 1 },
  ]);

  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [solving, setSolving] = useState(false);
  const [solveError, setSolveError] = useState('');
  const [solutionIdx, setSolutionIdx] = useState(0);
  const [step, setStep] = useState(0);

  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importNotice, setImportNotice] = useState('');

  const problem: ProblemInput = useMemo(
    () => ({ rows, cols, cells, apertures }),
    [rows, cols, cells, apertures],
  );
  const inputKey = useMemo(() => JSON.stringify(problem), [problem]);
  const errors = useMemo(() => validateProblem(problem), [problem]);
  const totalDose = useMemo(
    () => cells.flat().reduce((a, b) => a + (Number.isInteger(b) ? b : 0), 0),
    [cells],
  );

  // 任何输入改动都立即撤下旧结论
  useEffect(() => {
    setOutcome(null);
    setStep(0);
    setSolutionIdx(0);
    setSolveError('');
  }, [inputKey]);

  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  useEffect(() => () => workerRef.current?.terminate(), []);

  const runSolve = useCallback(() => {
    const key = inputKey;
    const snapshot = problem;
    const seq = ++seqRef.current;
    setSolving(true);
    setSolveError('');

    const deliver = (result: SolveResult) => {
      if (seqRef.current !== seq) return; // 已有更新的输入/请求，丢弃过期结论
      setOutcome({ result, problem: snapshot, key });
      setSolving(false);
      setStep(0);
      setSolutionIdx(0);
    };
    const fail = (msg: string) => {
      if (seqRef.current !== seq) return;
      setSolving(false);
      setSolveError(msg);
    };
    const syncFallback = () => {
      try {
        deliver(solve(snapshot));
      } catch (err) {
        fail(`求解失败：${String(err)}`);
      }
    };

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL('./worker/solver.worker.ts', import.meta.url), {
          type: 'module',
        });
      }
      const w = workerRef.current;
      w.onmessage = (e: MessageEvent<SolveResult>) => deliver(e.data);
      w.onerror = () => syncFallback();
      w.postMessage(snapshot);
    } catch {
      syncFallback();
    }
  }, [inputKey, problem]);

  const resize = (newRows: number, newCols: number) => {
    setCells((prev) =>
      Array.from({ length: newRows }, (_, r) =>
        Array.from({ length: newCols }, (_, c) => prev[r]?.[c] ?? 0),
      ),
    );
  };
  const onRowsChange = (n: number) => {
    setRows(n);
    resize(n, cols);
  };
  const onColsChange = (n: number) => {
    setCols(n);
    resize(rows, n);
  };
  const onCellChange = (r: number, c: number, v: number) => {
    setCells((prev) => prev.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));
  };

  const applyProblem = (p: ProblemInput) => {
    setRows(p.rows);
    setCols(p.cols);
    setCells(p.cells.map((row) => [...row]));
    setApertures(p.apertures.map((a) => ({ ...a })));
  };

  const handleImport = () => {
    const r = parseProblemJson(importText);
    if (r.ok) {
      applyProblem(r.value);
      setImportErrors([]);
      setImportNotice('导入成功，已应用到编辑器');
    } else {
      setImportErrors(r.errors);
      setImportNotice('');
    }
  };

  const handleExport = () => {
    const text = serializeProblem(problem);
    setImportText(text);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dose-problem.json';
    a.click();
    URL.revokeObjectURL(url);
    setImportNotice('已导出到文本框并下载 JSON 文件');
    setImportErrors([]);
  };

  // 仅当结论与当前输入完全一致时才展示（双重保险：改动立即撤下旧结论）
  const visibleOutcome = outcome && outcome.key === inputKey ? outcome : null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>电子束直写剂量综合台</h1>
        <p>矩形孔径逐次叠加单位剂量 · 纯前端运行，全部计算在本地完成</p>
      </header>

      <main className="layout">
        <div className="col">
          <section className="panel">
            <h2>
              <span className="step-no">1</span> 整数剂量图
            </h2>
            <GridEditor
              rows={rows}
              cols={cols}
              cells={cells}
              onRowsChange={onRowsChange}
              onColsChange={onColsChange}
              onCellChange={onCellChange}
            />
            <div className={`total-line ${totalDose > LIMITS.maxTotal ? 'total-over' : ''}`}>
              总剂量：{totalDose} / {LIMITS.maxTotal}
            </div>
          </section>

          <section className="panel">
            <h2>
              <span className="step-no">2</span> 允许孔径
            </h2>
            <ApertureEditor apertures={apertures} onChange={setApertures} />
          </section>

          <section className="panel">
            <h2>
              <span className="step-no">3</span> 导入 / 导出
            </h2>
            <textarea
              className="import-box"
              rows={7}
              placeholder={IMPORT_EXAMPLE}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              spellCheck={false}
            />
            <div className="io-actions">
              <button type="button" className="btn btn-ghost" onClick={handleImport}>
                导入并应用
              </button>
              <label className="btn btn-ghost file-btn">
                选择 JSON 文件
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      f.text().then((t) => {
                        setImportText(t);
                        setImportNotice('文件已读入，点击「导入并应用」生效');
                        setImportErrors([]);
                      });
                    }
                    e.target.value = '';
                  }}
                />
              </label>
              <button type="button" className="btn btn-ghost" disabled={errors.length > 0} onClick={handleExport}>
                导出当前输入
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  applyProblem(SAMPLE);
                  setImportNotice('已载入演示用例');
                  setImportErrors([]);
                }}
              >
                载入演示用例
              </button>
            </div>
            {importErrors.length > 0 && (
              <ul className="error-list">
                {importErrors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
            {importNotice && <div className="notice-line">{importNotice}</div>}
          </section>
        </div>

        <div className="col">
          <section className="panel">
            <h2>
              <span className="step-no">4</span> 综合
            </h2>
            {errors.length > 0 ? (
              <ul className="error-list">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            ) : (
              <div className="ready-line">输入合法，可以启动综合</div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-solve"
              disabled={errors.length > 0 || solving}
              onClick={runSolve}
            >
              {solving ? '求解中…' : '启动综合'}
            </button>
            {solveError && <div className="error-list">{solveError}</div>}
            {solving && <div className="hint">正在完整比较所有可行多重集，大规模输入可能需要数秒…</div>}
          </section>

          {visibleOutcome && (
            <section className="panel">
              <h2>
                <span className="step-no">5</span> 综合结果与逐次击发
              </h2>
              <ResultPanel
                result={visibleOutcome.result}
                problem={visibleOutcome.problem}
                solutionIdx={solutionIdx}
                onSolutionIdxChange={(i) => {
                  setSolutionIdx(i);
                  setStep(0);
                }}
                step={step}
                onStepChange={setStep}
              />
            </section>
          )}
        </div>
      </main>

      <footer className="app-footer">
        最优性准则：先最小化击发次数，再对每份方案按 (top, left, height, width) 元组排序后取整份列表字典序；
        并列最优时展示前两份规范方案。
      </footer>
    </div>
  );
}
