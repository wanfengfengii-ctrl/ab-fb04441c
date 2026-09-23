import { useEffect, useMemo, useRef, useState } from 'react';
import {
  solve,
  simulate,
  validateDose,
  validateApertures,
  type Aperture,
  type Rect,
  type SolveResult,
} from './solver';
import { parseImport } from './parse';
import DoseGrid from './components/DoseGrid';

const DEFAULT_GRID = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
];
const DEFAULT_APS: Array<[string, string]> = [
  ['1', '2'],
  ['2', '1'],
  ['1', '1'],
  ['2', '2'],
];

type PlanKind = 'best' | 'second';

export default function App() {
  const [rows, setRows] = useState(DEFAULT_GRID.length);
  const [cols, setCols] = useState(DEFAULT_GRID[0].length);
  const [cells, setCells] = useState<string[][]>(
    DEFAULT_GRID.map((r) => r.map(String)),
  );
  const [aps, setAps] = useState<Array<[string, string]>>(DEFAULT_APS);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 结论与它所基于的输入签名；输入一变立即撤下
  const [result, setResult] = useState<{
    sig: string;
    value: SolveResult;
  } | null>(null);

  const [activePlan, setActivePlan] = useState<PlanKind>('best');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playTimer = useRef<number | null>(null);

  /** 当前输入签名（任何改动都会使旧结论失效） */
  const sig = useMemo(
    () => JSON.stringify({ rows, cols, cells, aps }),
    [rows, cols, cells, aps],
  );
  const stale = result !== null && result.sig !== sig;
  const shown = stale || result === null ? null : result.value;

  const gridNum = useMemo(
    () => cells.map((r) => r.map((s) => Number(s))),
    [cells],
  );
  const apsNum = useMemo<Aperture[]>(
    () => aps.map(([h, w]) => ({ height: Number(h), width: Number(w) })),
    [aps],
  );
  const totalDose = useMemo(
    () =>
      gridNum.reduce(
        (s, row) => s + row.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
        0,
      ),
    [gridNum],
  );

  // 输入变化即撤下旧结论
  useEffect(() => {
    if (stale) {
      setResult(null);
      setPlaying(false);
    }
  }, [stale]);

  const stopPlay = () => {
    if (playTimer.current !== null) {
      window.clearInterval(playTimer.current);
      playTimer.current = null;
    }
    setPlaying(false);
  };

  // 仅清定时器，保留播放状态（供 effect 在步长变化后重建定时器）
  const clearTimer = () => {
    if (playTimer.current !== null) {
      window.clearInterval(playTimer.current);
      playTimer.current = null;
    }
  };

  useEffect(() => stopPlay, []);

  const changeDims = (nr: number, nc: number) => {
    stopPlay();
    setRows(nr);
    setCols(nc);
    setCells((prev) =>
      Array.from({ length: nr }, (_, r) =>
        Array.from({ length: nc }, (_, c) => prev[r]?.[c] ?? '0'),
      ),
    );
  };

  const runSolve = () => {
    stopPlay();
    setFormError(null);
    const vg = validateDose(gridNum);
    if (!vg.ok) {
      setFormError(vg.error);
      return;
    }
    const va = validateApertures(apsNum, vg.rows, vg.cols);
    if (!va.ok) {
      setFormError(va.error);
      return;
    }
    setBusy(true);
    // 让“计算中”先绘制；全部计算仍在本地完成
    window.setTimeout(() => {
      try {
        const value = solve(gridNum, apsNum);
        setResult({ sig, value });
        setActivePlan('best');
        setStep(0);
      } catch (e) {
        setFormError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 20);
  };

  const doImport = (text: string) => {
    try {
      const parsed = parseImport(text);
      stopPlay();
      if (parsed.grid) {
        const nr = parsed.grid.length;
        const nc = parsed.grid[0].length;
        setRows(nr);
        setCols(nc);
        setCells(parsed.grid.map((r) => r.map(String)));
      }
      if (parsed.apertures) {
        setAps(parsed.apertures.map((a) => [String(a.height), String(a.width)]));
      }
      setImportError(null);
      setImportOpen(false);
      setImportText('');
    } catch (e) {
      setImportError((e as Error).message);
    }
  };

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => doImport(String(reader.result ?? ''));
    reader.onerror = () => setImportError('文件读取失败');
    reader.readAsText(f);
  };

  const plan: Rect[] =
    shown === null
      ? []
      : activePlan === 'best'
        ? shown.best
        : shown.second;
  const N = plan.length;

  // 自动播放：用 setTimeout 链式推进，到末尾自动停止
  useEffect(() => {
    if (!playing || shown === null) return;
    if (step >= N) {
      setPlaying(false);
      return;
    }
    const id = window.setTimeout(() => {
      setStep((s) => Math.min(N, s + 1));
    }, 650);
    playTimer.current = id;
    return clearTimer;
  }, [playing, step, N, shown]);

  const sim = useMemo(
    () =>
      shown === null
        ? null
        : simulate(
            gridNum,
            plan,
            Math.min(step, N),
          ),
    [shown, gridNum, plan, step, N],
  );

  const lastShot = step > 0 ? plan[step - 1] : null;

  const inputInvalid =
    !validateDose(gridNum).ok ||
    !validateApertures(apsNum, rows, cols).ok;

  return (
    <div className="page">
      <header>
        <h1>电子束直写 · 剂量图综合台</h1>
        <p className="subtitle">
          已标定矩形孔径 × 单位剂量逐发叠加 · 完整穷举所有可行多重集 ·
          全部计算仅在本机浏览器完成
        </p>
      </header>

      <section className="card">
        <div className="card-head">
          <h2>1. 剂量图（整数，每格 0~4，总剂量 ≤ 36）</h2>
          <div className="dims">
            <label>
              行
              <select
                value={rows}
                onChange={(e) => changeDims(Number(e.target.value), cols)}
              >
                {[2, 3, 4, 5].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              列
              <select
                value={cols}
                onChange={(e) => changeDims(rows, Number(e.target.value))}
              >
                {[2, 3, 4, 5, 6].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <span className={totalDose > 36 ? 'total bad' : 'total'}>
              总剂量 {totalDose}/36
            </span>
            <button className="ghost" onClick={() => setImportOpen((v) => !v)}>
              {importOpen ? '收起导入' : '导入…'}
            </button>
          </div>
        </div>

        {importOpen && (
          <div className="import-box">
            <textarea
              rows={5}
              placeholder={
                '粘贴剂量图文本，如：\n0 1 0\n1 1 1\n0 1 0\n或 JSON：{"grid":[[..]],"apertures":[[h,w],..]}'
              }
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <div className="row-gap">
              <button onClick={() => doImport(importText)}>导入文本</button>
              <label className="file-btn">
                选择文件
                <input
                  type="file"
                  accept=".txt,.json,.csv,text/plain,application/json"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </label>
              <button
                className="ghost"
                onClick={() => {
                  setImportOpen(false);
                  setImportError(null);
                }}
              >
                取消
              </button>
            </div>
            {importError && <p className="error">{importError}</p>}
          </div>
        )}

        <div
          className="edit-grid"
          style={{
            gridTemplateColumns: `repeat(${cols}, 3rem)`,
          }}
        >
          {cells.map((row, r) =>
            row.map((v, c) => (
              <input
                key={`${r}-${c}`}
                className={`cell-input${
                  Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 4
                    ? ''
                    : ' bad'
                }`}
                value={v}
                inputMode="numeric"
                aria-label={`剂量 第${r + 1}行第${c + 1}列`}
                onChange={(e) => {
                  stopPlay();
                  const val = e.target.value;
                  setCells((prev) =>
                    prev.map((rr, i) =>
                      i === r ? rr.map((x, j) => (j === c ? val : x)) : rr,
                    ),
                  );
                }}
              />
            )),
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>2. 允许孔径（高 × 宽，正整数；1~8 种，不得越界）</h2>
          <button
            className="ghost"
            disabled={aps.length >= 8}
            onClick={() => {
              stopPlay();
              setAps((p) => [...p, ['1', '1']]);
            }}
          >
            + 增加孔径
          </button>
        </div>
        <ul className="ap-list">
          {aps.map(([h, w], i) => {
            const hn = Number(h);
            const wn = Number(w);
            const bad =
              !Number.isInteger(hn) ||
              !Number.isInteger(wn) ||
              hn < 1 ||
              wn < 1 ||
              hn > rows ||
              wn > cols;
            return (
              <li key={i} className={bad ? 'bad' : ''}>
                <span className="ap-idx">P{i + 1}</span>
                <input
                  value={h}
                  inputMode="numeric"
                  aria-label={`孔径 ${i + 1} 高`}
                  onChange={(e) => {
                    stopPlay();
                    setAps((p) =>
                      p.map((a, j) => (j === i ? [e.target.value, a[1]] : a)),
                    );
                  }}
                />
                <span className="times">×</span>
                <input
                  value={w}
                  inputMode="numeric"
                  aria-label={`孔径 ${i + 1} 宽`}
                  onChange={(e) => {
                    stopPlay();
                    setAps((p) =>
                      p.map((a, j) => (j === i ? [a[0], e.target.value] : a)),
                    );
                  }}
                />
                <button
                  className="ghost del"
                  disabled={aps.length <= 1}
                  title="删除该孔径"
                  onClick={() => {
                    stopPlay();
                    setAps((p) => p.filter((_, j) => j !== i));
                  }}
                >
                  删除
                </button>
                {bad && (
                  <span className="warn">非正整数或超出 {rows}×{cols}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>3. 综合</h2>
          <button
            className="primary"
            disabled={busy || inputInvalid}
            onClick={runSolve}
          >
            {busy ? '穷举中…' : '启动综合'}
          </button>
        </div>
        {formError && <p className="error">✗ {formError}</p>}
        {inputInvalid && (
          <p className="hint">请先修正上方标红的输入，再启动综合。</p>
        )}
        <p className="hint">
          优化准则：① 击发次数最少；② 击发列表按零基 (top, left, height,
          width) 排序后整份字典序最小。重复击发允许，方案保证不过曝。
        </p>
      </section>

      {shown && (
        <section className="card result">
          <h2>综合结论</h2>
          {shown.status === 'infeasible' ? (
            <p className="status infeasible">
              ✗ 不可实现：已穷尽所有合法放置的孔径多重集，均无法在不过曝的
              前提下精确拼出目标剂量图。
            </p>
          ) : (
            <>
              <p className={`status ${shown.status}`}>
                {shown.status === 'unique' ? '✓ 唯一最优方案' : '⇄ 并列最优'}
                ：最少 <strong>{shown.shots}</strong> 发；完整比较{' '}
                {shown.enumerated} 个可行多重集
                {shown.status === 'tie' && '，以下展示字典序最前的两份规范方案'}
                。
              </p>

              {shown.status === 'tie' && (
                <div className="plan-tabs">
                  <button
                    className={activePlan === 'best' ? 'tab on' : 'tab'}
                    onClick={() => {
                      setActivePlan('best');
                      setStep(0);
                      stopPlay();
                    }}
                  >
                    方案一（字典序最小）
                  </button>
                  <button
                    className={activePlan === 'second' ? 'tab on' : 'tab'}
                    onClick={() => {
                      setActivePlan('second');
                      setStep(0);
                      stopPlay();
                    }}
                  >
                    方案二（并列）
                  </button>
                </div>
              )}

              <div className="boards">
                <div>
                  <h3>累计剂量{step > 0 && `（第 ${step}/${N} 发后）`}</h3>
                  <DoseGrid
                    rows={rows}
                    cols={cols}
                    values={sim!.accumulated}
                    highlight={lastShot}
                  />
                </div>
                <div>
                  <h3>剩余剂量</h3>
                  <DoseGrid
                    rows={rows}
                    cols={cols}
                    values={sim!.remaining}
                    dimZero
                  />
                </div>
              </div>

              {lastShot ? (
                <p className="shot-info">
                  第 {step} 发孔径：
                  <code>
                    (top={lastShot.top}, left={lastShot.left}, height=
                    {lastShot.height}, width={lastShot.width})
                  </code>
                </p>
              ) : N === 0 ? (
                <p className="shot-info">空方案：目标为全零，无需击发。</p>
              ) : (
                <p className="shot-info">尚未击发。</p>
              )}

              <div className="stepper">
                <button disabled={step === 0 || N === 0} onClick={() => setStep(0)}>
                  ⏮
                </button>
                <button
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  ◀ 上一发
                </button>
                <button
                  disabled={N === 0}
                  onClick={() => {
                    if (step >= N) setStep(0);
                    setPlaying((p) => !p);
                  }}
                >
                  {playing ? '⏸ 暂停' : step >= N ? '↺ 重播' : '▶ 播放'}
                </button>
                <button
                  disabled={step >= N}
                  onClick={() => setStep((s) => Math.min(N, s + 1))}
                >
                  下一发 ▶
                </button>
                <button disabled={step >= N} onClick={() => setStep(N)}>
                  ⏭
                </button>
                <input
                  type="range"
                  min={0}
                  max={N}
                  value={step}
                  disabled={N === 0}
                  onChange={(e) => {
                    clearTimer();
                    setPlaying(false);
                    setStep(Number(e.target.value));
                  }}
                  aria-label="击发进度"
                />
              </div>

              <details className="shot-list">
                <summary>规范击发列表（{N} 发，已按元组排序）</summary>
                <ol>
                  {plan.map((r, i) => (
                    <li
                      key={i}
                      className={i === step - 1 ? 'current' : ''}
                    >
                      <button
                        className="link"
                        onClick={() => {
                          stopPlay();
                          setStep(i + 1);
                        }}
                      >
                        #{i + 1}　(top={r.top}, left={r.left}, height=
                        {r.height}, width={r.width})
                      </button>
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </section>
      )}

      <footer>
        纯前端离线应用 · 无数据上传 · 穷举法保证全局最优（最小发数 +
        字典序），拒绝贪心短视
      </footer>
    </div>
  );
}
